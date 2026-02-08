import { createClient } from '@supabase/supabase-js';

// Super Sempurna: Bulletproof Backend Logic
// USAGE: process.env (No prefix for server-side)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Native Sanitization (No libs)
 */
const clean = (str) => {
    if (!str) return '';
    return str.replace(/[^\x20-\x7E\n\r]/g, '').trim();
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Missing wallet address' });

    const normalizedAddress = address.trim().toLowerCase();

    try {
        // 1. HARDENED RATE LIMITING (Database-Level)
        // Check last_sync before calling expensive Neynar API
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('last_sync')
            .eq('wallet_address', normalizedAddress)
            .single();

        if (existingUser) {
            const timeSinceLastSync = Date.now() - new Date(existingUser.last_sync).getTime();
            const FIVE_MINUTES = 5 * 60 * 1000;

            if (timeSinceLastSync < FIVE_MINUTES) {
                return res.status(429).json({
                    error: 'Rate Limit: Please wait 5 minutes between syncs',
                    retryAfter: Math.ceil((FIVE_MINUTES - timeSinceLastSync) / 1000)
                });
            }
        }

        // 2. NATIVE FETCH (Principal Standard)
        const neynarUrl = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${normalizedAddress}`;
        const neynarResponse = await fetch(neynarUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api_key': neynarApiKey
            }
        });

        if (!neynarResponse.ok) {
            throw new Error(`Neynar API returned ${neynarResponse.status}`);
        }

        const neynarData = await neynarResponse.json();
        const userDataArray = neynarData[normalizedAddress];
        const userData = (userDataArray && userDataArray.length > 0) ? userDataArray[0] : null;

        if (!userData) {
            return res.status(200).json({
                isFarcasterUser: false,
                profile: null,
                message: 'No FID linked'
            });
        }

        // 3. SECURE UPSERT (Bypass RLS via Service Key)
        const profileUpdate = {
            wallet_address: normalizedAddress,
            fid: userData.fid,
            farcaster_username: clean(userData.username),
            display_name: clean(userData.display_name),
            pfp_url: userData.pfp_url,
            bio: clean(userData.profile?.bio?.text || ''),
            power_badge: !!userData.power_badge,
            follower_count: userData.follower_count || 0,
            following_count: userData.following_count || 0,
            is_active: userData.active_status === 'active',
            verified_addresses: userData.verifications || [], // Stored as JSONB
            rank_score: userData.profile_score || userData.rank || 0.0,
            last_sync: new Date().toISOString()
        };

        // SYBIL DEFENSE: The database unique index on 'fid' will handle 
        // conflicts if this FID is already used by another wallet.
        const { data, error } = await supabase
            .from('profiles')
            .upsert(profileUpdate, {
                onConflict: 'wallet_address',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) {
            // Check if it's a Sybil conflict (Duplicate FID on a different wallet)
            if (error.code === '23505') {
                return res.status(403).json({
                    error: 'Sybil Detected: This Farcaster Identity is already linked to another wallet address in our system.',
                    isSybil: true
                });
            }
            throw error;
        }

        return res.status(200).json({
            isFarcasterUser: true,
            profile: data
        });

    } catch (error) {
        console.error('[Bulletproof Sync] Critical Error:', error.message);
        return res.status(500).json({
            error: 'Server identity sync error',
            details: error.message
        });
    }
}
