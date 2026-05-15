import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './_shared/database.types.js';
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
    PROFILE_LIMITS,
    MASTER_ADMINS,
    WALLET_BOT_SIGNER,
    CHAIN_ID,
    isMainnet,
    sanitizeError,
    logSystemError
} from './_shared/constants.js';
import type { 
    UserProfile, 
    SyncPayload, 
    XpSyncPayload, 
    UpdateProfilePayload, 
    UgcMissionPayload, 
    UgcRafflePayload,
    Json
} from './_shared/types.js';

// Move initialization inside helper to prevent top-level invocation failures
let supabaseAdminInstance: ReturnType<typeof createClient<Database>> | null = null;
const getSupabaseAdmin = () => {
    if (supabaseAdminInstance) return supabaseAdminInstance;
    const url = SUPABASE_URL;
    const key = SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error(`Missing Supabase Configuration: URL=${!!url}, KEY=${!!key}`);
    }
    supabaseAdminInstance = createClient<Database>(url, key);
    return supabaseAdminInstance;
};

const neynar = new NeynarAPIClient({ apiKey: NEYNAR_API_KEY || '' });

// -----------------------------------------------------------------------------
// RESILIENCE & HEALTH (v3.21.0)
// -----------------------------------------------------------------------------
const BREAK_COOLDOWN = 5 * 60 * 1000; // 5 minutes

async function checkBreaker(serviceKey: string): Promise<boolean> {
    const { data } = await getSupabaseAdmin()
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
        await getSupabaseAdmin().from('system_health').upsert({
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
        const { data } = await getSupabaseAdmin()
            .from('system_settings')
            .select('value')
            .eq('key', 'active_features')
            .maybeSingle();
        
        const activeFeatures = (data?.value || {}) as Record<string, boolean>;
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
        case 'get-profile': await handleGetProfile(req, res); break;
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
        case 'ecosystem-stats': await handleEcosystemStats(req, res); break;
        case 'check-reputation': await handleCheckReputation(req, res); break;
        case 'record-pending-sync': await handleRecordPendingSync(req, res); break;
        case 'get-pending-syncs': await handleGetPendingSyncs(req, res); break;
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

async function checkIdentityStatus(wallet: string): Promise<boolean> {
    try {
        const { data: profile } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('fid, twitter_id, is_base_social_verified')
            .eq('wallet_address', wallet.toLowerCase())
            .maybeSingle();
        
        return !!(profile?.fid || profile?.twitter_id || profile?.is_base_social_verified);
    } catch (e) {
        return false;
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

        const { data: profile, error } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('total_xp')
            .eq('wallet_address', cleanAddress)
            .maybeSingle();

        if (error) return res.status(500).json({ error: 'Database error' });
        if (!profile) return res.status(404).json({ error: 'User not found' });

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
        res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleLoginSync(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, fid, referred_by } = req.body as SyncPayload;
    if (!wallet_address || !signature || !message) return res.status(400).json({ error: 'Missing fields' });

    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet_address.toLowerCase();

        const { data: existing } = await getSupabaseAdmin()
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

        const { data, error } = await getSupabaseAdmin()
            .from('user_profiles')
            .upsert(updateData, { onConflict: 'wallet_address' })
            .select().maybeSingle();

        if (error) throw error;
        return res.status(200).json({ success: true, profile: data });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
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

        // Rule 61: IDENTITY GATING MANDATE
        const isVerified = await checkIdentityStatus(cleanAddress);
        if (!isVerified) return res.status(403).json({ error: 'Identity verification required (Farcaster/Twitter/Base)' });

        const { data: profile } = await getSupabaseAdmin()
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

        const { data: dailySetting } = await getSupabaseAdmin().from('point_settings').select('points_value').eq('activity_key', 'daily_claim').maybeSingle();
        const standardDailyReward = dailySetting?.points_value || 100;

        if (xpDelta === 0 && tx_hash && skipSignature) {
            xpDelta = standardDailyReward;
        }

        const result = { success: true, xp_synced: 0, current_tier: currentTierOnChain };

        if (xpDelta > 0) {
            // Rule 60: COOLDOWN ENFORCEMENT for Daily Claim — check BEFORE incrementing
            if (xpDelta === standardDailyReward || (tx_hash && skipSignature)) {
                if (profile?.last_streak_claim) {
                    const lastDate = new Date(profile.last_streak_claim);
                    const hoursSince = (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60);
                    if (hoursSince < 20) {
                        return res.status(429).json({ error: 'Daily claim cooldown still active', cooldown_remaining_hours: Math.ceil(20 - hoursSince) });
                    }
                }
            }

            const { error: rpcErr } = await getSupabaseAdmin().rpc('fn_increment_xp', {
                p_wallet: cleanAddress,
                p_amount: xpDelta
            });

            if (rpcErr) throw rpcErr;

            await getSupabaseAdmin()
                .from('user_profiles')
                .update({ 
                    last_onchain_xp: currentOnChainXp,
                    tier: currentTierOnChain,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_address', cleanAddress);

            // Streak tracking for Daily Claim
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
                
                await getSupabaseAdmin()
                    .from('user_profiles')
                    .update({ streak_count: currentStreak, last_streak_claim: now.toISOString() })
                    .eq('wallet_address', cleanAddress);
            }

            // Determine if this is a daily claim vs generic XP sync
            const isDailyClaim = xpDelta === standardDailyReward || (tx_hash && skipSignature);
            const logCategory = isDailyClaim ? 'DAILY' : 'XP';
            const logType = isDailyClaim ? 'On-chain Daily Claim' : 'Ledger Sync';
            const logDescription = isDailyClaim
                ? `Daily claim: +${xpDelta} XP (streak: ${profile?.streak_count || 1})`
                : `Synced ${xpDelta} XP from Base Ledger (Parity: ${currentOnChainXp})`;

            await logActivity({
                wallet: cleanAddress,
                category: logCategory,
                type: logType,
                description: logDescription,
                amount: xpDelta,
                symbol: 'XP',
                txHash: tx_hash || null,
                metadata: {
                    chain_id: isMainnet ? 8453 : 84532,
                    contract_address: DAILY_APP_ADDRESS,
                    on_chain_xp: currentOnChainXp,
                    sync_status: 'synced'
                }
            });

            result.xp_synced = xpDelta;
        } else if (tx_hash) {
            // xpDelta is 0 but user submitted a valid tx_hash — this means the on-chain XP
            // was already synced (race condition) or RPC returned stale data.
            // Still log the daily claim event so user history is not empty.
            await logActivity({
                wallet: cleanAddress,
                category: 'DAILY',
                type: 'On-chain Daily Claim',
                description: `Daily claim confirmed (XP already synced, delta: 0)`,
                amount: 0,
                symbol: 'XP',
                txHash: tx_hash,
                metadata: {
                    chain_id: isMainnet ? 8453 : 84532,
                    contract_address: DAILY_APP_ADDRESS,
                    on_chain_xp: currentOnChainXp,
                    sync_status: 'already_synced',
                    note: 'xpDelta was 0 — on-chain state already matched DB'
                }
            });
        }

        return res.status(200).json(result);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
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
        ) as Record<string, { fid: number; username: string; pfp_url: string; experimental?: { neynar_user_score: number } }[]>;
        const fcUser = response?.[address.toLowerCase()]?.[0];

        if (fcUser) {
            const { data, error } = await getSupabaseAdmin()
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
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleUpdateProfile(req: VercelRequest, res: VercelResponse) {
    const { wallet, wallet_address, signature, message, payload, heartbeat } = req.body;

    // Lightweight heartbeat: just update updated_at (no signature required for non-sensitive timestamp)
    if (heartbeat && (wallet_address || wallet)) {
        const addr = (wallet_address || wallet).toLowerCase();
        const { error } = await getSupabaseAdmin()
            .from('user_profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('wallet_address', addr);
        if (error) return res.status(500).json({ error: 'Heartbeat failed' });
        return res.status(200).json({ success: true });
    }

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

        const { error } = await getSupabaseAdmin()
            .from('user_profiles')
            .update(sanitizedPayload)
            .eq('wallet_address', wallet.toLowerCase());
        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error); return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleGetProfile(req: VercelRequest, res: VercelResponse) {
    const { wallet } = req.query as { wallet: string };
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

    try {
        const { data, error } = await getSupabaseAdmin()
            .from('v_user_full_profile')
            .select('*')
            .eq('wallet_address', wallet.toLowerCase())
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(200).json({ success: true, data: null, isNew: true });

        return res.status(200).json({ success: true, data });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[handleGetProfile]', msg);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleGetActivityLogs(req: VercelRequest, res: VercelResponse) {
    const { wallet, category, limit = '50' } = req.query as { wallet: string, category?: string, limit?: string };
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

    try {
        const cleanWallet = wallet.toLowerCase();
        const parsedLimit = Math.min(parseInt(limit) || 100, 200);

        // 1. Fetch from user_activity_logs (explicit logs)
        let logsQuery = getSupabaseAdmin()
            .from('user_activity_logs')
            .select('id, wallet_address, category, activity_type, description, value_amount, value_symbol, tx_hash, created_at, metadata')
            .eq('wallet_address', cleanWallet)
            .order('created_at', { ascending: false })
            .limit(parsedLimit);

        if (category && category !== 'ALL') {
            logsQuery = logsQuery.eq('category', category);
        }

        // 2. Fetch from user_task_claims (task completions that may not have explicit logs)
        let claimsQuery = getSupabaseAdmin()
            .from('user_task_claims')
            .select('id, wallet_address, task_id, xp_earned, platform, action_type, target_id, claimed_at')
            .eq('wallet_address', cleanWallet)
            .order('claimed_at', { ascending: false })
            .limit(parsedLimit);

        const [logsResult, claimsResult] = await Promise.all([
            logsQuery,
            (category && category !== 'ALL' && category !== 'XP') ? Promise.resolve({ data: [], error: null }) : claimsQuery
        ]);

        if (logsResult.error) throw logsResult.error;

        const activityLogs = (logsResult.data || []).map((log: any) => ({
            id: log.id,
            category: log.category,
            activity_type: log.activity_type,
            description: log.description,
            value_amount: log.value_amount || 0,
            value_symbol: log.value_symbol || 'XP',
            tx_hash: log.tx_hash,
            created_at: log.created_at,
            source: 'log'
        }));

        // Convert task claims to activity log format (fill gaps)
        const claimLogs = (claimsResult.data || []).map((claim: any) => ({
            id: `claim_${claim.id}`,
            category: 'XP',
            activity_type: claim.task_id?.startsWith('raffle_') ? 'Raffle Activity' :
                           claim.task_id?.startsWith('ugc_') ? 'UGC Campaign' :
                           claim.task_id === 'daily_task_completion' ? 'Daily Bonus' :
                           claim.action_type === 'daily_bonus' ? 'Daily Bonus' :
                           'Task Claim',
            description: claim.task_id?.startsWith('raffle_buy_') ? `Purchased raffle tickets` :
                         claim.task_id?.startsWith('raffle_win_') ? `Won raffle prize` :
                         claim.task_id?.startsWith('ugc_campaign_') ? `Completed UGC campaign` :
                         claim.task_id === 'daily_task_completion' ? `Earned ${claim.xp_earned} XP from daily bonus` :
                         `Claimed ${claim.xp_earned} XP for ${claim.task_id}`,
            value_amount: claim.xp_earned || 0,
            value_symbol: 'XP',
            tx_hash: null,
            created_at: claim.claimed_at,
            source: 'claim'
        }));

        // Merge and deduplicate (prefer explicit logs over claim-derived entries)
        // [FIX v3.63.7] Use 23 chars (millisecond precision) for deduplication to prevent collapsing multiple actions in same second.
        const logTimestamps = new Set(activityLogs.map((l: { created_at: string }) => l.created_at?.slice(0, 23)));
        const uniqueClaimLogs = claimLogs.filter((c: { created_at: string }) => !logTimestamps.has(c.created_at?.slice(0, 23)));

        const combined = [...activityLogs, ...uniqueClaimLogs]
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, parsedLimit);

        return res.status(200).json({ success: true, logs: combined });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleFrontendLogActivity(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, category, type, description, amount, symbol, txHash, metadata } = req.body;
    if (!wallet_address || !signature || !message || !description) return res.status(400).json({ error: 'Missing log data' });
    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // For financial activities (PURCHASE/REWARD) with tx_hash, verify receipt on-chain
        let receiptVerified = false;
        if (txHash && (category === 'PURCHASE' || category === 'REWARD' || category === 'SWAP')) {
            try {
                const receipt = await rpcClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
                receiptVerified = receipt?.status === 'success' && receipt.from.toLowerCase() === wallet_address.toLowerCase();
            } catch {
                // Receipt verification is best-effort; log anyway with unverified flag
            }
        }

        await logActivity({
            wallet: wallet_address,
            category: category || 'PURCHASE',
            type: type || 'External Activity',
            description,
            amount,
            symbol: symbol || 'XP',
            txHash,
            metadata: { ...(metadata || {}), receipt_verified: receiptVerified || undefined }
        });

        return res.status(200).json({ success: true, receipt_verified: receiptVerified });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        await logSystemError({ surface: 'api', bundle: 'user-bundle', action: 'log-activity', wallet_address, message: msg });
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleGetPointSettings(req: VercelRequest, res: VercelResponse) {
    try {
        const [{ data: points }, { data: system }, { data: allowedTokens }] = await Promise.all([
            getSupabaseAdmin().from('point_settings').select('activity_key, points_value'),
            getSupabaseAdmin().from('system_settings').select('key, value'),
            getSupabaseAdmin().from('allowed_tokens').select('*').eq('is_active', true)
        ]);
        
        type SettingValue = string | number | boolean | Json;
        const settings: Record<string, SettingValue> = points?.reduce((acc, curr) => {
            acc[curr.activity_key] = curr.points_value;
            return acc;
        }, {} as Record<string, SettingValue>) || {};

        system?.forEach((s) => {
            settings[s.key] = s.value;
        });

        const tokenList = (allowedTokens && allowedTokens.length > 0) 
            ? allowedTokens 
            : ((settings.whitelisted_tokens_json as unknown as any[]) || []);
        settings.allowed_tokens = tokenList;
        settings.whitelisted_tokens = tokenList;

        return res.status(200).json({ success: true, settings });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleSyncUgcMission(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body as { wallet: string, signature: string, message: string, payload: UgcMissionPayload };
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { 
            title, description, sponsor_address, platform_code, 
            reward_amount_per_user, max_participants, txHash, 
            tasks_batch, reward_symbol, payment_token, 
            is_base_social_required, listing_fee 
        } = payload;

        const [{ data: ugcConfigRes }, { data: sysSetting }, { data: pointSetting }] = await Promise.all([
            getSupabaseAdmin().from('system_settings').select('value').eq('key', 'ugc_config').maybeSingle(),
            getSupabaseAdmin().from('system_settings').select('value').eq('key', 'sponsorship_listing_fee_usdc').maybeSingle(),
            getSupabaseAdmin().from('point_settings').select('points_value').eq('activity_key', 'ugc_task_completion').maybeSingle()
        ]);
        
        const ugcConfig = (ugcConfigRes?.value || {}) as Record<string, any>;
        const platformFee = ugcConfig.listing_fee_usdc 
            ? parseFloat(String(ugcConfig.listing_fee_usdc)) 
            : (sysSetting?.value ? parseFloat(String(sysSetting.value)) : 0);
            
        const taskXpReward = pointSetting?.points_value || 0;

        const { data: campaign, error: campaignErr } = await getSupabaseAdmin().from('campaigns').insert({
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
            duration_days: Number(ugcConfig.mission_duration_days) || 30, // Zero-Hardcode: reads from ugc_config
            reward_token_address: (payment_token || '0x0000000000000000000000000000000000000000').toLowerCase(),
            total_reward_pool: parseFloat(reward_amount_per_user) * Number(max_participants),
            remaining_reward_pool: parseFloat(reward_amount_per_user) * Number(max_participants),
            listing_fee: listing_fee || platformFee,
            platform_fee_paid: platformFee, // Legacy tracking
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

            const { error: tasksErr } = await getSupabaseAdmin().from('daily_tasks').insert(tasksToInsert);
            if (tasksErr) {
                console.warn('[SyncUgcMission] Failed tasks insertion:', tasksErr);
                // Persistent warning log for partial failure
                await logActivity({
                    wallet,
                    category: 'SYNC',
                    type: 'UGC Mission Task Insert Failed',
                    description: `Campaign ${campaign.id} created but ${tasksToInsert.length} task(s) failed to insert`,
                    amount: 0,
                    symbol: 'XP',
                    txHash,
                    metadata: { campaign_id: campaign.id, tasks_attempted: tasksToInsert.length, error: tasksErr.message?.slice(0, 200) }
                });
            }
        }

        try {
            const { data: sponsorPoints } = await getSupabaseAdmin().from('point_settings').select('points_value').eq('activity_key', 'sponsor_task').maybeSingle();
            const creatorXp = sponsorPoints?.points_value || 0;

            const { error: claimErr } = await getSupabaseAdmin().from('user_task_claims').insert({
                wallet_address: wallet.toLowerCase(),
                task_id: `ugc_mission_create_${campaign.id}`,
                xp_earned: creatorXp,
                platform: 'system',
                action_type: 'sponsor_task',
                target_id: String(campaign.id)
            });

            if (!claimErr) {
                await getSupabaseAdmin().rpc('fn_increment_xp', { p_wallet: wallet.toLowerCase(), p_amount: creatorXp });
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
            // Log the XP award failure so it's visible in admin/profile history
            await logActivity({
                wallet,
                category: 'ERROR',
                type: 'UGC Mission XP Failed',
                description: `XP bonus for mission "${title}" failed: ${msg.slice(0, 150)}`,
                amount: 0,
                symbol: 'XP',
                txHash,
                metadata: { campaign_id: campaign.id, error: msg.slice(0, 200) }
            });
        }

        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Mission Creation',
            description: `Paid fees for sponsorship: ${title}`,
            amount: listing_fee || platformFee,
            symbol: reward_symbol || 'USDC',
            txHash,
            metadata: { campaign_id: campaign.id }
        });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleSyncUgcRaffle(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body as { wallet: string, signature: string, message: string, payload: UgcRafflePayload };
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { raffle_id, depositETH, end_time, max_tickets, metadata_uri, extra_metadata, winnerCount, txHash } = payload;
        
        const { data: sysSetting } = await getSupabaseAdmin().from('system_settings').select('value').eq('key', 'raffle_platform_fee_percent').maybeSingle();
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

        const sysSettingData = (sysSetting?.value || {}) as Record<string, string | number | boolean>;
        const platformFeePercent = sysSettingData.raffle_platform_fee_percent ? parseFloat(String(sysSettingData.raffle_platform_fee_percent)) : 5;
        const feeMultiplier = 1 + (platformFeePercent / 100);
        const prizePool = depositETH ? parseFloat(depositETH) / feeMultiplier : 0;

        const { error: raffleErr } = await getSupabaseAdmin().from('raffles').upsert({
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

        const { data: setting } = await getSupabaseAdmin().from('point_settings').select('points_value').eq('activity_key', 'raffle_create').maybeSingle();
        if (setting?.points_value) {
            const creatorXp = setting.points_value;
            const { error: claimErr } = await getSupabaseAdmin().from('user_task_claims').insert({
                wallet_address: wallet.toLowerCase(),
                task_id: `raffle_create_${raffle_id}`,
                xp_earned: creatorXp,
                platform: 'system',
                action_type: 'raffle_create',
                target_id: String(raffle_id)
            });

            if (!claimErr) {
                await getSupabaseAdmin().rpc('fn_increment_xp', { p_wallet: wallet.toLowerCase(), p_amount: creatorXp });
                await logActivity({
                    wallet,
                    category: 'XP',
                    type: 'UGC Raffle Creation',
                    description: `Awarded ${creatorXp} XP for Creating Raffle #${raffle_id}`,
                    amount: creatorXp,
                    symbol: 'XP',
                    txHash
                });
            } else if (claimErr.code === '23505') {
                // Duplicate claim — XP already awarded on a previous sync attempt
                await logActivity({
                    wallet,
                    category: 'SYNC',
                    type: 'Raffle Create XP Already Awarded',
                    description: `Raffle #${raffle_id} creation XP already claimed (duplicate sync)`,
                    amount: 0,
                    symbol: 'XP',
                    txHash,
                    metadata: { raffle_id, duplicate: true }
                });
            }
        }

        await getSupabaseAdmin().rpc('fn_increment_raffles_created', { p_wallet: wallet.toLowerCase() });
        await logActivity({
            wallet,
            category: 'PURCHASE',
            type: 'UGC Raffle Launch',
            description: `Launched sponsored raffle: ${extra_metadata?.title || raffle_id}`,
            amount: parseFloat(depositETH),
            symbol: 'ETH',
            txHash,
            metadata: { raffle_id, winnerCount, sync_status: 'synced', contract_verified: true }
        });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleSyncSbtUpgrade(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // Rule 61: IDENTITY GATING MANDATE
        const isVerified = await checkIdentityStatus(wallet);
        if (!isVerified) return res.status(403).json({ error: 'Identity verification required for tier upgrades' });

        const { tierName, ethSpent, txHash } = payload;
        
        const { data: thresholds } = await getSupabaseAdmin().from('sbt_thresholds').select('level, tier_name, min_xp');
        const tierMap: Record<string, number> = thresholds?.reduce((acc, t) => { if (t.tier_name) acc[t.tier_name] = t.level; return acc; }, {} as Record<string, number>) || {};
        const minXpMap: Record<number, number> = thresholds?.reduce((acc, t) => { acc[t.level] = t.min_xp; return acc; }, {} as Record<number, number>) || {};
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
            // Check if burn already logged to prevent double-burn on retry
            const { data: existingBurn } = await getSupabaseAdmin().from('user_task_claims').select('id').eq('task_id', `sbt_upgrade_burn_${txHash}`).maybeSingle();
            
            if (!existingBurn) {
                const burnedXP = minXpMap[actualTierOnChain] || 0;
                if (burnedXP > 0) {
                    await getSupabaseAdmin().from('user_task_claims').insert({
                        wallet_address: wallet.toLowerCase(),
                        task_id: `sbt_upgrade_burn_${txHash}`,
                        xp_earned: -burnedXP,
                        platform: 'base',
                        action_type: 'tier_upgrade'
                    });
                }
            }

            await getSupabaseAdmin()
                .from('user_profiles')
                .update({ 
                    tier: actualTierOnChain, 
                    total_xp: actualPointsOnChain, // Force parity with on-chain burned balance
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

        // Dedicated SBT / Mint event for profile/admin filter
        await logActivity({
            wallet,
            category: 'SBT',
            type: 'Mint',
            description: `Minted ${tierName} SBT NFT`,
            amount: parseFloat(ethSpent),
            symbol: 'ETH',
            txHash,
            metadata: {
                tier: actualTierOnChain,
                tier_name: tierName,
                mint_price_eth: ethSpent,
                contract_address: DAILY_APP_ADDRESS,
                chain_id: isMainnet ? 8453 : 84532
            }
        });

        return res.status(200).json({ success: true, tier: actualTierOnChain });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleSyncPoolClaim(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !signature || !message || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // Rule 61: IDENTITY GATING MANDATE
        const isVerified = await checkIdentityStatus(wallet);
        if (!isVerified) return res.status(403).json({ error: 'Identity verification required for rewards' });

        const { amountETH, tier, txHash } = payload;

        await logActivity({
            wallet,
            category: 'SBT',
            type: 'Pool Sharing Claim',
            description: `Claimed ${parseFloat(amountETH).toFixed(6)} ETH from SBT pool (Tier ${tier})`,
            amount: parseFloat(amountETH),
            symbol: 'ETH',
            txHash,
            metadata: { userTier: tier, feature: 'sbt_pool' }
        });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
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
        await getSupabaseAdmin().from('user_activity_logs').insert({
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
        // Force initialization check
        getSupabaseAdmin();
    } catch (initErr: any) {
        return res.status(500).json({ 
            error: "Initialization Failed", 
            message: initErr.message,
            env_status: {
                has_url: !!SUPABASE_URL,
                has_key: !!SUPABASE_SERVICE_ROLE_KEY
            }
        });
    }

    try {
        const { limit = '100', tier } = req.query as { limit?: string, tier?: string };
        let query = getSupabaseAdmin()
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
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleEcosystemStats(_req: VercelRequest, res: VercelResponse) {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        const [
            { count: totalMembers },
            { count: dau },
            { count: totalTx }
        ] = await Promise.all([
            getSupabaseAdmin().from('user_profiles').select('*', { count: 'exact', head: true }),
            getSupabaseAdmin().from('user_profiles').select('*', { count: 'exact', head: true }).gte('updated_at', todayStart),
            getSupabaseAdmin().from('user_activity_logs').select('*', { count: 'exact', head: true })
        ]);

        // Online = users active in last 15 minutes
        const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
        const { count: online } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .gte('updated_at', fifteenMinAgo);

        return res.status(200).json({
            success: true,
            stats: {
                totalMembers: totalMembers || 0,
                dau: dau || 0,
                online: online || 0,
                totalTx: totalTx || 0
            }
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleCheckReputation(req: VercelRequest, res: VercelResponse) {
    const { wallet } = req.query as { wallet: string };
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

    try {
        const cleanAddress = wallet.toLowerCase();
        const { data: profile } = await getSupabaseAdmin()
            .from('v_user_full_profile')
            .select('total_xp, tier, rank_name, streak_count, is_admin')
            .eq('wallet_address', cleanAddress)
            .maybeSingle();

        if (!profile) return res.status(200).json({ success: true, reputation: null });

        const { count: taskCount } = await getSupabaseAdmin()
            .from('user_task_claims')
            .select('*', { count: 'exact', head: true })
            .eq('wallet_address', cleanAddress);

        return res.status(200).json({
            success: true,
            reputation: {
                total_xp: profile.total_xp || 0,
                tier: profile.tier || 0,
                rank_name: profile.rank_name || 'Rookie',
                streak_count: profile.streak_count || 0,
                tasks_completed: taskCount || 0,
                is_admin: profile.is_admin || false
            }
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

// ─── Pending Sync Recovery Ledger ────────────────────────────────────────────
// Records two-phase failures where a chain tx succeeded but the backend sync did not.
// A reconciliation cron should later pick up status='pending' rows and retry.

const VALID_PENDING_SYNC_ACTIONS = new Set([
    'raffle_buy',
    'raffle_claim',
    'raffle_create',
    'raffle_reject',
    'daily_claim',
    'sbt_upgrade',
    'sbt_mint',
    'mission_create',
    'campaign_join'
]);

async function handleRecordPendingSync(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, action_type, tx_hash, chain_id, contract_address, payload, error_message } = req.body;
    if (!wallet || !signature || !message || !action_type) {
        return res.status(400).json({ error: 'Missing required fields (wallet, signature, message, action_type)' });
    }
    if (!VALID_PENDING_SYNC_ACTIONS.has(action_type)) {
        return res.status(400).json({ error: `Invalid action_type. Allowed: ${[...VALID_PENDING_SYNC_ACTIONS].join(', ')}` });
    }

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanWallet = (wallet as string).toLowerCase();
        const sanitizedError = error_message ? String(error_message).slice(0, 500) : null;

        const { data, error } = await (getSupabaseAdmin() as any)
            .from('pending_sync_jobs')
            .insert({
                wallet_address: cleanWallet,
                action_type,
                tx_hash: tx_hash || null,
                chain_id: chain_id || null,
                contract_address: contract_address ? String(contract_address).toLowerCase() : null,
                payload: payload || null,
                error_message: sanitizedError,
                status: 'pending'
            })
            .select('id')
            .single();

        if (error) {
            // Table may not exist yet in environments where migration has not run.
            // Don't block the user — log and return success:false so the caller can fall back.
            console.warn('[record-pending-sync] insert failed:', error.message);
            return res.status(200).json({ success: false, error: 'Could not record recovery job' });
        }

        return res.status(200).json({ success: true, job_id: data?.id });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleGetPendingSyncs(req: VercelRequest, res: VercelResponse) {
    const wallet = (req.query?.wallet || req.body?.wallet) as string | undefined;
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

    try {
        const cleanWallet = wallet.toLowerCase();
        const { data, error } = await (getSupabaseAdmin() as any)
            .from('pending_sync_jobs')
            .select('id, action_type, tx_hash, chain_id, status, retry_count, created_at, last_attempted_at, error_message')
            .eq('wallet_address', cleanWallet)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            // Table missing — return empty list rather than error so UI degrades gracefully.
            return res.status(200).json({ success: true, jobs: [] });
        }

        return res.status(200).json({ success: true, jobs: data || [] });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}async function handleSyncOAuth(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, provider, oauth_data } = req.body;
    if (!wallet_address || !signature || !message || !provider || !oauth_data) return res.status(400).json({ error: 'Missing fields' });

    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const normalizedWallet = wallet_address.toLowerCase();

        if (provider === 'google') {
            const { google_id, google_email } = oauth_data;
            const { data: existing } = await getSupabaseAdmin().from('user_profiles').select('wallet_address').eq('google_id', google_id).maybeSingle();
            if (existing && existing.wallet_address !== normalizedWallet) return res.status(409).json({ error: 'Already linked' });

            await getSupabaseAdmin().from('user_profiles').update({ google_id, google_email, oauth_provider: 'google', updated_at: new Date().toISOString() }).eq('wallet_address', normalizedWallet);
            await logActivity({ wallet: normalizedWallet, category: 'SOCIAL', type: 'Identity Link', description: `Linked Google: ${google_email}` });
            return res.status(200).json({ success: true });
        } else if (provider === 'x') {
            const { twitter_id, twitter_username } = oauth_data;
            const { data: existing } = await getSupabaseAdmin().from('user_profiles').select('wallet_address').eq('twitter_id', twitter_id).maybeSingle();
            if (existing && existing.wallet_address !== normalizedWallet) return res.status(409).json({ error: 'Already linked' });

            await getSupabaseAdmin().from('user_profiles').update({ twitter_id, twitter_username, oauth_provider: 'x', updated_at: new Date().toISOString() }).eq('wallet_address', normalizedWallet);
            await logActivity({ wallet: normalizedWallet, category: 'SOCIAL', type: 'Identity Link', description: `Linked X: @${twitter_username}` });
            return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Invalid provider' });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function isAuthorizedAdmin(walletAddress: string): Promise<boolean> {
    if (!walletAddress) return false;
    const clean = walletAddress.toLowerCase();
    if (MASTER_ADMINS.includes(clean)) return true;
    
    const { data, error } = await getSupabaseAdmin()
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

        const { error: taskErr } = await getSupabaseAdmin().from('daily_tasks').update({ is_active: true }).eq('id', mission_id);
        if (taskErr) throw taskErr;

        await getSupabaseAdmin().from('admin_audit_logs').insert({ admin_address: wallet.toLowerCase(), action: 'UGC_APPROVE_MISSION', details: { mission_id } });
        await logActivity({ wallet: wallet.toLowerCase(), category: 'ADMIN', type: 'UGC Approval', description: `Approved mission: ${mission_id}` });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleApproveRaffle(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, raffle_id } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { error } = await getSupabaseAdmin().from('raffles').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', raffle_id);
        if (error) throw error;

        await getSupabaseAdmin().from('admin_audit_logs').insert({ admin_address: wallet.toLowerCase(), action: 'UGC_APPROVE_RAFFLE', details: { raffle_id } });
        await logActivity({ wallet: wallet.toLowerCase(), category: 'ADMIN', type: 'Raffle Approval', description: `Approved raffle: ${raffle_id}` });

        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleRejectRaffle(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, raffle_id, reason, txHash } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { error } = await getSupabaseAdmin().from('raffles').update({ 
            is_active: false, 
            rejection_reason: reason || 'Violation',
            cancellation_tx: txHash || null,
            updated_at: new Date().toISOString() 
        }).eq('id', raffle_id);
        if (error) throw error;

        await getSupabaseAdmin().from('admin_audit_logs').insert({ admin_address: wallet.toLowerCase(), action: 'UGC_REJECT_RAFFLE', details: { raffle_id, reason } });
        return res.status(200).json({ success: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
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

        const { data, error } = await getSupabaseAdmin()
            .from('campaigns')
            .select('id, title, created_at, is_verified_payment, reward_amount_per_user, reward_symbol, listing_fee, max_participants, sponsor_address, payment_tx_hash')
            .eq('is_active', false)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleFetchPendingRaffles(req: VercelRequest, res: VercelResponse) {
    const body = req.method === 'POST' ? req.body : req.query;
    const { wallet, signature, message } = body;
    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { data, error } = await getSupabaseAdmin().from('raffles').select('*').eq('is_active', false).is('rejection_reason', null);
        if (error) throw error;
        return res.status(200).json(data);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleGetHealth(req: VercelRequest, res: VercelResponse) {
    try {
        const { data, error } = await getSupabaseAdmin().from('system_health').select('*').order('service_key');
        if (error) throw error;
        return res.status(200).json({ ok: true, health: data });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleResetHealth(req: VercelRequest, res: VercelResponse) {
    const { service_key } = req.body || {};
    if (!service_key) return res.status(400).json({ error: 'Missing service_key' });
    try {
        const { error } = await getSupabaseAdmin().from('system_health').upsert({
            service_key,
            status: 'healthy',
            last_heartbeat: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });
        if (error) throw error;
        return res.status(200).json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(500).json({ error: sanitizeError(msg) });
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

        await getSupabaseAdmin().from('user_profiles').update({ base_username: basename, is_base_social_verified: true, updated_at: new Date().toISOString() }).eq('wallet_address', normalizedWallet);
        await logActivity({ wallet: normalizedWallet, category: 'IDENTITY', type: 'Base Social Link', description: `Verified Base Social: ${basename}` });

        return res.status(200).json({ success: true, basename });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleGetDailyProgress(req: VercelRequest, res: VercelResponse) {
    const { wallet } = req.query as { wallet: string };
    try {
        const { data, error } = await getSupabaseAdmin().from('v_user_daily_progress').select('*').eq('wallet_address', wallet.toLowerCase()).maybeSingle();
        if (error) throw error;
        const { data: bonusSetting } = await getSupabaseAdmin().from('point_settings').select('points_value').eq('activity_key', 'daily_task_completion').maybeSingle();
        return res.status(200).json({ success: true, progress: data || { wallet_address: wallet.toLowerCase(), completed_count: 0, bonus_claimed: false }, bonus_amount: bonusSetting?.points_value || 50 });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleSocialStatus(req: VercelRequest, res: VercelResponse) {
    const { address } = req.query as { address: string };
    try {
        const cleanAddress = address.toLowerCase();
        const { data: profile, error } = await getSupabaseAdmin().from('user_profiles').select('fid, twitter_username, twitter_id, is_base_social_verified').eq('wallet_address', cleanAddress).maybeSingle();
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
