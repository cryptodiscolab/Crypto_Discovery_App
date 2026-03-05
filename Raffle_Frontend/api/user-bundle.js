import { createClient } from '@supabase/supabase-js';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { createPublicClient, http, verifyMessage } from 'viem';
import { baseSepolia } from 'viem/chains';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const neynar = new NeynarAPIClient({ apiKey: neynarApiKey || '' });

const rpcClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
});

const DAILY_APP_ADDRESS = process.env.VITE_V12_CONTRACT_ADDRESS || '0xfc12f4FEFf825860c5145680bde38BF222cC669A';

export default async function handler(req, res) {
    const action = req.body?.action || req.query?.action;

    switch (action) {
        case 'sync': // Logic from api/user/sync.js (Login Sync)
            return handleLoginSync(req, res);
        case 'xp': // Logic from api/user/sync.js (XP Sync)
            return handleXpSync(req, res);
        case 'fc-sync': // Logic from api/farcaster/sync.js
            return handleFarcasterSync(req, res);
        case 'update-profile': // Logic from api/profile/update.js
            return handleUpdateProfile(req, res);
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

async function handleLoginSync(req, res) {
    const { wallet_address, signature, message, fid, metadata, referred_by } = req.body;
    if (!wallet_address || !signature || !message) return res.status(400).json({ error: 'Missing fields' });

    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet_address.toLowerCase();

        // 1. Check if user already exists and if they have a referrer
        const { data: existing } = await supabaseAdmin
            .from('user_profiles')
            .select('referred_by')
            .eq('wallet_address', cleanAddress)
            .maybeSingle();

        // 2. Prepare update data (Explicit fields ONLY - Security Fix)
        const updateData = {
            wallet_address: cleanAddress,
            fid: fid || null,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // 3. ONLY set referred_by if it doesn't exist yet and it's not self-referral
        if (!existing?.referred_by && referred_by && referred_by.toLowerCase() !== cleanAddress) {
            updateData.referred_by = referred_by.toLowerCase();
        }

        // 4. SBT GATE: New users start at tier=0 (Guest).
        //    Tier is ONLY elevated by the cron job after detecting on-chain SBT.
        if (!existing) {
            updateData.tier = 0;
        }

        const { data, error } = await supabaseAdmin
            .from('user_profiles')
            .upsert(updateData, { onConflict: 'wallet_address' })
            .select().single();

        if (error) throw error;
        return res.status(200).json({ success: true, profile: data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleXpSync(req, res) {
    const { wallet_address, signature, message } = req.body;
    if (!wallet_address || !signature || !message) {
        return res.status(400).json({ error: 'Missing sync data' });
    }

    try {
        // 1. Verify Signature
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet_address.toLowerCase();

        // 2. Fetch Current On-Chain XP recorded in DB (NOT total_xp, to prevent negative deltas)
        const { data: claims } = await supabaseAdmin
            .from('user_task_claims')
            .select('xp_earned')
            .eq('wallet_address', cleanAddress)
            .eq('platform', 'blockchain');

        const dbOnChainXP = claims ? claims.reduce((acc, curr) => acc + (curr.xp_earned || 0), 0) : 0;

        let onChainXP = 0;
        let xpDelta = 0;
        let attempts = 0;
        const maxAttempts = 3;

        // 3. Retry Loop for On-Chain reading (Handling RPC Indexing Lag)
        // Helps if the block was just mined but the RPC node hasn't indexed it yet.
        while (attempts < maxAttempts) {
            const stats = await rpcClient.readContract({
                address: DAILY_APP_ADDRESS,
                abi: [{
                    inputs: [{ name: '', type: 'address' }],
                    name: 'userStats',
                    outputs: [
                        { name: 'points', type: 'uint256' },
                        { name: 'totalTasksCompleted', type: 'uint256' },
                        { name: 'referralCount', type: 'uint256' },
                        { name: 'currentTier', type: 'uint8' },
                        { name: 'tasksForReferralProgress', type: 'uint256' },
                        { name: 'lastDailyBonusClaim', type: 'uint256' },
                        { name: 'isBlacklisted', type: 'bool' },
                    ],
                    stateMutability: 'view',
                    type: 'function',
                }],
                functionName: 'userStats',
                args: [cleanAddress],
            });

            onChainXP = Number(stats[0] || 0);
            xpDelta = onChainXP - dbOnChainXP;

            if (xpDelta > 0) break; // Found gains!

            attempts++;
            if (attempts < maxAttempts) {
                console.log(`[XP Sync] No gains found for ${cleanAddress}. Retrying in 2s... (Attempt ${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`[XP Sync] ${cleanAddress}: OnChain=${onChainXP}, DB(OnChainOnly)=${dbOnChainXP}, Delta=${xpDelta}`);

        // 4. Ensure profile exists (Identity Foundation)
        // We must do this BEFORE inserting the claim so the trigger 'sync_user_xp' 
        // has a target row to update.
        await supabaseAdmin
            .from('user_profiles')
            .upsert({
                wallet_address: cleanAddress,
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'wallet_address' });

        if (xpDelta > 0) {
            // Determine Task ID for the claim
            // 288596d8-b5a9-4faf-bde0-0dd28aaba902 is "Daily Bonus Claim (On-Chain)"
            // 885535d2-4c5c-4a80-9af5-36666192c244 is general "DailyApp Contract Sync"
            const taskId = (xpDelta === 100)
                ? '288596d8-b5a9-4faf-bde0-0dd28aaba902'
                : '885535d2-4c5c-4a80-9af5-36666192c244';

            // 5. Record Claim to update total_xp via trigger
            // This is "Trigger-Safe" because sync_user_xp sums all claims.
            const { error: claimError } = await supabaseAdmin
                .from('user_task_claims')
                .insert({
                    wallet_address: cleanAddress,
                    task_id: taskId,
                    xp_earned: xpDelta,
                    claimed_at: new Date().toISOString(),
                    platform: 'blockchain',
                    action_type: 'contract_sync'
                });

            if (claimError) {
                // If it's a unique constraint error, it means sync already happened today for this taskId
                if (claimError.code === '23505') {
                    console.warn(`[XP Sync] Duplicate sync for ${cleanAddress} today. Skipping insert.`);
                } else {
                    throw claimError;
                }
            }
        } else if (xpDelta < 0) {
            console.warn(`[XP Sync] On-chain XP (${onChainXP}) is lower than DB OnChain record (${dbOnChainXP}) for ${cleanAddress}`);
        }

        return res.status(200).json({
            ok: true,
            xp: Math.max(onChainXP, dbOnChainXP),
            synced: xpDelta > 0
        });
    } catch (error) {
        console.error('[XP Sync Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleFarcasterSync(req, res) {
    const { address, signature, message } = req.body;
    if (!address || !signature || !message) return res.status(400).json({ error: 'Missing sync data' });

    try {
        // Verify Signature
        const valid = await verifyMessage({ address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        const response = await neynar.fetchBulkUsersByEthOrSolAddress({ addresses: [address] });
        const fcUser = response?.[address.toLowerCase()]?.[0];

        if (fcUser) {
            const { data, error } = await supabaseAdmin
                .from('user_profiles')
                .upsert({
                    wallet_address: address.toLowerCase(),
                    fid: fcUser.fid,
                    username: fcUser.username,
                    pfp_url: fcUser.pfp_url,
                    neynar_score: fcUser.experimental?.neynar_user_score || 0
                }, { onConflict: 'wallet_address' })
                .select().single();
            if (error) throw error;
            return res.status(200).json({ ok: true, profile: data });
        }
        return res.status(404).json({ error: 'No Farcaster profile' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleUpdateProfile(req, res) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing update data' });

    try {
        // 1. Verify Signature (Zero-Trust)
        const valid = await verifyMessage({ address: wallet, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // 2. Security: Strip sensitive fields to prevent privilege escalation
        const sanitizedPayload = { ...payload };
        delete sanitizedPayload.is_admin;
        delete sanitizedPayload.wallet_address;
        delete sanitizedPayload.total_xp;
        delete sanitizedPayload.referred_by;
        delete sanitizedPayload.tier; // Tier can ONLY be updated by cron/admin via SBT sync

        // 3. Size Validation: Validate avatar URL file size (max 1MB)
        if (sanitizedPayload.pfp_url) {
            try {
                const imgRes = await fetch(sanitizedPayload.pfp_url, { method: 'HEAD' });
                if (imgRes.ok) {
                    const contentLength = imgRes.headers.get('content-length');
                    if (contentLength && parseInt(contentLength, 10) > 1048576) { // 1MB in bytes
                        return res.status(400).json({ error: 'Avatar image size exceeds the 1MB limit. Please use a smaller image file.' });
                    }
                }
            } catch (err) {
                console.warn(`[Profile Update] Failed to check image size for ${sanitizedPayload.pfp_url}:`, err.message);
                // Allow passing if HEAD request is blocked, relying on client-side constraints.
            }
            // 4. Force length limits (Rule 8.8)
            if (sanitizedPayload.display_name) sanitizedPayload.display_name = sanitizedPayload.display_name.substring(0, 50);
            if (sanitizedPayload.username) sanitizedPayload.username = sanitizedPayload.username.substring(0, 30);
            if (sanitizedPayload.bio) sanitizedPayload.bio = sanitizedPayload.bio.substring(0, 160);
            if (sanitizedPayload.pfp_url) sanitizedPayload.pfp_url = sanitizedPayload.pfp_url.substring(0, 500);

            const { error } = await supabaseAdmin
                .from('user_profiles')
                .update(sanitizedPayload)
                .eq('wallet_address', wallet.toLowerCase());
            if (error) throw error;
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
