import { createClient } from '@supabase/supabase-js';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { createPublicClient, http, verifyMessage } from 'viem';
import { baseSepolia } from 'viem/chains';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim();
const neynarApiKey = (process.env.NEYNAR_API_KEY || '').trim();

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const neynar = new NeynarAPIClient({ apiKey: neynarApiKey || '' });

const rpcClient = createPublicClient({
    chain: baseSepolia,
    transport: http((process.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org').trim()),
});

const DAILY_APP_ADDRESS = (
    process.env.DAILY_APP_ADDRESS_SEPOLIA ||
    process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA ||
    process.env.VITE_V12_CONTRACT_ADDRESS ||
    process.env.DAILY_APP_ADDRESS
)?.trim() || '';

const TASK_IDS = {
    REFERRAL_INVITE: (process.env.REFERRAL_INVITE_TASK_ID || '77e123f5-0ded-4ca1-af04-e8b6924823e2').trim(),
    DAILY_CLAIM_STREAK: (process.env.DAILY_CLAIM_STREAK_TASK_ID || '288596d8-b5a9-4faf-bde0-0dd28aaba902').trim(),
    DAILY_CLAIM_REWARD: (process.env.DAILY_CLAIM_REWARD_TASK_ID || '885535d2-4c5c-4a80-9af5-36666192c244').trim()
};

const PROFILE_LIMITS = {
    MAX_NAME_LEN: parseInt(process.env.MAX_NAME_LEN || '50'),
    MAX_BIO_LEN: parseInt(process.env.MAX_BIO_LEN || '160'),
    MAX_USERNAME_LEN: parseInt(process.env.MAX_USERNAME_LEN || '30'),
    MAX_AVATAR_BYTES: parseInt(process.env.MAX_AVATAR_BYTES || '1048576') // 1MB
};
const MASTER_ADMINS = (process.env.VITE_ADMIN_WALLETS || process.env.VITE_ADMIN_ADDRESS || process.env.ADMIN_ADDRESS || '').toLowerCase().split(',').filter(Boolean);

async function isAuthorizedAdmin(walletAddress) {
    if (!walletAddress) return false;
    const clean = walletAddress.toLowerCase();
    
    // 1. Env Bootstrap (High Priority)
    if (MASTER_ADMINS.includes(clean)) return true;
    
    // 2. Database Registry (Centralized Dashboard Control)
    const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('wallet_address', clean)
        .maybeSingle();
    
    if (error || !data) return false;
    return !!data.is_admin;
}

// Resilience v3.21.0: Circuit Breaker Patterns
const BREAK_COOLDOWN = 5 * 60 * 1000; // 5 minutes

async function checkBreaker(serviceKey) {
    const { data } = await supabaseAdmin
        .from('system_health')
        .select('*')
        .eq('service_key', serviceKey)
        .single();
    
    if (data?.status === 'failed') {
        const lastUpdate = new Date(data.updated_at).getTime();
        if (Date.now() - lastUpdate < BREAK_COOLDOWN) {
            console.warn(`[CircuitBreaker] Breaker OPEN for ${serviceKey}.`);
            return false;
        }
    }
    return true;
}

async function reportHealth(serviceKey, status, error = null) {
    try {
        await supabaseAdmin.from('system_health').upsert({
            service_key: serviceKey,
            status,
            last_heartbeat: new Date().toISOString(),
            last_error: error,
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });
    } catch (e) { console.error(`[Health] Failed to report for ${serviceKey}`, e); }
}

// Resilience v3.20.0: Circuit Breaker / Retry Helper
async function fetchWithRetry(fn, serviceKey, retries = 3, delay = 1000) {
    const isOpen = await checkBreaker(serviceKey);
    if (!isOpen) throw new Error(`${serviceKey} connection currently suspended (Circuit Breaker)`);

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fn();
            await reportHealth(serviceKey, 'healthy');
            return res;
        } catch (err) {
            if (i === retries - 1) {
                await reportHealth(serviceKey, 'failed', err.message);
                throw err;
            }
            const backoff = delay * Math.pow(2, i);
            console.warn(`[Retry] ${serviceKey} attempt ${i + 1} failed. Re-trying in ${backoff}ms...`, err.message);
            await new Promise(resolve => setTimeout(resolve, backoff));
        }
    }
}

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
        case 'leaderboard':
            return handleLeaderboard(req, res);
        case 'sync-oauth':
            return handleSyncOAuth(req, res);
        case 'approve-mission': // v3.20.0: Admin Governance
            return handleApproveMission(req, res);
        case 'approve-raffle': // v3.38.3: UGC Hardening
            return handleApproveRaffle(req, res);
        case 'check-admin':
            return handleCheckAdmin(req, res);
        case 'pending-missions':
            return handleFetchPendingMissions(req, res);
        case 'pending-raffles': // v3.38.3: UGC Hardening
            return handleFetchPendingRaffles(req, res);
        case 'get-health':
            return handleGetHealth(req, res);
        case 'reset-health':
            return handleResetHealth(req, res);
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

        // 5. REFERRAL REWARD: If this is a new user and they were referred, award points to the referrer
        if (!existing && updateData.referred_by) {
            try {
                const { data: refSetting } = await supabaseAdmin
                    .from('point_settings')
                    .select('points_value')
                    .eq('activity_key', 'referral_invite')
                    .single();

                if (refSetting?.points_value) {
                    const refReward = refSetting.points_value;

                    await supabaseAdmin.from('user_task_claims').insert({
                        wallet_address: updateData.referred_by,
                        task_id: TASK_IDS.REFERRAL_INVITE, // System: Referral Invitation
                        xp_earned: refReward,
                        claimed_at: new Date().toISOString(),
                        platform: 'system',
                        action_type: 'referral_bonus'
                    });

                    // Log activity for the referrer
                    await logActivity({
                        wallet: updateData.referred_by,
                        category: 'XP',
                        type: 'Referral Bonus',
                        description: `Earned ${refReward} XP for inviting ${cleanAddress}`,
                        amount: refReward,
                        symbol: 'XP',
                        metadata: { invited_user: cleanAddress }
                    });

                    console.log(`[Referral] Credited ${updateData.referred_by} with ${refReward} XP for inviting ${cleanAddress}`);
                }
            } catch (refErr) {
                console.error('[Referral] Failed to credit referrer:', refErr.message);
            }
        }

        return res.status(200).json({ success: true, profile: data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleXpSync(req, res) {
    const { wallet_address, signature, message, tx_hash } = req.body;
    if (!wallet_address) return res.status(400).json({ error: 'Missing wallet' });

    try {
        const cleanAddress = wallet_address.toLowerCase();
        let skipSignature = false;

        // 1. "Verification-First" Logic: Use tx_hash as primary proof if available
        if (tx_hash) {
            try {
                // Wait for finality (Resilience v3.26+)
                const receipt = await rpcClient.waitForTransactionReceipt({ hash: tx_hash });
                if (receipt?.status === 'success' && receipt.from.toLowerCase() === cleanAddress) {
                    skipSignature = true;
                    console.log(`[XP Sync] Proof of work verified via txHash: ${tx_hash}`);
                }
            } catch (hashErr) {
                console.warn(`[XP Sync] TxHash verification failed, falling back to signature:`, hashErr.message);
            }
        }

        // 2. Signature Fallback
        if (!skipSignature) {
            if (!signature || !message) {
                return res.status(401).json({ error: 'Signature or valid Transaction Hash required' });
            }
            const valid = await verifyMessage({ address: wallet_address, message, signature });
            if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        }

        // 3. Fetch Profile & Settings
        const [ { data: profile }, { data: settingsRes } ] = await Promise.all([
            supabaseAdmin
                .from('user_profiles')
                .select('total_xp, manual_xp_bonus, streak_count, last_streak_claim')
                .eq('wallet_address', cleanAddress)
                .maybeSingle(),
            supabaseAdmin
                .from('system_settings')
                .select('key, value')
                .in('key', ['underdog_bonus_multiplier_bp', 'underdog_activity_window_hours', 'underdog_threshold_xp'])
        ]);

        const settings = settingsRes?.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {}) || {};
        const dbLastPoints = profile?.total_xp || 0;

        let onChainXP = 0;
        let xpDelta = 0;
        let onChainStats;

        // 4. Fetch On-Chain State
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

        onChainStats = stats;
        onChainXP = Number(onChainStats?.[0] || 0);
        xpDelta = onChainXP - dbLastPoints;

        // 5. Handling RPC Lag via TxHash
        const { data: dailySetting } = await supabaseAdmin
            .from('point_settings')
            .select('points_value')
            .eq('activity_key', 'daily_claim')
            .single();

        const standardDailyReward = dailySetting?.points_value || 100;

        // If RPC balance hasn't moved but we have a proven tx_hash, force incremental delta
        if (xpDelta === 0 && tx_hash && skipSignature) {
            xpDelta = standardDailyReward;
            onChainXP = dbLastPoints + xpDelta;
            console.log(`[XP Sync Fallback] Forced +${xpDelta} XP due to RPC lag/TxHash confirmation.`);
        }

        const currentTier = Number(onChainStats?.[3] || 0);

        // 6. Underdog Bonus Calculation
        let appliedBonusXP = 0;
        if (xpDelta > 0) {
            const underdogThreshold = parseInt(settings.underdog_threshold_xp || '0');
            if (dbLastPoints <= underdogThreshold) {
                const windowHrs = parseInt(settings.underdog_activity_window_hours || '48');
                const lastClaimAt = profile?.last_streak_claim ? new Date(profile.last_streak_claim) : null;
                
                if (!lastClaimAt || (new Date() - lastClaimAt) / (1000 * 60 * 60) <= windowHrs) {
                    const multiplierBP = parseInt(settings.underdog_bonus_multiplier_bp || '11000');
                    appliedBonusXP = Math.floor((xpDelta * (multiplierBP - 10000)) / 10000);
                }
            }
        }

        // 7. Update User Profile explicitly (By-passing flaky triggers)
        const profileUpdate = {
            wallet_address: cleanAddress,
            total_xp: onChainXP,
            manual_xp_bonus: (profile?.manual_xp_bonus || 0) + appliedBonusXP,
            tier: currentTier,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const isDailyClaim = xpDelta > 0 && xpDelta === standardDailyReward;
        const taskId = isDailyClaim ? TASK_IDS.DAILY_CLAIM_STREAK : TASK_IDS.DAILY_CLAIM_REWARD;

        if (isDailyClaim) {
            const now = new Date();
            const lastClaimDate = profile?.last_streak_claim ? new Date(profile.last_streak_claim) : null;
            let currentStreak = profile?.streak_count || 0;

            if (!lastClaimDate) {
                currentStreak = 1;
            } else {
                const diffHours = (now - lastClaimDate) / (1000 * 60 * 60);
                if (diffHours >= 20 && diffHours <= 48) {
                    currentStreak += 1;
                } else if (diffHours > 48) {
                    currentStreak = 1;
                }
            }
            profileUpdate.streak_count = currentStreak;
            profileUpdate.last_streak_claim = now.toISOString();
        }

        await supabaseAdmin
            .from('user_profiles')
            .upsert(profileUpdate, { onConflict: 'wallet_address' });

        // 8. Log individual claim for historical record
        if (xpDelta > 0) {
            await supabaseAdmin.from('user_task_claims').insert({
                wallet_address: cleanAddress,
                task_id: taskId,
                xp_earned: xpDelta,
                claimed_at: new Date().toISOString(),
                platform: 'blockchain',
                action_type: tx_hash ? 'verified_claim' : 'polled_sync',
                target_id: tx_hash || null
            });

            await logActivity({
                wallet: cleanAddress,
                category: 'XP',
                type: isDailyClaim ? 'Daily Claim' : 'Contract Sync',
                description: `Earned ${xpDelta} XP from ${isDailyClaim ? 'Daily Bonus' : 'On-Chain Activity'}${appliedBonusXP > 0 ? ` + ${appliedBonusXP} Underdog Bonus` : ''}`,
                amount: xpDelta + appliedBonusXP,
                symbol: 'XP',
                txHash: tx_hash || null
            });
        }

        console.log(`[XP Sync Audit] Address: ${cleanAddress} | Contract: ${DAILY_APP_ADDRESS} | Delta: ${xpDelta} | Underdog: ${appliedBonusXP}`);

        return res.status(200).json({ 
            ok: true, 
            xp: onChainXP, 
            total_xp: profileUpdate.total_xp + (profileUpdate.manual_xp_bonus || 0),
            streak_count: profileUpdate.streak_count,
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
        const valid = await verifyMessage({ address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        
        // Resilience v3.21.0: Circuit Breaker + Backoff
        const response = await fetchWithRetry(
            () => neynar.v2.fetchBulkUsersByEthOrSolAddress({ addresses: [address] }),
            'neynar-api'
        );
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
        const valid = await verifyMessage({ address: wallet, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const sanitizedPayload = { ...payload };
        delete sanitizedPayload.is_admin;
        delete sanitizedPayload.wallet_address;
        delete sanitizedPayload.total_xp;
        delete sanitizedPayload.referred_by;
        delete sanitizedPayload.tier;

        if (sanitizedPayload.display_name) sanitizedPayload.display_name = sanitizedPayload.display_name.substring(0, PROFILE_LIMITS.MAX_NAME_LEN);
        if (sanitizedPayload.username) sanitizedPayload.username = sanitizedPayload.username.substring(0, PROFILE_LIMITS.MAX_USERNAME_LEN);
        if (sanitizedPayload.bio) sanitizedPayload.bio = sanitizedPayload.bio.substring(0, PROFILE_LIMITS.MAX_BIO_LEN);
        if (sanitizedPayload.pfp_url) sanitizedPayload.pfp_url = sanitizedPayload.pfp_url.substring(0, 500);

        if (sanitizedPayload.pfp_url) {
            try {
                const imgRes = await fetch(sanitizedPayload.pfp_url, { method: 'HEAD' });
                if (imgRes.ok) {
                    const contentLength = imgRes.headers.get('content-length');
                    if (contentLength && parseInt(contentLength, 10) > PROFILE_LIMITS.MAX_AVATAR_BYTES) {
                        return res.status(400).json({ error: `Avatar image size exceeds the ${Math.floor(PROFILE_LIMITS.MAX_AVATAR_BYTES / 1024 / 1024)}MB limit.` });
                    }
                }
            } catch (err) {
                console.warn(`[Profile Update] Failed to check image size:`, err.message);
            }
        }

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

        // Fetch Allowed Tokens (Unified name for whitelisted_tokens)
        const { data: allowedTokens, error: wError } = await supabaseAdmin
            .from('allowed_tokens')
            .select('*')
            .eq('is_active', true);

        if (wError) {
            console.warn('[GetPointSettings] Allowed tokens error:', wError);
        }

        // Convert Reward Points to simple object
        const settings = points.reduce((acc, curr) => {
            acc[curr.activity_key] = curr.points_value;
            return acc;
        }, {});

        // Inject System Settings
        system.forEach(s => {
            settings[s.key] = s.value;
        });

        // Inject Allowed/Whitelisted Tokens (Unified name for frontend)
        const tokenList = (allowedTokens && allowedTokens.length > 0)
            ? allowedTokens
            : (settings.whitelisted_tokens_json || []);
            
        settings.allowed_tokens = tokenList;
        settings.whitelisted_tokens = tokenList;

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

        const { title, description, sponsor_address, platform_code, reward_amount_per_user, max_participants, txHash, tasks_batch, reward_symbol, payment_token } = payload;

        // Get dynamic platform fee and XP settings
        const [{ data: sysSetting }, { data: pointSetting }] = await Promise.all([
            supabaseAdmin.from('system_settings').select('value').eq('key', 'sponsorship_listing_fee_usdc').single(),
            supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'ugc_task_completion').maybeSingle()
        ]);
        const platformFee = sysSetting?.value ? parseFloat(sysSetting.value) : 0;
        const taskXpReward = pointSetting?.points_value || 0;

        // 1. Mirror to campaigns table
        const { data: campaign, error: campaignErr } = await supabaseAdmin.from('campaigns').insert([{
            title,
            description,
            sponsor_address: sponsor_address.toLowerCase(),
            platform_code: platform_code || 'farcaster',
            reward_amount_per_user: reward_amount_per_user.toString(),
            max_participants: parseInt(max_participants),
            status: 'pending', // v3.20.0: Default to pending for admin moderation
            created_at: new Date().toISOString(),
            payment_token: payment_token || null,
            reward_symbol: reward_symbol || 'TOKEN'
        }]).select().single();

        if (campaignErr) throw campaignErr;

        // 2. Populate daily_tasks from tasks_batch
        if (tasks_batch && Array.isArray(tasks_batch)) {
            const tasksToInsert = tasks_batch.map(task => ({
                description: task.title,
                xp_reward: taskXpReward,
                platform: task.platform || 'base',
                action_type: task.action_type || 'follow',
                link: task.link,
                is_active: false, // v3.20.0: Default to false for admin moderation
                task_type: 'ugc',
                onchain_id: campaign.id,
                creator_address: wallet.toLowerCase(),
                created_at: new Date().toISOString()
            }));

            const { error: tasksErr } = await supabaseAdmin.from('daily_tasks').insert(tasksToInsert);
            if (tasksErr) console.warn('[SyncUgcMission] Failed to populate daily_tasks:', tasksErr);
        }

        // 3. Award XP to Sponsor (Creator)
        try {
            const { data: sponsorPoints } = await supabaseAdmin
                .from('point_settings')
                .select('points_value')
                .eq('activity_key', 'sponsor_task')
                .single();
            
            if (sponsorPoints?.points_value) {
                let creatorXp = sponsorPoints.points_value;
                const multiplier = await getUserMultiplier(wallet);
                creatorXp = Math.floor((creatorXp * multiplier) / 10000);

                await supabaseAdmin.from('user_task_claims').insert({
                    wallet_address: wallet.toLowerCase(),
                    task_id: `ugc_mission_create_${campaign.id}`,
                    xp_earned: creatorXp,
                    platform: 'system',
                    action_type: 'sponsor_task',
                    target_id: String(campaign.id)
                });

                await logActivity({
                    wallet,
                    category: 'XP',
                    type: 'UGC Mission Bonus',
                    description: `Earned ${creatorXp} XP for creating mission: ${title}`,
                    amount: creatorXp,
                    symbol: 'XP',
                    txHash,
                    metadata: { campaign_id: campaign.id }
                });
            }
        } catch (xpErr) {
            console.warn('[SyncUgcMission] Failed to award sponsor XP:', xpErr.message);
        }

        // 4. Record Listing Fee Payment Activity
        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Mission Creation',
            description: `Paid fees for sponsorship: ${title} (${tasks_batch?.length || 0} tasks)`,
            amount: platformFee,
            symbol: 'USDC',
            txHash,
            metadata: { title, tasks: tasks_batch?.length || 0, platform: platform_code, campaign_id: campaign.id }
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

        const { raffle_id, depositETH, end_time, max_tickets, metadata_uri, extra_metadata, winnerCount, txHash } = payload;

        const { data: sysSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'raffle_platform_fee_percent').maybeSingle();
        const platformFeePercent = sysSetting?.value ? parseFloat(sysSetting.value) : 5;
        const feeMultiplier = 1 + (platformFeePercent / 100);
        const prizePool = depositETH ? parseFloat(depositETH) / feeMultiplier : 0;

        const { error: raffleErr } = await supabaseAdmin.from('raffles').upsert({
            id: raffle_id,
            creator_address: wallet.toLowerCase(),
            sponsor_address: wallet.toLowerCase(),
            end_time: end_time ? new Date(end_time * 1000).toISOString() : null,
            max_tickets: parseInt(max_tickets),
            prize_pool: prizePool,
            metadata_uri: metadata_uri || null,
            is_active: false, // MODERATION: Default to inactive for admin review
            title: extra_metadata?.title || null,
            description: extra_metadata?.description || null,
            image_url: extra_metadata?.image || null,
            category: extra_metadata?.category || 'NFT',
            external_link: extra_metadata?.external_link || null,
            twitter_link: extra_metadata?.twitter || null,
            min_sbt_level: extra_metadata?.min_sbt_level || 0,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (raffleErr) throw raffleErr;

        try {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_create').single();
            if (setting?.points_value) {
                let creatorXp = setting.points_value;
                const { data: profile } = await supabaseAdmin.from('user_profiles').select('tier').eq('wallet_address', wallet.toLowerCase()).single();
                const tier = profile?.tier || 0;
                if (tier > 0) {
                    const { data: multSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'tier_multipliers').single();
                    const multipliers = multSetting?.value || {};
                    const mult = parseInt(multipliers[tier]) || 10000;
                    creatorXp = Math.floor((creatorXp * mult) / 10000);
                }

                const { error: claimErr } = await supabaseAdmin.from('user_task_claims').insert({
                    wallet_address: wallet.toLowerCase(),
                    task_id: `raffle_create_${raffle_id}`,
                    xp_earned: creatorXp,
                    platform: 'system',
                    action_type: 'raffle_create',
                    target_id: String(raffle_id)
                });

                if (!claimErr) {
                    await logActivity({
                        wallet,
                        category: 'XP',
                        type: 'Task Verify',
                        description: `Awarded ${creatorXp} XP for Creating Raffle #${raffle_id}`,
                        amount: creatorXp,
                        symbol: 'XP',
                        txHash
                    });
                }
            }
        } catch (xpErr) {
            console.error('[SyncUgcRaffle] XP Award Error:', xpErr);
        }

        await supabaseAdmin.rpc('fn_increment_raffles_created', { p_wallet: wallet.toLowerCase() });

        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Raffle Launch',
            description: `Launched sponsored raffle: ${extra_metadata?.title || raffle_id}`,
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
        
        // 1. Fetch dynamic tier mapping from sbt_thresholds
        const { data: thresholds } = await supabaseAdmin
            .from('sbt_thresholds')
            .select('level, tier_name');
            
        const tierMap = thresholds?.reduce((acc, t) => {
            if (t.tier_name) acc[t.tier_name] = t.level;
            return acc;
        }, {}) || {};

        const tierIndex = tierMap[tierName] || 0;

        if (tierIndex > 0) {
            await supabaseAdmin
                .from('user_profiles')
                .update({ tier: tierIndex, updated_at: new Date().toISOString() })
                .eq('wallet_address', wallet.toLowerCase());
        }

        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'SBT Tier Ascension',
            description: `Upgraded to ${tierName} Tier`,
            amount: parseFloat(ethSpent),
            symbol: 'ETH',
            txHash,
            metadata: { tierName }
        });

        return res.status(200).json({ success: true });
    } catch (error) {
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
            metadata: { userTier: tier }
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

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

async function handleLeaderboard(req, res) {
    try {
        const { limit = 100, tier } = req.query;
        let query = supabaseAdmin
            .from('v_user_full_profile')
            .select('*')
            .order('total_xp', { ascending: false })
            .limit(parseInt(limit));

        if (tier && tier !== 'All') query = query.eq('rank_name', tier);

        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleSyncOAuth(req, res) {
    const { wallet_address, signature, message, provider, oauth_data } = req.body;
    if (!wallet_address || !signature || !message || !provider || !oauth_data) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const normalizedWallet = wallet_address.toLowerCase();

        if (provider === 'google') {
            const { google_id, google_email, name, pfp_url } = oauth_data;
            const { data: existing } = await supabaseAdmin.from('user_profiles').select('wallet_address').eq('google_id', google_id).maybeSingle();
            if (existing && existing.wallet_address !== normalizedWallet) return res.status(409).json({ error: 'Already linked' });

            await supabaseAdmin.from('user_profiles').update({ google_id, google_email, oauth_provider: 'google', updated_at: new Date().toISOString() }).eq('wallet_address', normalizedWallet);
            await logActivity({ wallet: normalizedWallet, category: 'SOCIAL', type: 'Identity Link', description: `Linked Google: ${google_email}` });
            return res.status(200).json({ success: true });
        } else if (provider === 'x') {
            const { twitter_id, twitter_username } = oauth_data;
            const { data: existing } = await supabaseAdmin.from('user_profiles').select('wallet_address').eq('twitter_id', twitter_id).maybeSingle();
            if (existing && existing.wallet_address !== normalizedWallet) return res.status(409).json({ error: 'Already linked' });

            await supabaseAdmin.from('user_profiles').update({ twitter_id, twitter_username, oauth_provider: 'x', updated_at: new Date().toISOString() }).eq('wallet_address', normalizedWallet);
            await logActivity({ wallet: normalizedWallet, category: 'SOCIAL', type: 'Identity Link', description: `Linked X: @${twitter_username}` });
            return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Invalid provider' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleApproveMission(req, res) {
    const { wallet, signature, message, mission_id } = req.body;
    if (!wallet || !signature || !message || !mission_id) return res.status(400).json({ error: 'Missing mission approval data' });

    try {
        const valid = await verifyMessage({ address: wallet, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet.toLowerCase();
        const isAdmin = await isAuthorizedAdmin(cleanAddress);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Unauthorized: Admin only' });
        }

        // 1. Update daily_tasks
        const { error: taskErr } = await supabaseAdmin
            .from('daily_tasks')
            .update({ is_active: true })
            .eq('id', mission_id);

        if (taskErr) throw taskErr;

        // 2. Log Admin Action
        await supabaseAdmin.from('admin_audit_logs').insert({
            admin_address: cleanAddress,
            action: 'UGC_APPROVE_MISSION',
            details: { mission_id, approved_at: new Date().toISOString() }
        });

        await logActivity({
            wallet: cleanAddress,
            category: 'ADMIN',
            type: 'UGC Approval',
            description: `Approved UGC mission ID: ${mission_id}`,
            metadata: { mission_id }
        });

        return res.status(200).json({ success: true, message: 'Mission approved and activated' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleApproveRaffle(req, res) {
    const { wallet, signature, message, raffle_id } = req.body;
    if (!wallet || !signature || !message || !raffle_id) return res.status(400).json({ error: 'Missing raffle approval data' });

    try {
        const valid = await verifyMessage({ address: wallet, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet.toLowerCase();
        const isAdmin = await isAuthorizedAdmin(cleanAddress);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Unauthorized: Admin only' });
        }

        const { error } = await supabaseAdmin
            .from('raffles')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('id', raffle_id);

        if (error) throw error;

        // Log Admin Action
        await supabaseAdmin.from('admin_audit_logs').insert({
            admin_address: cleanAddress,
            action: 'UGC_APPROVE_RAFFLE',
            details: { raffle_id, approved_at: new Date().toISOString() }
        });

        await logActivity({
            wallet: cleanAddress,
            category: 'ADMIN',
            type: 'Raffle Approval',
            description: `Approved raffle ID: ${raffle_id}`,
            metadata: { raffle_id }
        });

        return res.status(200).json({ success: true, message: 'Raffle approved and activated' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
async function handleCheckAdmin(req, res) {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ isAdmin: false });
    const isAdmin = await isAuthorizedAdmin(wallet);
    return res.status(200).json({ isAdmin });
}

async function handleFetchPendingMissions(req, res) {
    const { wallet, signature, message } = req.query; // Actually req.body in POST, but my ModerationCenter uses POST. 
    // Wait, my handler uses req.body?.action || req.query?.action.
    const body = req.method === 'POST' ? req.body : req.query;
    const { wallet: w, signature: s, message: m } = body;

    if (!w || !s || !m) return res.status(401).json({ error: 'Missing auth for admin fetch' });

    try {
        const valid = await verifyMessage({ address: w, message: m, signature: s });
        const isAdmin = await isAuthorizedAdmin(w);
        if (!valid || !isAdmin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Fetch pending missions from daily_tasks (UGC)
        const { data, error } = await supabaseAdmin
            .from('daily_tasks')
            .select('*')
            .eq('is_active', false)
            .not('creator_address', 'is', null);

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleGetHealth(req, res) {
    try {
        const { data, error } = await supabaseAdmin
            .from('system_health')
            .select('*')
            .order('service_key');
        if (error) throw error;
        return res.status(200).json({ ok: true, health: data });
    } catch (e) { return res.status(500).json({ error: e.message }); }
}

async function handleResetHealth(req, res) {
    const { service_key } = req.body || {};
    if (!service_key) return res.status(400).json({ error: 'Missing service_key' });

    try {
        const { error } = await supabaseAdmin.from('system_health').upsert({
            service_key,
            status: 'healthy',
            last_heartbeat: new Date().toISOString(),
            last_error: null,
            metadata: { consecutive_success: 0, manual_reset_at: new Date().toISOString() },
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });

        if (error) throw error;
        
        // Log to Audit
        await supabaseAdmin.from('admin_audit_logs').insert({
            admin_address: 'ADMIN_MANUAL', // Ideally replace with current admin wallet if authenticated
            action: 'MANUAL_HEALTH_RESET',
            details: { service_key, reset_at: new Date().toISOString() }
        });

        return res.status(200).json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleFetchPendingRaffles(req, res) {
    const { wallet, signature, message } = req.query;
    if (!wallet || !signature || !message) return res.status(401).json({ error: 'Missing auth for admin fetch' });

    try {
        const valid = await verifyMessage({ address: wallet, message, signature });
        const isAdmin = await isAuthorizedAdmin(wallet);
        if (!valid || !isAdmin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabaseAdmin
            .from('raffles')
            .select('*')
            .eq('is_active', false);

        if (error) throw error;
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
