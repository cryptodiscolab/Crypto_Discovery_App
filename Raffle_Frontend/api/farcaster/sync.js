import { createClient } from '@supabase/supabase-js';

// Super Sempurna: Bulletproof Backend Logic
// Senior Architecture: Raw Server-Side Environment Consumption
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

export default async function handler(req, res) {
    // Blocking Check: Ensure Infrastructure Integrity
    if (!supabaseServiceKey) {
        return res.status(500).json({ error: 'Infrastructure Error: SUPABASE_SERVICE_ROLE_KEY is missing' });
    }
    if (!supabaseUrl) {
        return res.status(500).json({ error: 'Infrastructure Error: SUPABASE_URL is missing' });
    }
    if (!neynarApiKey) {
        return res.status(500).json({ error: 'Infrastructure Error: NEYNAR_API_KEY is missing' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Helper: Normalize wallet address (Safe Lowercase)
    const cleanWallet = (w) => w?.trim?.().toLowerCase() ?? null;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { address } = req.body;
    const wallet = cleanWallet(address);

    if (!wallet) {
        return res.status(200).json({ skipped: true, message: 'No valid wallet provided' });
    }

    try {
        // 1. Fetch Farcaster Data from Neynar
        // API: /v2/farcaster/user/bulk-by-address
        console.log(`[Sync] Fetching Neynar data for: ${wallet}`);
        const neynarRes = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${wallet}`, {
            headers: { 'api_key': neynarApiKey }
        });

        const neynarData = await neynarRes.json();
        const users = neynarData[wallet] || [];
        const fcUser = users.length > 0 ? users[0] : null;

        // 2. Prepare Profile Object
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
            // Optional: Get rank if available
            // profile.rank_score = ... (OpenRank requires separate call usually)
        }

        // 3. Upsert into user_profiles
        const { data, error } = await supabase
            .from("user_profiles")
            .upsert(profile, {
                onConflict: "wallet_address",
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase upsert failed:", error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({
            ok: true,
            profile: data,
            synced_farcaster: !!fcUser
        });

    } catch (err) {
        console.error('[Sync] Unexpected Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

