import { createClient } from '@supabase/supabase-js';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

/**
 * Neynar Identity Sync Protocol
 * Syncs Farcaster profile data into user_profiles table.
 * Uses SERVICE_ROLE_KEY — RLS is bypassed server-side only.
 */
export default async function handler(req, res) {
    if (!supabaseServiceKey || !supabaseUrl || !neynarApiKey) {
        console.error("[Sync] Missing server configuration");
        return res.status(500).json({ error: 'Internal server error' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const cleanWallet = (w) => w?.trim?.().toLowerCase() ?? null;
    const { address } = req.body;
    const wallet = cleanWallet(address);

    if (!wallet) {
        return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // ── ZERO TRUST FIX: Do NOT pass x-user-wallet header to Supabase ──
    // SERVICE_ROLE_KEY already bypasses RLS. The header was the original
    // vulnerability (spoofable via DevTools). Never send it server-side.
    let supabase;
    let neynar;
    try {
        supabase = createClient(supabaseUrl, supabaseServiceKey);
        neynar = new NeynarAPIClient({ apiKey: neynarApiKey });
    } catch (initErr) {
        console.error("[Sync] Client initialization failed");
        return res.status(500).json({ error: 'Internal server error' });
    }

    try {
        // 1. Fetch Farcaster metadata via Neynar SDK
        let fcUser = null;
        try {
            let response;
            if (typeof neynar.fetchBulkUsersByEthOrSolAddress === 'function') {
                response = await neynar.fetchBulkUsersByEthOrSolAddress({ addresses: [wallet] });
            } else {
                throw new Error("Neynar SDK method not found");
            }

            if (response?.[wallet]) {
                const users = response[wallet];
                if (users?.length > 0) fcUser = users[0];
            } else if (response?.users) {
                fcUser = response.users[0];
            }
        } catch (nErr) {
            // Non-blocking: sync proceeds without Farcaster data
            console.error("[Sync] Neynar fetch failed (non-blocking):", nErr.message);
        }

        // 2. Prepare profile payload
        const profile = {
            wallet_address: wallet,
            last_login_at: new Date().toISOString()
        };

        if (fcUser) {
            profile.fid = fcUser.fid;
            profile.username = fcUser.username;
            profile.display_name = fcUser.display_name || null;
            profile.pfp_url = fcUser.pfp_url || null;
            profile.bio = fcUser.profile?.bio?.text || null;
            profile.neynar_score = fcUser.experimental?.neynar_user_score || 0;
            profile.follower_count = fcUser.follower_count || 0;
            profile.following_count = fcUser.following_count || 0;
            profile.verifications = fcUser.verifications || [];
            profile.active_status = fcUser.active_status || 'active';
            profile.power_badge = (fcUser.follower_count > 500);
        } else {
            profile.neynar_score = 0;
        }

        // 3. Upsert to DB (SERVICE_ROLE_KEY bypasses RLS — no header needed)
        const { data, error } = await supabase
            .from("user_profiles")
            .upsert(profile, { onConflict: "wallet_address" })
            .select()
            .maybeSingle();

        if (error) {
            console.error("[Sync] Supabase upsert failed:", error.code);
            return res.status(500).json({ error: 'Internal server error' });
        }

        return res.status(200).json({
            ok: true,
            profile: data,
            synced: !!fcUser,
            score: profile.neynar_score
        });

    } catch (err) {
        // ── ZERO TRUST FIX: Never expose stack trace or env status ──
        console.error('[Sync] Fatal error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
