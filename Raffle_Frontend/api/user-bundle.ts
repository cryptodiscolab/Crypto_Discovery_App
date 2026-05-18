import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { withMiddleware } from './_shared/middleware.js';
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
    MASTER_X_ADDRESS,
    MASTER_X_ABI,
    WALLET_BOT_SIGNER,
    CHAIN_ID,
    isMainnet,
    getEnv,
    sanitizeError,
    logSystemError
} from './_shared/constants.js';
import type {
    UserProfile,
    SyncPayload,
    XpSyncPayload,
    UgcMissionPayload,
    UgcRafflePayload,
    Json
} from './_shared/types.js';

type ActivityLogRow = Pick<Database['public']['Tables']['user_activity_logs']['Row'], 'id' | 'category' | 'activity_type' | 'description' | 'value_amount' | 'value_symbol' | 'tx_hash' | 'created_at'>;
type TaskClaimRow = Pick<Database['public']['Tables']['user_task_claims']['Row'], 'id' | 'task_id' | 'xp_earned' | 'action_type' | 'claimed_at'>;
type ActivityFeedItem = {
    id: string | number;
    category: string;
    activity_type: string;
    description: string;
    value_amount: number;
    value_symbol: string;
    tx_hash: string | null;
    created_at: string;
    source: 'log' | 'claim';
};

type PendingSyncJobInsert = {
    wallet_address: string;
    action_type: string;
    tx_hash: string | null;
    chain_id: number | string | null;
    contract_address: string | null;
    payload: Json | null;
    error_message: string | null;
    status: string;
};

type UnknownTableClient = {
    from: (table: string) => {
        insert: (value: PendingSyncJobInsert) => {
            select: (columns: string) => {
                single: () => Promise<{ data: { id?: string | number } | null; error: { message: string } | null }>;
            };
        };
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                eq: (column: string, value: string) => {
                    order: (column: string, options: { ascending: boolean }) => {
                        limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
                    };
                };
            };
        };
    };
};

const toJson = (value: unknown): Json => value as Json;

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
async function handler(req: VercelRequest, res: VercelResponse) {
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
        case 'link-wallet-attest': await handleLinkWalletAttest(req, res); break;
        case 'approve-mission': await handleApproveMission(req, res); break;
        case 'approve-raffle': await handleApproveRaffle(req, res); break;
        case 'reject-raffle': await handleRejectRaffle(req, res); break;
        case 'check-admin': await handleCheckAdmin(req, res); break;
        case 'pending-missions': await handleFetchPendingMissions(req, res); break;
        case 'pending-raffles': await handleFetchPendingRaffles(req, res); break;
        case 'get-tier-distribution': await handleGetTierDistribution(req, res); break;
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
            .select('fid, twitter_id, is_base_social_verified, verifications')
            .eq('wallet_address', wallet.toLowerCase())
            .maybeSingle();

        const hasWalletAttest = Array.isArray(profile?.verifications) && profile.verifications.includes('wallet-attest');
        return !!(profile?.fid || profile?.twitter_id || profile?.is_base_social_verified || hasWalletAttest);
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
        let cleanTxHash: string | undefined = undefined;

        if (tx_hash) {
            cleanTxHash = String(tx_hash).trim().toLowerCase();

            // [SECURITY FIX] Prevent Replay Attacks using an old but valid tx_hash
            const { data: existingLog } = await getSupabaseAdmin()
                .from('user_activity_logs')
                .select('id')
                .eq('tx_hash', cleanTxHash)
                .maybeSingle();

            if (existingLog) {
                return res.status(200).json({ success: true, xp_synced: 0, message: 'Transaction already synced.' });
            }

            try {
                const receipt = await rpcClient.waitForTransactionReceipt({ hash: cleanTxHash as `0x${string}`, timeout: 10000 });
                
                // [SECURITY FIX] Ensure the transaction was actually sent to our DailyApp contract, not just any random address
                const isDailyAppTx = receipt?.to?.toLowerCase() === DAILY_APP_ADDRESS.toLowerCase();
                
                if (receipt?.status === 'success' && receipt.from.toLowerCase() === cleanAddress && isDailyAppTx) {
                    skipSignature = true;
                } else if (receipt && (!isDailyAppTx || receipt.from.toLowerCase() !== cleanAddress)) {
                    return res.status(400).json({ error: 'Invalid transaction target or sender.' });
                }
            } catch (hashErr: unknown) {
                const msg = hashErr instanceof Error ? hashErr.message.toLowerCase() : String(hashErr).toLowerCase();
                if (msg.includes('timeout') || msg.includes('could not be found')) {
                    // [SECURITY FIX] DO NOT set skipSignature = true here. That opens a free XP exploit for fake hashes.
                    // Instead, force the request to fail safely so the frontend queues it in pending_sync_jobs for the CRON.
                    return res.status(503).json({ error: 'RPC_SYNC_DELAYED', message: 'Transaction unverified due to RPC lag. Sync queued for CRON.' });
                }
            }
        }

        if (!skipSignature) {
            if (!signature || !message) return res.status(401).json({ error: 'Signature or valid Transaction Hash required' });
            const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
            if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        }

        // Rule 61: IDENTITY GATING MANDATE
        // Exception: when a confirmed on-chain tx from the same wallet is provided, the user has
        // already proven non-Sybil status by paying gas. Daily claim flow falls under this — paying
        // gas to claimDailyBonus() on DailyApp is sufficient anti-Sybil evidence. Identity gate
        // remains active for off-chain-only signature sync (no tx_hash) and for higher-value
        // actions (tier upgrades, raffle rewards, sponsorship) which have their own identity checks.
        if (!skipSignature) {
            const isVerified = await checkIdentityStatus(cleanAddress);
            if (!isVerified) return res.status(403).json({ error: 'Identity verification required (Farcaster/Twitter/Base)' });
        }

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

        let finalLastOnChainXpToSave = currentOnChainXp;

        if (xpDelta === 0 && tx_hash && skipSignature) {
            // [SECURITY FIX] Phantom Claim Exploit Prevention
            // Never blindly force XP if the node reads 0 delta. It could be a fake 0 ETH transfer.
            // Return 503 so the frontend queues it in pending_sync_jobs. If it's real RPC lag, 
            // the CRON will eventually read the correct delta and grant the XP securely.
            return res.status(503).json({ error: 'RPC_STATE_LAG', message: 'Transaction verified but state is lagging. Queued for CRON.' });
        }
        
        const isDailyClaim = !!(tx_hash && skipSignature);
        let currentStreakToSave = profile?.streak_count || 0;
        let lastStreakClaimToSave = profile?.last_streak_claim || null;
        
        if (isDailyClaim) {
            const now = new Date();
            const lastClaimDate = profile?.last_streak_claim ? new Date(profile.last_streak_claim) : null;
            
            if (!lastClaimDate) {
                currentStreakToSave = 1;
            } else {
                const diffHours = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);
                if (diffHours >= 20 && diffHours <= 48) currentStreakToSave += 1;
                else if (diffHours > 48) currentStreakToSave = 1;
            }
            lastStreakClaimToSave = now.toISOString();
        }

        const result = { success: true, xp_synced: 0, current_tier: currentTierOnChain };

        if (xpDelta > 0) {
            // Rule 60: COOLDOWN ENFORCEMENT for Daily Claim — check BEFORE incrementing
            if (isDailyClaim) {
                if (profile?.last_streak_claim) {
                    const lastDate = new Date(profile.last_streak_claim);
                    const hoursSince = (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60);
                    if (hoursSince < 20) {
                        return res.status(429).json({ error: 'Daily claim cooldown still active', cooldown_remaining_hours: Math.ceil(20 - hoursSince) });
                    }
                }
            }
            
            const updatePayload: any = {
                last_onchain_xp: finalLastOnChainXpToSave,
                tier: currentTierOnChain,
                updated_at: new Date().toISOString()
            };
            
            if (isDailyClaim) {
                updatePayload.streak_count = currentStreakToSave;
                updatePayload.last_streak_claim = lastStreakClaimToSave;
            }

            // [SECURITY FIX] Optimistic Concurrency Control (OCC) + Atomic Streak Update
            const { data: updateData, error: updateErr } = await getSupabaseAdmin()
                .from('user_profiles')
                .update(updatePayload)
                .eq('wallet_address', cleanAddress)
                .eq('last_onchain_xp', lastOnChainXp) // Ensure no concurrent request has already moved the watermark
                .select('wallet_address');

            if (updateErr) throw updateErr;
            if (!updateData || updateData.length === 0) {
                // High watermark already moved by a concurrent request. Abort to prevent XP multiplication.
                return res.status(409).json({ error: 'Conflict: Sync already processed.' });
            }

            // Safe to increment total_xp ONLY AFTER securing the watermark update
            const { error: rpcErr } = await getSupabaseAdmin().rpc('fn_increment_xp', {
                p_wallet: cleanAddress,
                p_amount: xpDelta
            });

            if (rpcErr) throw rpcErr;

            // Determine if this is a daily claim vs generic XP sync
            const logCategory = isDailyClaim ? 'DAILY' : 'XP';
            const logType = isDailyClaim ? 'On-chain Daily Claim' : 'Ledger Sync';
            
            // [UX FIX] Log the ACTUAL new streak, not the stale one from the old profile object
            const logDescription = isDailyClaim
                ? `Daily claim: +${xpDelta} XP (streak: ${currentStreakToSave})`
                : `Synced ${xpDelta} XP from Base Ledger (Parity: ${currentOnChainXp})`;

            await logActivity({
                wallet: cleanAddress,
                category: logCategory,
                type: logType,
                description: logDescription,
                amount: xpDelta,
                symbol: 'XP',
                txHash: (cleanTxHash && skipSignature) ? cleanTxHash : null,
                metadata: {
                    chain_id: isMainnet ? 8453 : 84532,
                    contract_address: DAILY_APP_ADDRESS,
                    on_chain_xp: currentOnChainXp,
                    sync_status: 'synced'
                }
            });

            // Award referral bonus to referrer (fire-and-forget)
            awardReferralBonus(cleanAddress, xpDelta, logType).catch(() => {});

            result.xp_synced = xpDelta;
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
            () => neynar.fetchBulkUsersByEthOrSolAddress({ addresses: [address.toLowerCase()] }),
            'neynar-api'
        ) as Record<string, { fid: number; username: string; pfp_url: string; experimental?: { neynar_user_score: number } }[]>;
        
        // [SECURITY FIX] Case-insensitive key lookup to prevent 404s if Neynar returns checksummed keys
        const cleanAddress = address.toLowerCase();
        const userKey = Object.keys(response || {}).find(k => k.toLowerCase() === cleanAddress);
        const fcUser = userKey ? response[userKey]?.[0] : undefined;

        if (fcUser) {
            // Check if another wallet has already linked this Farcaster FID
            const { data: existingFc } = await getSupabaseAdmin()
                .from('user_profiles')
                .select('wallet_address')
                .eq('fid', fcUser.fid)
                .neq('wallet_address', address.toLowerCase())
                .maybeSingle();

            if (existingFc) {
                return res.status(400).json({ error: 'This Farcaster account is already linked to another wallet.' });
            }

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
            if (error) {
                if (error.code === '23505') {
                    return res.status(400).json({ error: 'This Farcaster account is already linked to another wallet.' });
                }
                throw error;
            }
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
            // PURCHASE filter also includes SWAP and EXPENSE categories (all spending actions)
            if (category === 'PURCHASE') {
                logsQuery = logsQuery.in('category', ['PURCHASE', 'SWAP', 'EXPENSE']);
            } else if (category === 'REWARD') {
                logsQuery = logsQuery.in('category', ['REWARD', 'PAYOUT']);
            } else {
                logsQuery = logsQuery.eq('category', category);
            }
        }

        // 2. Fetch from user_task_claims (task completions that may not have explicit logs)
        const claimsQuery = getSupabaseAdmin()
            .from('user_task_claims')
            .select('id, wallet_address, task_id, xp_earned, platform, action_type, target_id, claimed_at')
            .eq('wallet_address', cleanWallet)
            .order('claimed_at', { ascending: false })
            .limit(parsedLimit);

        const [logsResult, claimsResult] = await Promise.all([
            logsQuery,
            // Always fetch claims — they now have proper category mapping for DAILY, RAFFLE, UGC, SBT
            claimsQuery
        ]);

        if (logsResult.error) throw logsResult.error;

        const activityLogs: ActivityFeedItem[] = ((logsResult.data || []) as ActivityLogRow[]).map((log) => ({
            id: log.id,
            category: log.category,
            activity_type: log.activity_type,
            description: log.description || '',
            value_amount: log.value_amount || 0,
            value_symbol: log.value_symbol || 'XP',
            tx_hash: log.tx_hash,
            created_at: log.created_at || new Date(0).toISOString(),
            source: 'log'
        }));

        // Convert task claims to activity log format (fill gaps)
        const claimLogs: ActivityFeedItem[] = ((claimsResult.data || []) as TaskClaimRow[]).map((claim) => {
            // Determine proper category based on task type
            let claimCategory = 'XP';
            if (claim.task_id === 'daily_task_completion' || claim.action_type === 'daily_bonus') {
                claimCategory = 'DAILY';
            } else if (claim.task_id?.startsWith('raffle_buy_')) {
                claimCategory = 'RAFFLE';
            } else if (claim.task_id?.startsWith('raffle_win_')) {
                claimCategory = 'RAFFLE';
            } else if (claim.task_id?.startsWith('ugc_')) {
                claimCategory = 'UGC';
            } else if (claim.task_id?.startsWith('sbt_upgrade_burn_')) {
                claimCategory = 'SBT';
            }

            return {
                id: `claim_${claim.id}`,
                category: claimCategory,
                activity_type: claim.task_id?.startsWith('raffle_buy_') ? 'Ticket Purchase' :
                               claim.task_id?.startsWith('raffle_win_') ? 'Raffle Win' :
                               claim.task_id?.startsWith('ugc_') ? 'UGC Campaign' :
                               claim.task_id === 'daily_task_completion' ? 'Daily Goal Bonus' :
                               claim.action_type === 'daily_bonus' ? 'Daily Goal Bonus' :
                               claim.task_id?.startsWith('sbt_upgrade_burn_') ? 'SBT XP Burn' :
                               'Task Claim',
                description: claim.task_id?.startsWith('raffle_buy_') ? `Purchased raffle tickets (+${claim.xp_earned} XP)` :
                             claim.task_id?.startsWith('raffle_win_') ? `Won raffle prize (+${claim.xp_earned} XP)` :
                             claim.task_id?.startsWith('ugc_campaign_') ? `Completed UGC campaign (+${claim.xp_earned} XP)` :
                             claim.task_id === 'daily_task_completion' ? `Daily Goal Bonus: +${claim.xp_earned} XP` :
                             claim.action_type === 'daily_bonus' ? `Daily Bonus: +${claim.xp_earned} XP` :
                             claim.task_id?.startsWith('sbt_upgrade_burn_') ? `SBT Upgrade XP Burn: ${claim.xp_earned} XP` :
                             `Claimed ${claim.xp_earned} XP for ${claim.task_id}`,
                value_amount: claim.xp_earned || 0,
                value_symbol: 'XP',
                tx_hash: null,
                created_at: claim.claimed_at || new Date(0).toISOString(),
                source: 'claim'
            };
        });

        // Merge and deduplicate (prefer explicit logs over claim-derived entries)
        // [FIX v3.63.7] Use 23 chars (millisecond precision) for deduplication to prevent collapsing multiple actions in same second.
        const logTimestamps = new Set(activityLogs.map((l) => l.created_at.slice(0, 23)));
        const uniqueClaimLogs = claimLogs
            .filter((c) => !logTimestamps.has(c.created_at.slice(0, 23)))
            .filter((c) => !category || category === 'ALL' || c.category === category);

        const combined = [...activityLogs, ...uniqueClaimLogs]
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
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

        // [SECURITY FIX] Disallow frontend from logging financial/XP categories to prevent Admin Metrics Poisoning via Fake Receipts.
        const forbiddenCategories = ['PURCHASE', 'REWARD', 'SWAP', 'XP', 'ADMIN'];
        if (forbiddenCategories.includes(category?.toUpperCase())) {
            return res.status(403).json({ error: `Category ${category} must be logged by the backend.` });
        }

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

        type SettingValue = string | number | boolean | Json | Json[];
        const settings: Record<string, SettingValue> = points?.reduce((acc, curr) => {
            acc[curr.activity_key] = curr.points_value;
            return acc;
        }, {} as Record<string, SettingValue>) || {};

        system?.forEach((s) => {
            settings[s.key] = s.value;
        });

        const tokenList = (allowedTokens && allowedTokens.length > 0)
            ? (allowedTokens as unknown as Json[])
            : ((settings.whitelisted_tokens_json as Json[] | undefined) || []);
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

        const ugcConfig = (ugcConfigRes?.value || {}) as Record<string, unknown>;
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
            const tasksToInsert = (tasks_batch as Array<{ title?: string; platform?: string; action_type?: string; link?: string }>).map(task => ({
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
                expires_at: new Date(Date.now() + Number(ugcConfig.mission_duration_days || 7) * 24 * 60 * 60 * 1000).toISOString(),
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
                    metadata: { campaign_id: String(campaign.id) }
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
                target_id: `raffle_create_${raffle_id}`
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
                // Read actual pointsRequired from contract nftConfigs for accuracy
                // (sbt_thresholds.min_xp is a fallback if contract read fails)
                let burnedXP = minXpMap[actualTierOnChain] || 0;
                try {
                    const nftConfig = await rpcClient.readContract({
                        address: DAILY_APP_ADDRESS as `0x${string}`,
                        abi: [{ name: 'nftConfigs', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint8' }], outputs: [{ name: 'pointsRequired', type: 'uint256' }, { name: 'mintPrice', type: 'uint256' }, { name: 'dailyBonus', type: 'uint256' }, { name: 'multiplierBP', type: 'uint256' }, { name: 'maxSupply', type: 'uint256' }, { name: 'currentSupply', type: 'uint256' }, { name: 'isOpen', type: 'bool' }] }],
                        functionName: 'nftConfigs',
                        args: [actualTierOnChain]
                    }) as unknown as [bigint, bigint, bigint, bigint, bigint, bigint, boolean];
                    const contractBurn = Number(nftConfig[0]);
                    if (contractBurn > 0) burnedXP = contractBurn;
                } catch {
                    // Fallback to sbt_thresholds.min_xp if contract read fails
                }

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

        // PERMANENT FIX: Auto-sync DailyApp tier to MasterX after mint.
        // Uses WALLET_BOT_SIGNER (must be MasterX owner) to call batchUpdateUserTiers.
        // If the signer is not the owner, this will fail gracefully (fire-and-forget).
        try {
            if (WALLET_BOT_SIGNER && MASTER_X_ADDRESS) {
                const { createWalletClient, http } = await import('viem');
                const { privateKeyToAccount } = await import('viem/accounts');
                const { base, baseSepolia } = await import('viem/chains');

                const chain = isMainnet ? base : baseSepolia;
                const rpcUrl = isMainnet
                    ? getEnv('BASE_MAINNET_RPC_URL', 'https://mainnet.base.org')
                    : getEnv('BASE_SEPOLIA_RPC_URL', 'https://sepolia.base.org');

                const account = privateKeyToAccount(WALLET_BOT_SIGNER as `0x${string}`);
                const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

                const syncHash = await walletClient.writeContract({
                    address: MASTER_X_ADDRESS as `0x${string}`,
                    abi: MASTER_X_ABI,
                    functionName: 'batchUpdateUserTiers',
                    args: [[wallet.toLowerCase() as `0x${string}`], [actualTierOnChain]]
                });

                await logActivity({
                    wallet,
                    category: 'SYNC',
                    type: 'MasterX Tier Synced',
                    description: `Auto-synced tier ${actualTierOnChain} to MasterX contract`,
                    amount: 0,
                    symbol: 'XP',
                    txHash: syncHash,
                    metadata: { masterx_sync_tx: syncHash, tier: actualTierOnChain }
                });
            }
        } catch (masterXErr: unknown) {
            // Fire-and-forget: if bot signer is not MasterX owner, this fails gracefully.
            // Log warning so admin knows manual sync is needed.
            const errMsg = masterXErr instanceof Error ? masterXErr.message : String(masterXErr);
            console.warn('[handleSyncSbtUpgrade] MasterX auto-sync failed (bot may not be owner):', errMsg);
            await logActivity({
                wallet,
                category: 'SYNC',
                type: 'MasterX Tier Sync Failed',
                description: `Auto-sync to MasterX failed. Admin batchUpdateUserTiers needed.`,
                amount: 0,
                symbol: 'XP',
                txHash,
                metadata: { dailyapp_tier: actualTierOnChain, error: errMsg.slice(0, 200) }
            });
        }

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
        if (!txHash) return res.status(400).json({ error: 'Missing transaction hash' });

        const verifiedAmount = parseFloat(amountETH);
        let receipt;
        try {
            receipt = await rpcClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        } catch (err: unknown) {
            console.warn('[handleSyncPoolClaim] RPC lag fetching receipt:', err);
            return res.status(503).json({ error: 'RPC_STATE_LAG', message: 'Transaction verified but state is lagging. Please try again in a few seconds.' });
        }

        if (!receipt) {
            return res.status(503).json({ error: 'RPC_STATE_LAG', message: 'Transaction receipt not indexed yet.' });
        }

        if (receipt.status !== 'success') {
            return res.status(400).json({ error: 'Transaction reverted on-chain' });
        }

        if (receipt.from.toLowerCase() !== wallet.toLowerCase()) {
            return res.status(403).json({ error: 'Transaction sender does not match wallet' });
        }

        if (DAILY_APP_ADDRESS && receipt.to?.toLowerCase() !== DAILY_APP_ADDRESS.toLowerCase()) {
            return res.status(403).json({ error: 'Transaction destination is not the DailyApp contract' });
        }

        await logActivity({
            wallet,
            category: 'SBT',
            type: 'Pool Sharing Claim',
            description: `Claimed ${verifiedAmount.toFixed(6)} ETH from SBT pool (Tier ${tier})`,
            amount: verifiedAmount,
            symbol: 'ETH',
            txHash,
            metadata: { userTier: tier, feature: 'sbt_pool', tx_verified: true }
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
    metadata?: Json;
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

/**
 * awardReferralBonus — Awards passive XP dividend to the referrer when a referred user earns XP.
 * Fire-and-forget: never blocks the main flow.
 * @param userWallet - The wallet that just earned XP
 * @param xpEarned - Amount of XP the user earned
 * @param source - Description of what triggered the XP (for log)
 */
async function awardReferralBonus(userWallet: string, xpEarned: number, source: string) {
    if (!xpEarned || xpEarned <= 0) return;
    try {
        const cleanWallet = userWallet.toLowerCase();

        // 1. Check if user has a referrer and their current XP in a single query to prevent DB exhaustion
        const { data: profile } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('referred_by, total_xp')
            .eq('wallet_address', cleanWallet)
            .maybeSingle();

        if (!profile?.referred_by) return;
        const referrerWallet = profile.referred_by.toLowerCase();
        if (referrerWallet === cleanWallet) return; // [SECURITY HARDENING] Prevent self-referral XP loop

        // 2. Check if user has reached the active threshold (referrer only earns from active referrals)
        // Get threshold from system settings
        const { data: thresholdSetting } = await getSupabaseAdmin()
            .from('system_settings')
            .select('value')
            .eq('key', 'referral_active_threshold')
            .maybeSingle();
        const threshold = thresholdSetting?.value ? Number(thresholdSetting.value) : 500;

        if ((profile?.total_xp || 0) < threshold) return; // User not yet "active"

        // 3. Get bonus percentage from system settings
        const { data: bonusSetting } = await getSupabaseAdmin()
            .from('system_settings')
            .select('value')
            .eq('key', 'referral_bonus_percent')
            .maybeSingle();
        const bonusPercent = bonusSetting?.value ? Number(bonusSetting.value) : 10;

        // 4. Calculate and award bonus
        const bonusXp = Math.floor(xpEarned * (bonusPercent / 100));
        if (bonusXp <= 0) return;

        await getSupabaseAdmin().rpc('fn_increment_xp', {
            p_wallet: referrerWallet,
            p_amount: bonusXp
        });

        // 5. Log the referral bonus in activity history
        await logActivity({
            wallet: referrerWallet,
            category: 'XP',
            type: 'Referral Bonus',
            description: `Referral Bonus: +${bonusXp} XP (${bonusPercent}% of ${xpEarned} XP earned by ${cleanWallet.slice(0, 6)}...${cleanWallet.slice(-4)})`,
            amount: bonusXp,
            symbol: 'XP',
            metadata: { source, referred_user: cleanWallet, original_xp: xpEarned, bonus_percent: bonusPercent }
        });
    } catch (err: unknown) {
        // Fire-and-forget: never block the main flow
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[ReferralBonus] Error:', msg);
    }
}

async function handleLeaderboard(req: VercelRequest, res: VercelResponse) {
    try {
        // Force initialization check
        getSupabaseAdmin();
    } catch (initErr: unknown) {
        const msg = initErr instanceof Error ? initErr.message : String(initErr);
        return res.status(500).json({
            error: "Initialization Failed",
            message: msg,
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

        const { data, error } = await (getSupabaseAdmin() as unknown as UnknownTableClient)
            .from('pending_sync_jobs')
            .insert({
                wallet_address: cleanWallet,
                action_type,
                tx_hash: tx_hash || null,
                chain_id: chain_id || null,
                contract_address: contract_address ? String(contract_address).toLowerCase() : null,
                payload: payload ? toJson(payload) : null,
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
        const { data, error } = await (getSupabaseAdmin() as unknown as UnknownTableClient)
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
        // [SECURITY FIX] Client-Side OAuth Trust Vulnerability
        // Accepting 'oauth_data' directly from the frontend without a server-side Provider JWT validation 
        // allows attackers to pass {"twitter_id": "1", "twitter_username": "elonmusk"} and instantly bypass Identity Gating.
        // Endpoint MUST be disabled until a proper server-side token validation (e.g. Supabase Auth verifyOTP/getSession) is implemented.
        return res.status(501).json({ error: 'OAuth endpoint disabled: Server-side token validation required.' });
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

        // [SECURITY FIX] Cross-Table Data Corruption & Activation Deadlock
        // Previously only updated campaigns without activating the underlying tasks
        const { error: campErr } = await getSupabaseAdmin().from('campaigns').update({ is_active: true, status: 'active' }).eq('id', mission_id);
        if (campErr) throw campErr;

        const { error: taskErr } = await getSupabaseAdmin().from('daily_tasks').update({ is_active: true }).eq('target_id', mission_id);
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
    const { wallet, signature, message, service_key } = req.body || {};
    if (!service_key) return res.status(400).json({ error: 'Missing service_key' });
    
    try {
        // [SECURITY FIX] Unauthenticated Admin Health Reset
        // Previously missing signature and admin verification, allowing public alert suppression.
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });
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

/**
 * Wallet Attestation — FREE identity verification (no API cost).
 * User signs an EIP-191 message asserting they are a unique person.
 * Combined with on-chain transaction history (proves gas spend),
 * this is sufficient anti-Sybil for non-monetary flows (daily claim, basic XP).
 *
 * Higher-value flows (tier upgrades, raffle rewards, sponsorship) recommend
 * Farcaster/Twitter/Base for stronger Sybil resistance, but accept attestation as fallback.
 */
async function handleLinkWalletAttest(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message } = req.body;
    if (!wallet_address || !signature || !message) {
        return res.status(400).json({ error: 'Missing wallet_address, signature, or message' });
    }
    try {
        const valid = await verifyMessage({
            address: wallet_address as `0x${string}`,
            message,
            signature: signature as `0x${string}`
        });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // Validate message format: must contain assertion + wallet + timestamp
        const lowerMsg = String(message).toLowerCase();
        if (!lowerMsg.includes('disco gacha wallet attestation') ||
            !lowerMsg.includes(wallet_address.toLowerCase())) {
            return res.status(400).json({ error: 'Invalid attestation message format' });
        }

        // Replay protection: timestamp must be within last 5 minutes
        const isoMatch = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
        if (!isoMatch) return res.status(401).json({ error: 'Missing timestamp in message' });
        const messageTime = new Date(isoMatch[0]).getTime();
        if (Math.abs(Date.now() - messageTime) / (1000 * 60) > 5) {
            return res.status(401).json({ error: 'Attestation expired (max 5 min old)' });
        }

        const normalizedWallet = wallet_address.toLowerCase();

        const { data: existing } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('verifications')
            .eq('wallet_address', normalizedWallet)
            .maybeSingle();

        const currentVerifications = Array.isArray(existing?.verifications) ? existing.verifications : [];
        if (currentVerifications.includes('wallet-attest')) {
            return res.status(200).json({ success: true, already_attested: true });
        }

        const newVerifications = [...currentVerifications, 'wallet-attest'];

        const { error: updateErr } = await getSupabaseAdmin()
            .from('user_profiles')
            .update({ verifications: newVerifications, updated_at: new Date().toISOString() })
            .eq('wallet_address', normalizedWallet);
        if (updateErr) throw updateErr;

        await logActivity({
            wallet: normalizedWallet,
            category: 'IDENTITY',
            type: 'Wallet Attestation',
            description: 'Self-attested unique-person identity via wallet signature'
        });

        return res.status(200).json({ success: true, attested: true });
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

async function handleGetTierDistribution(req: VercelRequest, res: VercelResponse) {
    const body = req.method === 'POST' ? req.body : req.query;
    const { wallet, signature, message } = body || {};
    if (!wallet || !signature || !message) {
        return res.status(400).json({ error: 'Missing signature, wallet, or message' });
    }

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet))) return res.status(403).json({ error: 'Unauthorized' });

        const { data, error } = await getSupabaseAdmin().rpc('fn_get_tier_distribution');
        if (error) throw error;

        return res.status(200).json({ success: true, data: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
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

export default withMiddleware(handler);
