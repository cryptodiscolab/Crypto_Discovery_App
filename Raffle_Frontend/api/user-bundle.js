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
const MASTER_ADMINS = (process.env.VITE_ADMIN_WALLETS || process.env.ADMIN_ADDRESS || '').toLowerCase().split(',').filter(Boolean);

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
    const { wallet_address, signature, message } = req.body;
    if (!wallet_address || !signature || !message) {
        return res.status(400).json({ error: 'Missing sync data' });
    }

    try {
        // 1. Verify Signature
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet_address.toLowerCase();

        // 2. Fetch Profile & Underdog Settings (Zero-Hardcode)
        const [ { data: profile }, { data: settingsRes } ] = await Promise.all([
            supabaseAdmin
                .from('user_profiles')
                .select('total_xp, manual_xp_bonus, streak_count, last_streak_claim')
                .eq('wallet_address', cleanAddress)
                .maybeSingle(),
            supabaseAdmin
                .from('system_settings')
                .select('key, value')
                .in('key', ['underdog_bonus_multiplier_bp', 'underdog_activity_window_hours', 'underdog_max_tier'])
        ]);

        const settings = settingsRes?.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {}) || {};
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

            const onChainStats = stats;
            onChainXP = Number(onChainStats?.[0] || 0);
            xpDelta = onChainXP - dbLastPoints;

            if (xpDelta > 0) break; // Found gains!
            if (xpDelta < 0) break; // Found burn! (Still sync balance)

            attempts++;
            if (attempts < maxAttempts) {
                console.log(`[XP Sync] No change found for ${cleanAddress}. Retrying in 2s... (Attempt ${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        const currentTier = Number(onChainStats?.[3] || 0);

        // --- UNDERDOG BONUS LOGIC (PRD v3.3.3) ---
        let appliedBonusXP = 0;
        let isUnderdogEligible = false;

        if (xpDelta > 0) {
            const maxUnderdogTier = parseInt(settings.underdog_max_tier || process.env.UNDERDOG_MAX_TIER || '2');
            if (currentTier > 0 && currentTier <= maxUnderdogTier) {
                const windowHrs = parseInt(settings.underdog_activity_window_hours || process.env.UNDERDOG_WINDOW_HOURS || '48');
                const lastClaimAt = profile?.last_streak_claim ? new Date(profile.last_streak_claim) : null;
                
                // If never claimed, or claimed within window -> Eligible
                if (!lastClaimAt || (new Date() - lastClaimAt) / (1000 * 60 * 60) <= windowHrs) {
                    isUnderdogEligible = true;
                    const multiplierBP = parseInt(settings.underdog_bonus_multiplier_bp || process.env.UNDERDOG_MULTIPLIER_BP || '11000');
                    appliedBonusXP = Math.floor((xpDelta * (multiplierBP - 10000)) / 10000);
                    console.log(`[Underdog Bonus] Applying +${appliedBonusXP} XP to ${cleanAddress} (Tier ${currentTier})`);
                }
            }
        }
        // -----------------------------------------

        console.log(`[XP Sync] ${cleanAddress}: OnChain=${onChainXP}, Tier=${currentTier}, DB_Last=${dbLastPoints}, Delta=${xpDelta}${appliedBonusXP > 0 ? ` + Bonus=${appliedBonusXP}` : ''}`);

        // 4. Update Profile (Identity, Points Balance, Tier & Bonus)
        const profileUpdate = {
            wallet_address: cleanAddress,
            total_xp: onChainXP, // Raw on-chain balance
            manual_xp_bonus: (profile?.manual_xp_bonus || 0) + appliedBonusXP, // Increment bonus pool
            tier: currentTier,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Determine Task ID for the claim early to check for streaks
        const { data: dailySetting } = await supabaseAdmin
            .from('point_settings')
            .select('points_value')
            .eq('activity_key', 'daily_claim')
            .single();

        const standardDailyReward = dailySetting?.points_value;
        const isDailyClaim = xpDelta > 0 && xpDelta === standardDailyReward;
        const taskId = isDailyClaim
            ? TASK_IDS.DAILY_CLAIM_STREAK
            : TASK_IDS.DAILY_CLAIM_REWARD;

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

            // 6. Log to user_activity_logs (including bonus notification)
            await logActivity({
                wallet: cleanAddress,
                category: 'XP',
                type: taskId === TASK_IDS.DAILY_CLAIM_STREAK ? 'Daily Claim' : 'Contract Sync',
                description: `Earned ${xpDelta} XP from ${taskId === TASK_IDS.DAILY_CLAIM_STREAK ? 'Daily Bonus' : 'On-Chain Activity'}${appliedBonusXP > 0 ? ` + ${appliedBonusXP} Underdog Bonus` : ''}`,
                amount: xpDelta + appliedBonusXP,
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
        const response = await neynar.v2.fetchBulkUsersByEthOrSolAddress({ addresses: [address] });
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

        // 3. Force length limits — UNCONDITIONAL
        if (sanitizedPayload.display_name) sanitizedPayload.display_name = sanitizedPayload.display_name.substring(0, PROFILE_LIMITS.MAX_NAME_LEN);
        if (sanitizedPayload.username) sanitizedPayload.username = sanitizedPayload.username.substring(0, PROFILE_LIMITS.MAX_USERNAME_LEN);
        if (sanitizedPayload.bio) sanitizedPayload.bio = sanitizedPayload.bio.substring(0, PROFILE_LIMITS.MAX_BIO_LEN);
        if (sanitizedPayload.pfp_url) sanitizedPayload.pfp_url = sanitizedPayload.pfp_url.substring(0, 500); // URL length limit

        // 4. Size Validation: Validate avatar URL file size — only if pfp_url present
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
                console.warn(`[Profile Update] Failed to check image size for ${sanitizedPayload.pfp_url}:`, err.message);
                // Allow passing if HEAD request is blocked, relying on client-side constraints.
            }
        }

        // 5. Persist to DB — UNCONDITIONAL
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

        // Fetch Whitelisted Tokens
        const { data: whitelisted, error: wError } = await supabaseAdmin
            .from('whitelisted_tokens')
            .select('*')
            .eq('is_active', true);

        if (wError) {
            console.warn('[GetPointSettings] Whitelisted tokens error:', wError);
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

        // Inject Whitelisted Tokens (from fallback JSON if table missing)
        settings.whitelisted_tokens = settings.whitelisted_tokens_json || [];

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
            status: 'active',
            created_at: new Date().toISOString(),
            payment_token: payment_token || null,
            reward_symbol: reward_symbol || 'TOKEN'
        }]).select().single();

        if (campaignErr) throw campaignErr;

        // 2. Populate daily_tasks from tasks_batch
        if (tasks_batch && Array.isArray(tasks_batch)) {
            const tasksToInsert = tasks_batch.map(task => ({
                description: task.title,
                xp_reward: taskXpReward, // Dynamic XP for UGC tasks
                platform: task.platform || 'base',
                action_type: task.action_type || 'follow',
                link: task.link,
                is_active: true,
                task_type: 'ugc',
                onchain_id: campaign.id, // Link to campaign
                created_at: new Date().toISOString()
            }));

            const { error: tasksErr } = await supabaseAdmin.from('daily_tasks').insert(tasksToInsert);
            if (tasksErr) console.warn('[SyncUgcMission] Failed to populate daily_tasks:', tasksErr);
        }

        // 3. Rich Activity Logging
        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Mission Creation',
            description: `Created sponsorship: ${title} (${tasks_batch?.length || 0} tasks)`,
            amount: platformFee, // Dynamic Platform fee in USDC
            symbol: 'USDC',
            txHash,
            metadata: { title, tasks: tasks_batch?.length || 0, platform: platform_code }
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

        // Bug Fix: Destructure all payload fields before use (was causing ReferenceError 500)
        const { raffle_id, depositETH, end_time, max_tickets, metadata_uri, extra_metadata, winnerCount } = payload;

        const { data: sysSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'raffle_platform_fee_percent').maybeSingle();
        const platformFeePercent = sysSetting?.value ? parseFloat(sysSetting.value) : 5; // Fallback only to calculate from passed deposit if setting missing
        const feeMultiplier = 1 + (platformFeePercent / 100);
        const prizePool = depositETH ? parseFloat(depositETH) / feeMultiplier : 0;

        // 1. Mirror to raffles table
        const { error: raffleErr } = await supabaseAdmin.from('raffles').upsert({
            id: raffle_id,
            creator_address: wallet.toLowerCase(),
            sponsor_address: wallet.toLowerCase(),
            end_time: end_time ? new Date(end_time * 1000).toISOString() : null,
            max_tickets: parseInt(max_tickets),
            prize_pool: prizePool,
            metadata_uri: metadata_uri || null,
            is_active: true,
            // Rich Metadata mapping
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

        // 2. Award Creator XP for Raffle Launch
        try {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_create').single();
            if (setting?.points_value) {
                let creatorXp = setting.points_value;

                // 🛡️ Apply Tier Multiplier
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
                } else if (claimErr.code !== '23505') {
                    console.warn('[SyncUgcRaffle] XP Award Warning:', claimErr);
                }
            }
        } catch (xpErr) {
            console.error('[SyncUgcRaffle] XP Award Error:', xpErr);
        }

        // 3. Increment raffles_created counter
        await supabaseAdmin.rpc('fn_increment_raffles_created', { p_wallet: wallet.toLowerCase() });

        // 4. Rich Activity Logging
        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Raffle Launch',
            description: `Launched sponsored raffle: ${extra_metadata?.title || raffle_id}`,
            amount: parseFloat(depositETH),
            symbol: 'ETH',


            txHash,
            metadata: { 
                raffle_id, 
                winnerCount, 
                max_tickets,
                title: extra_metadata?.title,
                category: extra_metadata?.category
            }
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
        const tierMap = {
            'Bronze': 1,
            'Silver': 2,
            'Gold': 3,
            'Platinum': 4,
            'Diamond': 5
        };
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

/**
 * handleLeaderboard: Fetch top users from the unified profile view.
 */
async function handleLeaderboard(req, res) {
    try {
        const { limit = 100, tier } = req.query;
        
        let query = supabaseAdmin
            .from('v_user_full_profile')
            .select('*')
            .order('total_xp', { ascending: false })
            .limit(parseInt(limit));

        if (tier && tier !== 'All') {
            query = query.eq('rank_name', tier);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json(data);
    } catch (error) {
        console.error('[Leaderboard Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * handleSyncOAuth: Binds a Google or X (Twitter) OAuth identity to a wallet.
 * Zero-Trust: Requires EIP-191 wallet signature PLUS the OAuth token data.
 * Enforces 1 Account : 1 Wallet (Sybil Lock).
 */
async function handleSyncOAuth(req, res) {
    const { wallet_address, signature, message, provider, oauth_data } = req.body;

    if (!wallet_address || !signature || !message || !provider || !oauth_data) {
        return res.status(400).json({ error: 'Missing required OAuth sync fields' });
    }

    // 1. Zero-Trust Wallet Signature
    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid wallet signature' });
    } catch (err) {
        return res.status(401).json({ error: 'Signature verification failed' });
    }

    const normalizedWallet = wallet_address.toLowerCase();

    try {
        if (provider === 'google') {
            const { google_id, google_email, name, pfp_url } = oauth_data;
            if (!google_id || !google_email) return res.status(400).json({ error: 'Missing Google identity fields' });

            // Sybil Check: Ensure this google_id is not linked to another wallet
            const { data: existing } = await supabaseAdmin
                .from('user_profiles')
                .select('wallet_address')
                .eq('google_id', google_id)
                .maybeSingle();

            if (existing && existing.wallet_address !== normalizedWallet) {
                return res.status(409).json({ error: 'This Google account is already linked to another wallet.' });
            }

            const updateData = {
                google_id,
                google_email,
                oauth_provider: 'google',
                updated_at: new Date().toISOString()
            };
            // Auto-populate profile fields if not yet set
            if (name) updateData.display_name = name.substring(0, 50);
            if (pfp_url) updateData.pfp_url = pfp_url.substring(0, 500);

            await supabaseAdmin
                .from('user_profiles')
                .update(updateData)
                .eq('wallet_address', normalizedWallet);

            await logActivity({
                wallet: normalizedWallet,
                category: 'SOCIAL',
                type: 'Identity Link',
                description: `Linked Google account: ${google_email}`,
                metadata: { provider: 'google', email: google_email }
            });

            console.log(`[OAuth] Google account linked: ${google_email} → ${normalizedWallet}`);
            return res.status(200).json({ success: true, provider: 'google', email: google_email });

        } else if (provider === 'x') {
            const { twitter_id, twitter_username, name, pfp_url } = oauth_data;
            if (!twitter_id || !twitter_username) return res.status(400).json({ error: 'Missing X identity fields' });

            // Sybil Check: Ensure this twitter_id is not linked to another wallet
            const { data: existing } = await supabaseAdmin
                .from('user_profiles')
                .select('wallet_address')
                .eq('twitter_id', twitter_id)
                .maybeSingle();

            if (existing && existing.wallet_address !== normalizedWallet) {
                return res.status(409).json({ error: 'This X (Twitter) account is already linked to another wallet.' });
            }

            const updateData = {
                twitter_id,
                twitter_username,
                oauth_provider: 'x',
                updated_at: new Date().toISOString()
            };
            // Auto-populate profile fields if not yet set
            if (name) updateData.display_name = name.substring(0, 50);
            if (pfp_url) updateData.pfp_url = pfp_url.substring(0, 500);

            await supabaseAdmin
                .from('user_profiles')
                .update(updateData)
                .eq('wallet_address', normalizedWallet);

            await logActivity({
                wallet: normalizedWallet,
                category: 'SOCIAL',
                type: 'Identity Link',
                description: `Linked X account: @${twitter_username}`,
                metadata: { provider: 'x', username: twitter_username }
            });

            console.log(`[OAuth] X account linked: @${twitter_username} → ${normalizedWallet}`);
            return res.status(200).json({ success: true, provider: 'x', username: twitter_username });

        } else {
            return res.status(400).json({ error: `Unsupported OAuth provider: ${provider}` });
        }
    } catch (error) {
        console.error('[SyncOAuth Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
