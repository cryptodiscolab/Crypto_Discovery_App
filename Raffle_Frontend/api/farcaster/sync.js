import { createClient } from '@supabase/supabase-js';

// Super Sempurna: Bulletproof Backend Logic
// Senior Architecture: Raw Server-Side Environment Consumption
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

export default async function handler(req, res) {
    // Blocking Check: Ensure Infrastructure Integrity
    if (!supabaseServiceKey) {
        return res.status(500).json({ error: 'Infrastructure Error: SUPABASE_SERVICE_ROLE_KEY is missing in .env' });
    }
    if (!supabaseUrl) {
        return res.status(500).json({ error: 'Infrastructure Error: SUPABASE_URL is missing' });
    }
    if (!neynarApiKey) {
        return res.status(500).json({ error: 'Infrastructure Error: NEYNAR_API_KEY is missing' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    /**
     * Native Sanitization (No libs)
     */
    const clean = (str) => {
        if (!str) return '';
        return str.replace(/[^\x20-\x7E\n\r]/g, '').trim();
    };

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { address, fid } = req.body;

    // Validation: Require at least one identifier
    // Validation: Require at least one identifier
    if (!address && !fid) {
        return res.status(200).json({
            skipped: true,
            message: 'No identifier provided',
        });
    }

    const normalizedAddress = address ? address.trim().toLowerCase() : null;

    try {
        // 1. HARDENED RATE LIMITING (Database-Level)
        // Check last_sync only if we have an address to check against
        if (normalizedAddress) {
            const { data: existingUser } = await supabase
                .from('user_profiles')
                .select('last_sync')
                .eq('wallet_address', normalizedAddress)
                .single();

            if (existingUser) {
                const timeSinceLastSync = Date.now() - new Date(existingUser.last_sync).getTime();
                const FIVE_MINUTES = 5 * 60 * 1000;

                if (timeSinceLastSync < FIVE_MINUTES) {
                    return res.status(429).json({
                        error: 'Rate Limit Exceeded',
                        details: `Please wait ${Math.ceil((FIVE_MINUTES - timeSinceLastSync) / 1000)} seconds before syncing again.`
                    });
                }
            }
        }

        // 2. NATIVE FETCH (Principal Standard)
        // Prioritize FID lookup if available, otherwise fallback to address
        let neynarUrl;
        if (fid) {
            neynarUrl = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`;
        } else {
            neynarUrl = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${normalizedAddress}`;
        }

        const neynarResponse = await fetch(neynarUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api_key': neynarApiKey
            }
        });

        if (!neynarResponse.ok) {
            const errBody = await neynarResponse.json().catch(() => ({}));
            throw new Error(`Neynar API Error: ${neynarResponse.status} - ${JSON.stringify(errBody)}`);
        }

        const neynarData = await neynarResponse.json();

        // Parse response based on query type (FID vs Address)
        let userData = null;
        if (fid) {
            // Bulk buffer response usually: { users: [...] }
            userData = (neynarData.users && neynarData.users.length > 0) ? neynarData.users[0] : null;
        } else {
            // Address response usually: { [address]: [{...}] }
            const userDataArray = neynarData[normalizedAddress];
            userData = (userDataArray && userDataArray.length > 0) ? userDataArray[0] : null;
        }

        if (!userData) {
            // Case: No Farcaster Profile Found
            // If we have an address, valid wallet-only user. Upsert wallet profile.
            if (normalizedAddress) {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .upsert({
                        wallet_address: normalizedAddress,
                        last_sync: new Date().toISOString()
                    }, {
                        onConflict: 'wallet_address',
                        ignoreDuplicates: false
                    })
                    .select()
                    .single();

                if (error) throw error;

                return res.status(200).json({
                    isFarcasterUser: false,
                    profile: data,
                    message: 'Wallet profile synced (No Farcaster ID found).'
                });
            } else {
                // If only FID provided but not found, return 404
                return res.status(404).json({
                    error: 'Profile Not Found',
                    details: 'No Farcaster profile found for this FID.'
                });
            }
        }

        // 3. SECURE UPSERT
        // We need a wallet address to bind this to.
        // If we looked up by FID, we need to extract the verified address or custom custody address.
        // However, this endpoint logic assumes we are syncing FOR a connected wallet typically.
        // If 'normalizedAddress' is null (lookup by FID only), we might not want to create a profile
        // unless we know the wallet.
        // FOR NOW: We assume this sync is triggered by a user with a wallet.

        const finalWalletAddress = normalizedAddress || userData.custody_address || (userData.verifications ? userData.verifications[0] : null);

        if (!finalWalletAddress) {
            return res.status(400).json({
                error: 'Wallet Binding Failed',
                details: 'Could not determine wallet address for this Farcaster profile.'
            });
        }

        // 3. SECURE UPSERT (Bypass RLS via Service Key)
        const profileUpdate = {
            wallet_address: finalWalletAddress,
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
            last_sync: new Date().toISOString(),
            // Ensure is_admin is preserved or defaulted safely if columns exist, 
            // but upsert usually only updates specified columns. 
            // We don't want to overwrite is_admin to null/false if it's not in this object
            // unless we explicitly want to key off something. 
            // For now, let's keep it safe.
        };

        // SYBIL DEFENSE: The database unique index on 'fid' will handle 
        // conflicts if this FID is already used by another wallet.
        const { data, error } = await supabase
            .from('user_profiles')
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

