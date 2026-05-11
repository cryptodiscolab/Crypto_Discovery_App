import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { verifyMessage, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    NEYNAR_API_KEY,
    rpcClient,
    DAILY_APP_ADDRESS,
    RAFFLE_ADDRESS,
    RAFFLE_ABI,
    DAILY_APP_USER_STATS_ABI,
    TASK_IDS,
    PROFILE_LIMITS,
    MASTER_ADMINS,
    WALLET_BOT_SIGNER,
    CHAIN_ID,
    isMainnet
} from './constants';
import { 
    UserProfile, 
    DbUserProfile,
    UserActivityLog, 
    SyncPayload, 
    XpSyncPayload, 
    UpdateProfilePayload, 
    UgcMissionPayload, 
    UgcRafflePayload,
    Json
} from './types';

const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const neynar = new NeynarAPIClient({ apiKey: NEYNAR_API_KEY || '' });

// -----------------------------------------------------------------------------
// RESILIENCE & HEALTH (v3.21.0)
// -----------------------------------------------------------------------------
const BREAK_COOLDOWN = 5 * 60 * 1000; // 5 minutes

async function checkBreaker(serviceKey: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('system_health')
        .select('*')
        .eq('service_key', serviceKey)
        .maybeSingle();
    
    if (data?.status === 'failed') {
        const lastUpdate = new Date(data.updated_at || 0).getTime();
        if (Date.now() - lastUpdate < BREAK_COOLDOWN) {
            console.warn(`[CircuitBreaker] Breaker OPEN for ${serviceKey}.`);
            return false;
        }
    }
    return true;
}

async function reportHealth(serviceKey: string, status: string, error: string | null = null) {
    try {
        await supabaseAdmin.from('system_health').upsert({
            service_key: serviceKey,
            status,
            last_heartbeat: new Date().toISOString(),
            last_error: error,
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });
    } catch (e: unknown) { 
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Health] Failed to report for ${serviceKey}`, msg); 
    }
}

async function fetchWithRetry<T>(fn: () => Promise<T>, serviceKey: string, retries = 3, delay = 1000): Promise<T> {
    const isOpen = await checkBreaker(serviceKey);
    if (!isOpen) throw new Error(`${serviceKey} connection currently suspended (Circuit Breaker)`);

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fn();
            await reportHealth(serviceKey, 'healthy');
            return res;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (i === retries - 1) {
                await reportHealth(serviceKey, 'failed', msg);
                throw err;
            }
            const backoff = delay * Math.pow(2, i);
            console.warn(`[Retry] ${serviceKey} attempt ${i + 1} failed. Re-trying in ${backoff}ms...`, msg);
            await new Promise(resolve => setTimeout(resolve, backoff));
        }
    }
    throw new Error(`${serviceKey} failed after ${retries} retries`);
}

// -----------------------------------------------------------------------------
// FEATURE GUARDS
// -----------------------------------------------------------------------------
async function checkFeatureGuard(featureKey: string, res: VercelResponse): Promise<boolean> {
    if (!isMainnet) return true;
    
    try {
        const { data } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'active_features')
            .maybeSingle();
        
        const activeFeatures = (data?.value || {}) as Record<string, any>;
        if (activeFeatures[featureKey] !== true) {
            res.status(403).json({ error: `Feature [${featureKey}] is currently disabled.` });
            return false;
        }
        return true;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Feature Guard] Failed to verify ${featureKey}`, msg);
        res.status(500).json({ error: "Feature Guard verification failed" });
        return false;
    }
}

// -----------------------------------------------------------------------------
// MAIN HANDLER
// -----------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.body?.action || req.query?.action;

    if (['xp', 'sync-pool-claim'].includes(action)) {
        if (!(await checkFeatureGuard('daily_claim', res))) return;
    }
    
    if (['sync-sbt-upgrade'].includes(action)) {
        if (!(await checkFeatureGuard('sbt_minting', res))) return;
    }

    if (['sync-ugc-mission', 'sync-ugc-raffle'].includes(action)) {
        if (!(await checkFeatureGuard('ugc_payment', res))) return;
    }

    if (['sync', 'update-profile', 'fc-sync'].includes(action)) {
        if (!(await checkFeatureGuard('login_and_social', res))) return;
    }

    switch (action) {
        case 'sync': await handleLoginSync(req, res); break;
        case 'xp': await handleXpSync(req, res); break;
        case 'fc-sync': await handleFarcasterSync(req, res); break;
        case 'update-profile': await handleUpdateProfile(req, res); break;
        case 'get-activity-logs': await handleGetActivityLogs(req, res); break;
        case 'log-activity': await handleFrontendLogActivity(req, res); break;
        case 'get-point-settings': await handleGetPointSettings(req, res); break;
        case 'sync-ugc-mission': await handleSyncUgcMission(req, res); break;
        case 'sync-ugc-raffle': await handleSyncUgcRaffle(req, res); break;
        case 'sync-sbt-upgrade': await handleSyncSbtUpgrade(req, res); break;
        case 'sync-pool-claim': await handleSyncPoolClaim(req, res); break;
        case 'leaderboard': await handleLeaderboard(req, res); break;
        case 'sync-oauth': await handleSyncOAuth(req, res); break;
        case 'sync-base-social': await handleSyncBaseSocial(req, res); break;
        case 'approve-mission': await handleApproveMission(req, res); break;
        case 'approve-raffle': await handleApproveRaffle(req, res); break;
        case 'reject-raffle': await handleRejectRaffle(req, res); break;
        case 'check-admin': await handleCheckAdmin(req, res); break;
        case 'pending-missions': await handleFetchPendingMissions(req, res); break;
        case 'pending-raffles': await handleFetchPendingRaffles(req, res); break;
        case 'get-health': await handleGetHealth(req, res); break;
        case 'reset-health': await handleResetHealth(req, res); break;
        case 'generate-sync-signature': await handleGenerateSyncSignature(req, res); break;
        case 'social-status': await handleSocialStatus(req, res); break;
        case 'get-daily-progress': await handleGetDailyProgress(req, res); break;
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// -----------------------------------------------------------------------------
// CORE HANDLERS
// -----------------------------------------------------------------------------

async function handleGenerateSyncSignature(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message } = req.body;
    if (!wallet_address || !signature || !message) return res.status(400).json({ error: 'Missing fields' });

    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet_address.toLowerCase();

        const { data: profile, error } = await supabaseAdmin
            .from('user_profiles')
            .select('total_xp')
            .eq('wallet_address', cleanAddress)
            .single();

        if (error || !profile) return res.status(404).json({ error: 'User not found' });

        const totalXp = profile.total_xp || 0;
        const deadline = Math.floor(Date.now() / 1000) + (10 * 60);

        if (!WALLET_BOT_SIGNER) return res.status(500).json({ error: 'Signer wallet not configured' });
        
        const account = privateKeyToAccount(WALLET_BOT_SIGNER as `0x${string}`);
        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint256'],
                [wallet_address, BigInt(totalXp), BigInt(deadline)]
            )
        );

        const signedSignature = await account.signMessage({ message: { raw: messageHash } });

        return res.json({
            ok: true,
            total_xp: totalXp,
            deadline: deadline,
            signature: signedSignature,
            signer: account.address
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
}

async function handleLoginSync(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, fid, referred_by } = req.body as SyncPayload;
    if (!wallet_address || !signature || !message) return res.status(400).json({ error: 'Missing fields' });

    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet_address.toLowerCase();

        const { data: existing } = await supabaseAdmin
            .from('user_profiles')
            .select('referred_by')
            .eq('wallet_address', cleanAddress)
            .maybeSingle();

        const updateData: Database['public']['Tables']['user_profiles']['Insert'] = {
            wallet_address: cleanAddress,
            fid: fid || null,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (!existing?.referred_by && referred_by && referred_by.toLowerCase() !== cleanAddress) {
            updateData.referred_by = referred_by.toLowerCase();
        }

        if (!existing) {
            updateData.tier = 0;
        }

        const { data, error } = await supabaseAdmin
            .from('user_profiles')
            .upsert(updateData, { onConflict: 'wallet_address' })
            .select().maybeSingle();

        if (error) throw error;
        return res.status(200).json({ success: true, profile: data });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleXpSync(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, tx_hash } = req.body as XpSyncPayload;
    if (!wallet_address) return res.status(400).json({ error: 'Missing wallet' });

    try {
        const cleanAddress = wallet_address.toLowerCase();
        let skipSignature = false;

        if (tx_hash) {
            try {
                const receipt = await rpcClient.waitForTransactionReceipt({ hash: tx_hash as `0x${string}`, timeout: 10000 });
                if (receipt?.status === 'success' && receipt.from.toLowerCase() === cleanAddress) {
                    skipSignature = true;
                }
            } catch (hashErr: unknown) {
                const msg = hashErr instanceof Error ? hashErr.message : String(hashErr);
                if (msg === 'RPC_TIMEOUT') skipSignature = true;
            }
        }

        if (!skipSignature) {
            if (!signature || !message) return res.status(401).json({ error: 'Signature or valid Transaction Hash required' });
            const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
            if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        }

        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('last_onchain_xp, total_xp, streak_count, last_streak_claim')
            .eq('wallet_address', cleanAddress)
            .maybeSingle();

        const lastOnChainXp = profile?.last_onchain_xp || 0;

        const contractStats = await rpcClient.readContract({
            address: DAILY_APP_ADDRESS as `0x${string}`,
            abi: DAILY_APP_USER_STATS_ABI,
            functionName: 'userStats',
            args: [cleanAddress as `0x${string}`],
        }) as unknown as [bigint, bigint, bigint, number, bigint, bigint, boolean];

        const currentOnChainXp = Number(contractStats?.[0] || 0);
        const currentTierOnChain = Number(contractStats?.[3] || 0);
        
        let xpDelta = currentOnChainXp > lastOnChainXp ? (currentOnChainXp - lastOnChainXp) : 0;

        const { data: dailySetting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'daily_claim').maybeSingle();
        const standardDailyReward = dailySetting?.points_value || 100;

        if (xpDelta === 0 && tx_hash && skipSignature) {
            xpDelta = standardDailyReward;
        }

        let result = { success: true, xp_synced: 0, current_tier: currentTierOnChain };

        if (xpDelta > 0) {
            const { error: rpcErr } = await supabaseAdmin.rpc('fn_increment_xp', {
                p_wallet: cleanAddress,
                p_amount: xpDelta
            });

            if (rpcErr) throw rpcErr;

            await supabaseAdmin
                .from('user_profiles')
                .update({ 
                    last_onchain_xp: currentOnChainXp,
                    tier: currentTierOnChain,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_address', cleanAddress);

            if (xpDelta === standardDailyReward || (tx_hash && skipSignature)) {
                const now = new Date();
                const lastClaimDate = profile?.last_streak_claim ? new Date(profile.last_streak_claim) : null;
                let currentStreak = profile?.streak_count || 0;

                if (!lastClaimDate) {
                    currentStreak = 1;
                } else {
                    const diffHours = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);
                    if (diffHours >= 20 && diffHours <= 48) currentStreak += 1;
                    else if (diffHours > 48) currentStreak = 1;
                }
                
                await supabaseAdmin
                    .from('user_profiles')
                    .update({ streak_count: currentStreak, last_streak_claim: now.toISOString() })
                    .eq('wallet_address', cleanAddress);
            }

            await logActivity({
                wallet: cleanAddress,
                category: 'XP',
                type: 'Ledger Sync',
                description: `Synced ${xpDelta} XP from Base Ledger (Parity: ${currentOnChainXp})`,
                amount: xpDelta,
                symbol: 'XP',
                txHash: tx_hash || null
            });

            result.xp_synced = xpDelta;
        }

        return res.status(200).json(result);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleFarcasterSync(req: VercelRequest, res: VercelResponse) {
    const { address, signature, message } = req.body;
    if (!address || !signature || !message) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        
        const response = await fetchWithRetry(
            () => neynar.fetchBulkUsersByEthOrSolAddress({ addresses: [address] }),
            'neynar-api'
        ) as Record<string, any[]>;
        const fcUser = response?.[address.toLowerCase()]?.[0] as any;

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
                .select().maybeSingle();
            if (error) throw error;
            return res.status(200).json({ ok: true, profile: data });
        }
        return res.status(404).json({ error: 'No Farcaster profile' });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleUpdateProfile(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body as UpdateProfilePayload;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing update data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const sanitizedPayload: Partial<UserProfile> = { ...payload };
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
                        return res.status(400).json({ error: `Avatar exceeds limit.` });
                    }
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[Profile Update] Image check failed:`, msg);
            }
        }

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update(sanitizedPayload)
            .eq('wallet_address', wallet.toLowerCase());
        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error); return res.status(500).json({ error: msg });
    }
}

async function handleGetActivityLogs(req: VercelRequest, res: VercelResponse) {
    const { wallet, category, limit = '20' } = req.query as { wallet: string, category?: string, limit?: string };
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

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
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleFrontendLogActivity(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, category, type, description, amount, symbol, txHash, metadata } = req.body;
    if (!wallet_address || !signature || !message || !description) return res.status(400).json({ error: 'Missing log data' });
    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
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
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error); return res.status(500).json({ error: msg });
    }
}

async function handleGetPointSettings(req: VercelRequest, res: VercelResponse) {
    try {
        const [{ data: points }, { data: system }, { data: allowedTokens }] = await Promise.all([
            supabaseAdmin.from('point_settings').select('activity_key, points_value'),
            supabaseAdmin.from('system_settings').select('key, value'),
            supabaseAdmin.from('allowed_tokens').select('*').eq('is_active', true)
        ]);
        
        type SettingValue = string | number | boolean | Json;
        const settings: Record<string, SettingValue> = points?.reduce((acc, curr) => {
            acc[curr.activity_key] = curr.points_value;
            return acc;
        }, {} as Record<string, SettingValue>) || {};

        system?.forEach((s) => {
            settings[s.key] = s.value;
        });

        const tokenList = (allowedTokens && allowedTokens.length > 0) ? allowedTokens : (settings.whitelisted_tokens_json as any || []);
        settings.allowed_tokens = tokenList;
        settings.whitelisted_tokens = tokenList;

        return res.status(200).json({ success: true, settings });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleSyncUgcMission(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body as { wallet: string, signature: string, message: string, payload: UgcMissionPayload };
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { title, description, sponsor_address, platform_code, reward_amount_per_user, max_participants, txHash, tasks_batch, reward_symbol, payment_token, is_base_social_required } = payload;

        const [{ data: ugcConfigRes }, { data: sysSetting }, { data: pointSetting }] = await Promise.all([
            supabaseAdmin.from('system_settings').select('value').eq('key', 'ugc_config').maybeSingle(),
            supabaseAdmin.from('system_settings').select('value').eq('key', 'sponsorship_listing_fee_usdc').maybeSingle(),
            supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'ugc_task_completion').maybeSingle()
        ]);
        
        const ugcConfig = (ugcConfigRes?.value || {}) as Record<string, any>;
        const platformFee = ugcConfig.listing_fee_usdc 
            ? parseFloat(String(ugcConfig.listing_fee_usdc)) 
            : (sysSetting?.value ? parseFloat(String(sysSetting.value)) : 0);
            
        const taskXpReward = pointSetting?.points_value || 0;

        const { data: campaign, error: campaignErr } = await supabaseAdmin.from('campaigns').insert({
            title,
            description,
            sponsor_address: sponsor_address.toLowerCase(),
            platform_code: platform_code || 'farcaster',
            reward_amount_per_user: parseFloat(reward_amount_per_user),
            max_participants: Number(max_participants),
            status: 'pending',
            created_at: new Date().toISOString(),
            payment_token: payment_token || null,
            reward_symbol: reward_symbol || 'TOKEN',
            creation_tx_hash: txHash,
            duration_days: 30, // Default duration if not specified
            reward_token_address: payment_token || '0x0000000000000000000000000000000000000000',
            total_reward_pool: parseFloat(reward_amount_per_user) * Number(max_participants),
            remaining_reward_pool: parseFloat(reward_amount_per_user) * Number(max_participants),
            platform_fee_paid: platformFee,
            chain_id: Number(CHAIN_ID)
        }).select().maybeSingle();

        if (campaignErr || !campaign) throw campaignErr || new Error('Campaign creation failed');

        if (tasks_batch && Array.isArray(tasks_batch)) {
            const tasksToInsert = tasks_batch.map(task => ({
                description: task.title || 'UGC Task',
                xp_reward: taskXpReward,
                platform: task.platform || 'base',
                action_type: task.action_type || 'follow',
                link: task.link,
                is_active: false,
                task_type: 'ugc',
                target_id: campaign.id,
                token_reward_amount: parseFloat(reward_amount_per_user || '0'),
                token_reward_symbol: reward_symbol || 'TOKEN',
                creator_address: wallet.toLowerCase(),
                is_base_social_required: !!is_base_social_required,
                expires_at: new Date(Date.now() + (ugcConfig.mission_duration_days || 7) * 24 * 60 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString()
            }));

            const { error: tasksErr } = await supabaseAdmin.from('daily_tasks').insert(tasksToInsert);
            if (tasksErr) console.warn('[SyncUgcMission] Failed tasks insertion:', tasksErr);
        }

        try {
            const { data: sponsorPoints } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'sponsor_task').maybeSingle();
            let creatorXp = sponsorPoints?.points_value || 0;

            const { error: claimErr } = await supabaseAdmin.from('user_task_claims').insert({
                wallet_address: wallet.toLowerCase(),
                task_id: `ugc_mission_create_${campaign.id}`,
                xp_earned: creatorXp,
                platform: 'system',
                action_type: 'sponsor_task',
                target_id: String(campaign.id)
            });

            if (!claimErr) {
                await supabaseAdmin.rpc('fn_increment_xp', { p_wallet: wallet.toLowerCase(), p_amount: creatorXp });
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
        } catch (xpErr: unknown) {
            const msg = xpErr instanceof Error ? xpErr.message : String(xpErr);
            console.warn('[SyncUgcMission] XP error:', msg); 
        }

        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Mission Creation',
            description: `Paid fees for sponsorship: ${title}`,
            amount: platformFee,
            symbol: 'USDC',
            txHash,
            metadata: { campaign_id: campaign.id }
        });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleSyncUgcRaffle(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body as { wallet: string, signature: string, message: string, payload: UgcRafflePayload };
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { raffle_id, depositETH, end_time, max_tickets, metadata_uri, extra_metadata, winnerCount, txHash } = payload;
        
        const { data: sysSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'raffle_platform_fee_percent').maybeSingle();
        const isAdminWallet = MASTER_ADMINS.includes(wallet.toLowerCase());

        if (!isAdminWallet) {
            try {
                const raffleInfo = await rpcClient.readContract({
                    address: RAFFLE_ADDRESS as `0x${string}`, 
                    abi: RAFFLE_ABI,
                    functionName: 'getRaffleInfo',
                    args: [BigInt(raffle_id)]
                }) as { sponsor: string };

                if (raffleInfo.sponsor.toLowerCase() !== wallet.toLowerCase()) {
                    return res.status(403).json({ error: `Not sponsor of Raffle #${raffle_id}` });
                }
            } catch (onChainErr: unknown) {
                const msg = onChainErr instanceof Error ? onChainErr.message : String(onChainErr);
                console.error('[handleSyncUgcRaffle] On-chain check fail:', msg);
            }
        }

        const sysSettingData = (sysSetting?.value || {}) as Record<string, any>;
        const platformFeePercent = sysSettingData.raffle_platform_fee_percent ? parseFloat(String(sysSettingData.raffle_platform_fee_percent)) : 5;
        const feeMultiplier = 1 + (platformFeePercent / 100);
        const prizePool = depositETH ? parseFloat(depositETH) / feeMultiplier : 0;

        const { error: raffleErr } = await supabaseAdmin.from('raffles').upsert({
            id: Number(raffle_id),
            creator_address: wallet.toLowerCase(),
            sponsor_address: wallet.toLowerCase(),
            end_time: end_time ? new Date(end_time * 1000).toISOString() : null,
            max_tickets: Number(max_tickets),
            winner_count: Number(winnerCount),
            prize_pool: prizePool,
            metadata_uri: metadata_uri || null,
            is_active: false,
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

        const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_create').maybeSingle();
        if (setting?.points_value) {
            const creatorXp = setting.points_value;
            const { error: claimErr } = await supabaseAdmin.from('user_task_claims').insert({
                wallet_address: wallet.toLowerCase(),
                task_id: `raffle_create_${raffle_id}`,
                xp_earned: creatorXp,
                platform: 'system',
                action_type: 'raffle_create',
                target_id: String(raffle_id)
            });

            if (!claimErr) {
                await supabaseAdmin.rpc('fn_increment_xp', { p_wallet: wallet.toLowerCase(), p_amount: creatorXp });
                await logActivity({
                    wallet,
                    category: 'XP',
                    type: 'UGC Raffle Creation',
                    description: `Awarded ${creatorXp} XP for Creating Raffle #${raffle_id}`,
                    amount: creatorXp,
                    symbol: 'XP',
                    txHash
                });
            }
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
            metadata: { raffle_id, winnerCount }
        });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleSyncSbtUpgrade(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { tierName, ethSpent, txHash } = payload;
        
        const { data: thresholds } = await supabaseAdmin.from('sbt_thresholds').select('level, tier_name');
        const tierMap: Record<string, number> = thresholds?.reduce((acc, t) => { if (t.tier_name) acc[t.tier_name] = t.level; return acc; }, {} as Record<string, number>) || {};
        const tierIndex = tierMap[tierName] || 0;

        const contractStats = await rpcClient.readContract({
            address: DAILY_APP_ADDRESS as `0x${string}`,
            abi: DAILY_APP_USER_STATS_ABI,
            functionName: 'userStats',
            args: [wallet.toLowerCase() as `0x${string}`],
        }) as unknown as [bigint, bigint, bigint, number, bigint, bigint, boolean];

        const actualTierOnChain = Number(contractStats?.[3] || 0);
        const actualPointsOnChain = Number(contractStats?.[0] || 0);

        if (actualTierOnChain >= tierIndex && tierIndex > 0) {
            await supabaseAdmin
                .from('user_profiles')
                .update({ 
                    tier: actualTierOnChain, 
                    last_onchain_xp: actualPointsOnChain,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_address', wallet.toLowerCase());
        }

        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'SBT Tier Ascension',
            description: `Upgraded to ${tierName} Tier (Ledger Verified)`,
            amount: parseFloat(ethSpent),
            symbol: 'ETH',
            txHash,
            metadata: { tierName, onchain_tier: actualTierOnChain }
        });

        return res.status(200).json({ success: true, tier: actualTierOnChain });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleSyncPoolClaim(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { amountETH, tier, txHash } = payload;

        await logActivity({
            wallet,
            category: 'REWARD',
            type: 'Pool Sharing Claim',
            description: `Claimed ${parseFloat(amountETH).toFixed(6)} ETH`,
            amount: parseFloat(amountETH),
            symbol: 'ETH',
            txHash,
            metadata: { userTier: tier }
        });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

interface LogActivityParams {
    wallet: string;
    category: string;
    type: string;
    description: string;
    amount?: number;
    symbol?: string;
    txHash?: string | null;
    metadata?: any;
}

async function logActivity({ wallet, category, type, description, amount, symbol, txHash, metadata }: LogActivityParams) {
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
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[logActivity Error]', msg);
    }
}

async function handleLeaderboard(req: VercelRequest, res: VercelResponse) {
    try {
        const { limit = '100', tier } = req.query as { limit?: string, tier?: string };
        let query = supabaseAdmin
            .from('v_user_full_profile')
            .select('*')
            .order('total_xp', { ascending: false })
            .limit(parseInt(limit));

        if (tier && tier !== 'All') query = query.eq('rank_name', tier);

        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json(data);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleSyncOAuth(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, provider, oauth_data } = req.body;
    if (!wallet_address || !signature || !message || !provider || !oauth_data) return res.status(400).json({ error: 'Missing fields' });

    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const normalizedWallet = wallet_address.toLowerCase();

        if (provider === 'google') {
            const { google_id, google_email } = oauth_data;
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
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function isAuthorizedAdmin(walletAddress: string): Promise<boolean> {
    if (!walletAddress) return false;
    const clean = walletAddress.toLowerCase();
    if (MASTER_ADMINS.includes(clean)) return true;
    
    const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('wallet_address', clean)
        .maybeSingle();
    
    if (error || !data) return false;
    return !!data.is_admin;
}

async function handleApproveMission(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, mission_id } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { error: taskErr } = await supabaseAdmin.from('daily_tasks').update({ is_active: true }).eq('id', mission_id);
        if (taskErr) throw taskErr;

        await supabaseAdmin.from('admin_audit_logs').insert({ admin_address: wallet.toLowerCase(), action: 'UGC_APPROVE_MISSION', details: { mission_id } });
        await logActivity({ wallet: wallet.toLowerCase(), category: 'ADMIN', type: 'UGC Approval', description: `Approved mission: ${mission_id}` });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleApproveRaffle(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, raffle_id } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { error } = await supabaseAdmin.from('raffles').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', raffle_id);
        if (error) throw error;

        await supabaseAdmin.from('admin_audit_logs').insert({ admin_address: wallet.toLowerCase(), action: 'UGC_APPROVE_RAFFLE', details: { raffle_id } });
        await logActivity({ wallet: wallet.toLowerCase(), category: 'ADMIN', type: 'Raffle Approval', description: `Approved raffle: ${raffle_id}` });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleRejectRaffle(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, raffle_id, reason, txHash } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { error } = await supabaseAdmin.from('raffles').update({ 
            is_active: false, 
            rejection_reason: reason || 'Violation',
            cancellation_tx: txHash || null,
            updated_at: new Date().toISOString() 
        }).eq('id', raffle_id);
        if (error) throw error;

        await supabaseAdmin.from('admin_audit_logs').insert({ admin_address: wallet.toLowerCase(), action: 'UGC_REJECT_RAFFLE', details: { raffle_id, reason } });
        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleCheckAdmin(req: VercelRequest, res: VercelResponse) {
    const { wallet } = req.query as { wallet: string };
    if (!wallet) return res.status(200).json({ isAdmin: false });
    const isAdmin = await isAuthorizedAdmin(wallet);
    return res.status(200).json({ isAdmin });
}

async function handleFetchPendingMissions(req: VercelRequest, res: VercelResponse) {
    const body = req.method === 'POST' ? req.body : req.query;
    const { wallet, signature, message } = body;
    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { data, error } = await supabaseAdmin.from('daily_tasks').select('*').eq('is_active', false).not('creator_address', 'is', null);
        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleFetchPendingRaffles(req: VercelRequest, res: VercelResponse) {
    const body = req.method === 'POST' ? req.body : req.query;
    const { wallet, signature, message } = body;
    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { data, error } = await supabaseAdmin.from('raffles').select('*').eq('is_active', false).is('rejection_reason', null);
        if (error) throw error;
        return res.status(200).json(data);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleGetHealth(req: VercelRequest, res: VercelResponse) {
    try {
        const { data, error } = await supabaseAdmin.from('system_health').select('*').order('service_key');
        if (error) throw error;
        return res.status(200).json({ ok: true, health: data });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(500).json({ error: msg });
    }
}

async function handleResetHealth(req: VercelRequest, res: VercelResponse) {
    const { service_key } = req.body || {};
    if (!service_key) return res.status(400).json({ error: 'Missing service_key' });
    try {
        const { error } = await supabaseAdmin.from('system_health').upsert({
            service_key,
            status: 'healthy',
            last_heartbeat: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });
        if (error) throw error;
        return res.status(200).json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(500).json({ error: msg });
    }
}

async function handleSyncBaseSocial(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const normalizedWallet = wallet_address.toLowerCase();
        let basename = null;
        try {
            basename = await rpcClient.getEnsName({ address: normalizedWallet as `0x${string}` });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[Basename Sync] Error:', msg); 
        }

        if (!basename) return res.status(404).json({ error: 'No Basename found' });

        await supabaseAdmin.from('user_profiles').update({ base_username: basename, is_base_social_verified: true, updated_at: new Date().toISOString() }).eq('wallet_address', normalizedWallet);
        await logActivity({ wallet: normalizedWallet, category: 'IDENTITY', type: 'Base Social Link', description: `Verified Base Social: ${basename}` });

        return res.status(200).json({ success: true, basename });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: msg });
    }
}

async function handleGetDailyProgress(req: VercelRequest, res: VercelResponse) {
    const { wallet } = req.query as { wallet: string };
    try {
        const { data, error } = await supabaseAdmin.from('v_user_daily_progress').select('*').eq('wallet_address', wallet.toLowerCase()).maybeSingle();
        if (error) throw error;
        const { data: bonusSetting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'daily_task_completion').maybeSingle();
        return res.status(200).json({ success: true, progress: data || { wallet_address: wallet.toLowerCase(), completed_count: 0, bonus_claimed: false }, bonus_amount: bonusSetting?.points_value || 50 });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(500).json({ error: msg });
    }
}

async function handleSocialStatus(req: VercelRequest, res: VercelResponse) {
    const { address } = req.query as { address: string };
    try {
        const cleanAddress = address.toLowerCase();
        const { data: profile, error } = await supabaseAdmin.from('user_profiles').select('fid, twitter_username, twitter_id, is_base_social_verified').eq('wallet_address', cleanAddress).maybeSingle();
        if (error) throw error;

        const hasFarcaster = !!profile?.fid;
        const hasTwitter = !!profile?.twitter_id;
        const isVerified = hasFarcaster || hasTwitter || profile?.is_base_social_verified;

        return res.status(200).json({
            farcaster: hasFarcaster ? { fid: profile.fid, verified: true } : null,
            twitter: hasTwitter ? { username: profile.twitter_username, id: profile.twitter_id, verified: true } : null,
            isVerified: !!isVerified
        });
    } catch (e: unknown) { return res.status(500).json({ error: 'Internal Error', isVerified: false }); }
}
