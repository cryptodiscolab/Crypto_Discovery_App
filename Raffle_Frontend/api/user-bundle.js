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
        case 'get-activity-logs':
            return handleGetActivityLogs(req, res);
        case 'log-activity':
            return handleFrontendLogActivity(req, res);
        case 'get-point-settings':
            return handleGetPointSettings(req, res);
        case 'sync-ugc-mission':
            return handleSyncUgcMission(req, res);
        case 'sync-ugc-raffle':
            return handleSyncUgcRaffle(req, res);
        case 'sync-sbt-upgrade':
            return handleSyncSbtUpgrade(req, res);
        case 'sync-pool-claim':
            return handleSyncPoolClaim(req, res);
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

        // 2. Fetch Last Known On-Chain XP from Profile (Robust Baseline)
        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('total_xp, streak_count, last_streak_claim')
            .eq('wallet_address', cleanAddress)
            .maybeSingle();

        const dbLastPoints = profile?.total_xp || 0;

        let onChainXP = 0;
        let xpDelta = 0;
        let attempts = 0;
        const maxAttempts = 3;

        // 3. Retry Loop for On-Chain reading (Handling RPC Indexing Lag)
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
            xpDelta = onChainXP - dbLastPoints;

            if (xpDelta > 0) break; // Found gains!
            if (xpDelta < 0) break; // Found burn! (Still sync balance)

            attempts++;
            if (attempts < maxAttempts) {
                console.log(`[XP Sync] No change found for ${cleanAddress}. Retrying in 2s... (Attempt ${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`[XP Sync] ${cleanAddress}: OnChain=${onChainXP}, DB_Last=${dbLastPoints}, Delta=${xpDelta}`);

        // 4. Update Profile (Identity & Points Balance)
        const profileUpdate = {
            wallet_address: cleanAddress,
            total_xp: onChainXP, // Sync current balance
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Determine Task ID for the claim early to check for streaks
        const { data: dailySetting } = await supabaseAdmin
            .from('point_settings')
            .select('points_value')
            .eq('activity_key', 'daily_claim')
            .single();

        const standardDailyReward = dailySetting?.points_value || 100;
        const isDailyClaim = xpDelta === standardDailyReward;
        const taskId = isDailyClaim
            ? '288596d8-b5a9-4faf-bde0-0dd28aaba902'
            : '885535d2-4c5c-4a80-9af5-36666192c244';

        // ── STREAK LOGIC ──────────────────────────────────────────
        if (isDailyClaim) {
            const now = new Date();
            const lastClaimDate = profile?.last_streak_claim ? new Date(profile.last_streak_claim) : null;
            let currentStreak = profile?.streak_count || 0;

            if (!lastClaimDate) {
                currentStreak = 1;
            } else {
                const diffHours = (now - lastClaimDate) / (1000 * 60 * 60);
                
                // If claimed within the 24-48 hour window, increment streak
                if (diffHours >= 20 && diffHours <= 48) {
                    currentStreak += 1;
                } else if (diffHours > 48) {
                    // Reset if more than 48 hours passed
                    currentStreak = 1;
                }
                // (If diffHours < 20, we don't increment, it might be a double sync, 
                // but usually the on-chain cooldown handles this)
            }

            profileUpdate.streak_count = currentStreak;
            profileUpdate.last_streak_claim = now.toISOString();
            console.log(`[Streak] ${cleanAddress}: ${currentStreak} days 🔥`);
        }
        // ──────────────────────────────────────────────────────────

        await supabaseAdmin
            .from('user_profiles')
            .upsert(profileUpdate, { onConflict: 'wallet_address' });

        if (xpDelta > 0) {

            // 5. Record Claim to update total_xp via trigger
            // Note: Since we use UPSERT on points in profile, we still want a log of the claim.
            await supabaseAdmin
                .from('user_task_claims')
                .insert({
                    wallet_address: cleanAddress,
                    task_id: taskId,
                    xp_earned: xpDelta,
                    claimed_at: new Date().toISOString(),
                    platform: 'blockchain',
                    action_type: 'contract_sync'
                });

            // 6. Log to user_activity_logs
            await logActivity({
                wallet: cleanAddress,
                category: 'XP',
                type: taskId === '288596d8-b5a9-4faf-bde0-0dd28aaba902' ? 'Daily Claim' : 'Contract Sync',
                description: `Earned ${xpDelta} XP from ${taskId === '288596d8-b5a9-4faf-bde0-0dd28aaba902' ? 'Daily Bonus' : 'On-Chain Activity'}`,
                amount: xpDelta,
                symbol: 'XP'
            });
        }

        return res.status(200).json({
            ok: true,
            xp: onChainXP,
            synced: xpDelta !== 0
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

            // Log profile update? (Optional, but let's stick to XP/Purchase/Reward for now as requested)

            return res.status(200).json({ success: true });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

/**
 * handleGetActivityLogs: Fetch categorized logs for a user.
 */
async function handleGetActivityLogs(req, res) {
    const { wallet, category, limit = 20 } = req.query;
    if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });

    try {
        let query = supabaseAdmin
            .from('user_activity_logs')
            .select('*')
            .eq('wallet_address', wallet.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (category && category !== 'ALL') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ success: true, logs: data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

/**
 * handleFrontendLogActivity: Securely log activities from the frontend.
 */
async function handleFrontendLogActivity(req, res) {
    const { wallet_address, signature, message, category, type, description, amount, symbol, txHash, metadata } = req.body;
    if (!wallet_address || !signature || !message || !description) return res.status(400).json({ error: 'Missing log data' });
    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        await logActivity({
            wallet: wallet_address,
            category: category || 'PURCHASE',
            type: type || 'External Activity',
            description,
            amount,
            symbol: symbol || 'XP',
            txHash,
            metadata
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleGetPointSettings(req, res) {
    try {
        // Fetch Reward Points
        const { data: points, error: pError } = await supabaseAdmin
            .from('point_settings')
            .select('activity_key, points_value');

        if (pError) throw pError;

        // Fetch Ecosystem Settings (Fees, Gas, etc)
        const { data: system, error: sError } = await supabaseAdmin
            .from('system_settings')
            .select('key, value');

        if (sError) throw sError;

        // Convert Reward Points to simple object
        const settings = points.reduce((acc, curr) => {
            acc[curr.activity_key] = curr.points_value;
            return acc;
        }, {});

        // Inject System Settings
        system.forEach(s => {
            settings[s.key] = s.value;
        });

        return res.status(200).json({ success: true, settings });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleSyncUgcMission(req, res) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { title, description, sponsor_address, platform_code, reward_amount_per_user, max_participants, txHash, tasks } = payload;

        // 1. Mirror to campaigns table
        const { error: campaignErr } = await supabaseAdmin.from('campaigns').insert([{
            title,
            description,
            sponsor_address: sponsor_address.toLowerCase(),
            platform_code: platform_code || 'farcaster',
            reward_amount_per_user: reward_amount_per_user.toString(),
            max_participants: parseInt(max_participants) || 100,
            status: 'active',
            created_at: new Date().toISOString()
        }]);

        if (campaignErr) throw campaignErr;

        // 2. Rich Activity Logging
        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Mission Creation',
            description: `Created sponsorship: ${title} (${tasks} tasks)`,
            amount: 2.0, // Platform fee in USDC (simplified)
            symbol: 'USDC',
            txHash,
            metadata: { title, tasks, platform: platform_code }
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('[SyncUgcMission Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleSyncUgcRaffle(req, res) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { raffle_id, end_time, max_tickets, winnerCount, txHash, depositETH } = payload;

        // 1. Mirror to raffles table
        const { error: raffleErr } = await supabaseAdmin.from('raffles').upsert({
            id: raffle_id,
            creator_address: wallet.toLowerCase(),
            sponsor_address: wallet.toLowerCase(),
            end_time,
            max_tickets: parseInt(max_tickets) || 100,
            is_active: true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (raffleErr) throw raffleErr;

        // 2. Rich Activity Logging
        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Raffle Launch',
            description: `Launched sponsored raffle #${raffle_id} with ${winnerCount} winner(s)`,
            amount: parseFloat(depositETH),
            symbol: 'ETH',
            txHash,
            metadata: { raffle_id, winnerCount, max_tickets }
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('[SyncUgcRaffle Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleSyncSbtUpgrade(req, res) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { tierName, ethSpent, txHash } = payload;
        const tierMap = { 'Bronze': 1, 'Silver': 2, 'Gold': 3, 'Platinum': 4, 'Diamond': 5 };
        const tierIndex = tierMap[tierName] || 0;

        // Update DB tier immediately for faster UI feedback
        if (tierIndex > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({ tier: tierIndex, updated_at: new Date().toISOString() })
                .eq('wallet_address', wallet.toLowerCase());
            
            if (updateError) console.error('[SyncSbtUpgrade] DB Update Error:', updateError);
        }

        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'SBT Tier Ascension',
            description: `Upgraded to ${tierName} Tier`,
            amount: parseFloat(ethSpent),
            symbol: 'ETH',
            txHash,
            metadata: { tierName, action: 'mint' }
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('[SyncSbtUpgrade Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleSyncPoolClaim(req, res) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { amountETH, tier, txHash } = payload;

        await logActivity({
            wallet,
            category: 'REWARD',
            type: 'Pool Sharing Claim',
            description: `Claimed ${parseFloat(amountETH).toFixed(6)} ETH from community pool`,
            amount: parseFloat(amountETH),
            symbol: 'ETH',
            txHash,
            metadata: { userTier: tier, source: 'community_pool' }
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('[SyncPoolClaim Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * logActivity: Internal helper to record events.
 */
async function logActivity({ wallet, category, type, description, amount, symbol, txHash, metadata }) {
    try {
        await supabaseAdmin.from('user_activity_logs').insert({
            wallet_address: wallet.toLowerCase(),
            category,
            activity_type: type,
            description,
            value_amount: amount || 0,
            value_symbol: symbol || 'XP',
            tx_hash: txHash,
            metadata: metadata || {}
        });
    } catch (err) {
        console.error('[logActivity Error]', err.message);
    }
}
