import { createClient } from '@supabase/supabase-js';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

// Centralized Environment Consumption
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

/**
 * Neynar Identity Sync Protocol:
 * Uses @neynar/nodejs-sdk for robust data procurement.
 * Optimized for low-latency identity mapping.
 */
export default async function handler(req, res) {
    if (!supabaseServiceKey || !supabaseUrl || !neynarApiKey) {
        return res.status(500).json({ error: 'System Configuration Incomplete' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const neynar = new NeynarAPIClient(neynarApiKey);

    const cleanWallet = (w) => w?.trim?.().toLowerCase() ?? null;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { address } = req.body;
    const wallet = cleanWallet(address);

    if (!wallet) return res.status(200).json({ skipped: true, message: 'Invalid Wallet' });

    try {
        // 1. Procure Farcaster Metadata via Neynar SDK
        // bulk-by-address is now a clean SDK call
        const neynarData = await neynar.lookupUserByVerification(wallet);
        const fcUser = neynarData.result?.user || null;

        // 2. Prepare Profile State
        const profile = {
            wallet_address: wallet,
            last_sync: new Date().toISOString()
        };

        if (fcUser) {
            profile.fid = fcUser.fid;
            profile.username = fcUser.username;
            profile.display_name = fcUser.display_name;
            profile.pfp_url = fcUser.pfp_url;
            profile.bio = fcUser.profile?.bio?.text || '';
            profile.power_badge = fcUser.power_badge || false;
            profile.follower_count = fcUser.follower_count || 0;
            profile.following_count = fcUser.following_count || 0;
            profile.verified_addresses = fcUser.verified_addresses || [];

            // OpenRank / Internal Trust Score calc can be added here or via separate trigger
        }

        // 3. Commit to Database
        const { data, error } = await supabase
            .from("user_profiles")
            .upsert(profile, { onConflict: "wallet_address" })
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({
            ok: true,
            profile: data,
            synced: !!fcUser
        });

    } catch (err) {
        console.error('[Neynar SDK Sync Error]:', err.message);
        return res.status(500).json({ error: err.message });
    }
}


