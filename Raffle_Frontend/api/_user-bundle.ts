import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { withMiddleware } from './_shared/middleware.js';
import type { Database } from './_shared/database.types.js';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { verifyMessage, keccak256, encodePacked, formatEther, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    NEYNAR_API_KEY,
    rpcClient,
    DAILY_APP_ADDRESS,
    SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS,
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
    logSystemError,
    NATIVE_TOKEN_ALIASES,
    DEX_SCREENER_API_URL
} from './_shared/constants.js';
import type {
    UserProfile,
    SyncPayload,
    XpSyncPayload,
    UgcMissionPayload,
    UgcRafflePayload,
    SbtMintEntitlementRequest,
    SbtMintEntitlementResponse,
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
type PublicActivityFeedItem = {
    id: string | number;
    name: string;
    avatar?: string;
    message: string;
    type: 'activity';
};

function isDailyActivityLog(log: Pick<ActivityLogRow, 'activity_type' | 'description'>): boolean {
    const type = String(log.activity_type || '').toLowerCase();
    const description = String(log.description || '').toLowerCase();
    return type.includes('daily claim')
        || type.includes('on-chain daily claim')
        || description.startsWith('daily claim')
        || description.includes('daily bonus');
}

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

const DAILY_APP_SBT_MINT_EVENT_ABI = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'user', type: 'address' },
            { indexed: false, name: 'tier', type: 'uint8' },
            { indexed: false, name: 'tokenId', type: 'uint256' }
        ],
        name: 'NFTMinted',
        type: 'event'
    }
] as const;

type DailyAppSbtMintLog = {
    args?: {
        user?: `0x${string}`;
        tier?: number;
        tokenId?: bigint;
    };
};

type UnknownTableClient = {
    from: (table: string) => {
        insert: (value: PendingSyncJobInsert) => {
            select: (columns: string) => {
                maybeSingle: () => Promise<{ data: { id?: string | number } | null; error: { message: string } | null }>;
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

type TokenPriceMap = Record<string, unknown>;
type DexScreenerPair = {
    baseToken?: { address?: string };
    liquidity?: { usd?: string | number };
    priceUsd?: string;
};

const toPositiveNumber = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeTokenAddress = (address?: string | null): string => (address || '').trim().toLowerCase();

const lookupConfiguredTokenPrice = (
    tokenPrices: TokenPriceMap,
    symbol: string,
    tokenAddress?: string | null
): number => {
    const normalizedSymbol = symbol.toUpperCase();
    const normalizedAddress = normalizeTokenAddress(tokenAddress);
    return (
        toPositiveNumber(tokenPrices[normalizedSymbol]) ||
        toPositiveNumber(tokenPrices[normalizedSymbol.toLowerCase()]) ||
        toPositiveNumber(tokenPrices[normalizedAddress]) ||
        (normalizedSymbol === 'ETH' || normalizedSymbol === 'WETH'
            ? (toPositiveNumber(tokenPrices.ETH) || toPositiveNumber(tokenPrices.WETH))
            : 0)
    );
};

async function fetchEthPriceUsd(): Promise<number> {
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDC');
        if (!response.ok) return 0;
        const data = await response.json() as { price?: string };
        return toPositiveNumber(data.price);
    } catch (_) {
        return 0;
    }
}

async function fetchDexScreenerTokenPriceUsd(tokenAddress: string): Promise<number> {
    const normalizedAddress = normalizeTokenAddress(tokenAddress);
    if (!normalizedAddress || NATIVE_TOKEN_ALIASES.has(normalizedAddress)) return 0;

    try {
        const response = await fetch(`${DEX_SCREENER_API_URL}/${normalizedAddress}`);
        if (!response.ok) return 0;
        const data = await response.json() as { pairs?: DexScreenerPair[] };
        const pairs = Array.isArray(data.pairs) ? data.pairs : [];
        const bestPair = pairs
            .filter((pair) => normalizeTokenAddress(pair.baseToken?.address) === normalizedAddress)
            .sort((a, b) => toPositiveNumber(b.liquidity?.usd) - toPositiveNumber(a.liquidity?.usd))[0];

        return toPositiveNumber(bestPair?.priceUsd);
    } catch (_) {
        return 0;
    }
}

async function resolveTokenPriceUsd(
    symbol: string,
    tokenAddress: string | undefined,
    tokenPrices: TokenPriceMap
): Promise<number> {
    const normalizedSymbol = symbol.toUpperCase();
    const normalizedAddress = normalizeTokenAddress(tokenAddress);
    if (normalizedSymbol === 'USDC') return 1;

    const configuredPrice = lookupConfiguredTokenPrice(tokenPrices, normalizedSymbol, normalizedAddress);
    if (configuredPrice > 0) return configuredPrice;

    if (normalizedSymbol === 'ETH' || normalizedSymbol === 'WETH' || NATIVE_TOKEN_ALIASES.has(normalizedAddress)) {
        const ethPrice = await fetchEthPriceUsd();
        if (ethPrice > 0) return ethPrice;
    }

    return fetchDexScreenerTokenPriceUsd(normalizedAddress);
}

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

    if (['daily-claim', 'xp', 'sync-pool-claim'].includes(action)) {
        if (!(await checkFeatureGuard('daily_claim', res))) return;
    }

    if (['sbt-mint-entitlement', 'sync-sbt-upgrade'].includes(action)) {
        if (!(await checkFeatureGuard('sbt_minting', res))) return;
    }

    if (['sync-ugc-mission', 'sync-ugc-raffle'].includes(action)) {
        if (!(await checkFeatureGuard('ugc_payment', res))) return;
    }

    if (['sync', 'nonce', 'update-profile', 'fc-sync'].includes(action)) {
        if (!(await checkFeatureGuard('login_and_social', res))) return;
    }

    switch (action) {
        case 'sync': await handleLoginSync(req, res); break;
        case 'nonce': await handleGenerateNonce(req, res); break;
        case 'xp': await handleXpSync(req, res); break;
        case 'fc-sync': await handleFarcasterSync(req, res); break;
        case 'update-profile': await handleUpdateProfile(req, res); break;
        case 'get-activity-logs': await handleGetActivityLogs(req, res); break;
        case 'get-public-activity-feed': await handleGetPublicActivityFeed(req, res); break;
        case 'get-profile': await handleGetProfile(req, res); break;
        case 'log-activity': await handleFrontendLogActivity(req, res); break;
        case 'get-point-settings': await handleGetPointSettings(req, res); break;
        case 'sync-ugc-mission': await handleSyncUgcMission(req, res); break;
        case 'sync-ugc-raffle': await handleSyncUgcRaffle(req, res); break;
        case 'sbt-mint-entitlement': await handleSbtMintEntitlement(req, res); break;
        case 'sync-sbt-upgrade': await handleSyncSbtUpgrade(req, res); break;
        case 'daily-claim': await handleDailyClaim(req, res); break;
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

function getWalletBotAccount() {
    if (!WALLET_BOT_SIGNER) return null;
    const privateKey = WALLET_BOT_SIGNER.startsWith('0x') ? WALLET_BOT_SIGNER : `0x${WALLET_BOT_SIGNER}`;
    return privateKeyToAccount(privateKey as `0x${string}`);
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

        const account = getWalletBotAccount();
        if (!account) return res.status(500).json({ error: 'Signer wallet not configured' });

        const messageHash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint256', 'uint256', 'address'],
                [
                    wallet_address,
                    BigInt(totalXp),
                    BigInt(deadline),
                    BigInt(CHAIN_ID),
                    DAILY_APP_ADDRESS as `0x${string}`
                ]
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

function signNonce(walletAddress: string, nonce: string, issuedAt: number): string {
    const data = `${walletAddress.toLowerCase()}:${nonce}:${issuedAt}`;
    const hmac = crypto.createHmac('sha256', SUPABASE_SERVICE_ROLE_KEY || 'default-secret');
    hmac.update(data);
    return hmac.digest('hex');
}

async function handleGenerateNonce(req: VercelRequest, res: VercelResponse) {
    const walletAddress = req.body?.wallet_address || req.query?.wallet_address;
    if (!walletAddress) {
        return res.status(400).json({ error: 'Missing wallet_address' });
    }

    try {
        const cleanAddress = String(walletAddress).trim().toLowerCase();
        const nonce = Math.random().toString(36).substring(2, 12);
        const issuedAt = Date.now();
        const signature = signNonce(cleanAddress, nonce, issuedAt);
        const token = `${signature}.${issuedAt}`;

        return res.status(200).json({
            success: true,
            nonce,
            token
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleLoginSync(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, fid, referred_by, token } = req.body as SyncPayload & { token?: string };
    if (!wallet_address || !signature || !message) return res.status(400).json({ error: 'Missing fields' });

    // Validate SIWE stateless signed nonce token
    if (!token) {
        return res.status(401).json({ error: 'Missing authentication nonce token. Please sign in again.' });
    }

    try {
        const [tokenSignature, issuedAtStr] = token.split('.');
        const issuedAt = parseInt(issuedAtStr || '', 10);
        if (!tokenSignature || isNaN(issuedAt)) {
            return res.status(401).json({ error: 'Invalid authentication token format.' });
        }

        // Replay Protection & Cooldown check: max 10 minutes (600,000 ms)
        if (Date.now() - issuedAt > 10 * 60 * 1000) {
            return res.status(401).json({ error: 'Session/nonce expired. Please sign in again.' });
        }
        if (issuedAt - Date.now() > 5 * 60 * 1000) { // clock skew check
            return res.status(401).json({ error: 'Clock skew detected. Please sync system clock.' });
        }

        // Parse nonce from SIWE message
        const nonceMatch = message.match(/Nonce:\s*([a-zA-Z0-9]+)/);
        const nonce = nonceMatch ? nonceMatch[1] : '';
        if (!nonce) {
            return res.status(401).json({ error: 'Invalid SIWE message structure: Missing Nonce.' });
        }

        // Verify that the token is valid for this address, nonce, and timestamp
        const expectedSignature = signNonce(wallet_address, nonce, issuedAt);
        if (tokenSignature.length !== expectedSignature.length) {
            return res.status(401).json({ error: 'Invalid authentication signature token.' });
        }
        const isValidToken = crypto.timingSafeEqual(
            Buffer.from(tokenSignature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
        if (!isValidToken) {
            return res.status(401).json({ error: 'Authentication token verification failed.' });
        }

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

        let xpDelta = 0;
        let isReset = false;
        if (currentOnChainXp > lastOnChainXp) {
            xpDelta = currentOnChainXp - lastOnChainXp;
        } else if (currentOnChainXp < lastOnChainXp) {
            // Contract reset or upgrade occurred (e.g. V15 -> V16).
            // Points earned on the new contract represent new XP that has not yet been synced.
            xpDelta = currentOnChainXp;
            isReset = true;
            console.warn(`[Contract Reset Detected] for ${cleanAddress}. db_last_onchain_xp: ${lastOnChainXp}, current_onchain_xp: ${currentOnChainXp}. Watermark will be reset to ${currentOnChainXp}.`);
        }
        const finalLastOnChainXpToSave = currentOnChainXp;

        const currentTotalXp = profile?.total_xp || 0;
        let recoveryDelta = 0;
        if (!isReset && currentTotalXp < lastOnChainXp) {
            recoveryDelta = lastOnChainXp - currentTotalXp;
            console.warn(`[Deadlock Recovery] Under-sync detected for ${cleanAddress}. total_xp: ${currentTotalXp}, last_onchain_xp: ${lastOnChainXp}. Recovery amount: ${recoveryDelta} XP.`);
        }

        const totalXpToIncrement = xpDelta + recoveryDelta;

        if (xpDelta === 0 && recoveryDelta === 0 && tx_hash && skipSignature) {
            // [SECURITY FIX] Phantom Claim Exploit Prevention
            // Never blindly force XP if the node reads 0 delta. It could be a fake 0 ETH transfer.
            // Return 503 so the frontend queues it in pending_sync_jobs. If it's real RPC lag, 
            // the CRON will eventually read the correct delta and grant the XP securely.
            return res.status(503).json({ error: 'RPC_STATE_LAG', message: 'Transaction verified but state is lagging. Queued for CRON.' });
        }
        
        const isDailyClaim = !!(tx_hash && skipSignature);
        let currentStreakToSave = profile?.streak_count || 0;
        let lastStreakClaimToSave = profile?.last_streak_claim || null;
        
        if (isDailyClaim && xpDelta > 0) {
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

        if (totalXpToIncrement > 0 || isReset) {
            // Rule 60: COOLDOWN ENFORCEMENT for Daily Claim — check BEFORE incrementing
            if (isDailyClaim && xpDelta > 0) {
                if (profile?.last_streak_claim) {
                    const lastDate = new Date(profile.last_streak_claim);
                    const hoursSince = (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60);
                    if (hoursSince < 20) {
                        return res.status(429).json({ error: 'Daily claim cooldown still active', cooldown_remaining_hours: Math.ceil(20 - hoursSince) });
                    }
                }
            }
            
            // [SECURITY FIX] Optimistic Concurrency Control (OCC) for both watermark (last_onchain_xp) and XP recovery
            const updatePayload: Database['public']['Tables']['user_profiles']['Update'] = {
                tier: currentTierOnChain,
                updated_at: new Date().toISOString()
            };

            if (xpDelta > 0 || isReset) {
                updatePayload.last_onchain_xp = finalLastOnChainXpToSave;
            }

            if (isDailyClaim) {
                updatePayload.streak_count = currentStreakToSave;
                updatePayload.last_streak_claim = lastStreakClaimToSave;
            }

            const { data: updateData, error: updateErr } = await getSupabaseAdmin()
                .from('user_profiles')
                .update(updatePayload)
                .eq('wallet_address', cleanAddress)
                .eq('last_onchain_xp', lastOnChainXp) // Prevent concurrent watermark moves
                .eq('total_xp', currentTotalXp)       // Prevent concurrent recovery/XP changes
                .select('wallet_address');

            if (updateErr) throw updateErr;
            if (!updateData || updateData.length === 0) {
                // High watermark or total_xp already changed by a concurrent request. Abort to prevent double-spending/double-recovery.
                return res.status(409).json({ error: 'Conflict: Sync already processed.' });
            }

            // Safe to increment total_xp ONLY AFTER securing the watermark update
            if (totalXpToIncrement > 0) {
                const { error: rpcErr } = await getSupabaseAdmin().rpc('fn_increment_xp', {
                    p_wallet: cleanAddress,
                    p_amount: totalXpToIncrement
                });

                if (rpcErr) throw rpcErr;
            }

            // Determine if this is a daily claim vs generic XP sync
            const logCategory = 'XP';
            const logType = isDailyClaim ? 'On-chain Daily Claim' : 'Ledger Sync';
            
            // [UX FIX] Log the ACTUAL new streak and recovery status
            let logDescription = '';
            if (xpDelta > 0 && recoveryDelta > 0) {
                logDescription = `Daily claim: +${xpDelta} XP (streak: ${currentStreakToSave}) and recovered +${recoveryDelta} XP from under-sync.`;
            } else if (xpDelta > 0) {
                logDescription = isDailyClaim
                    ? `Daily claim: +${xpDelta} XP (streak: ${currentStreakToSave})`
                    : `Synced ${xpDelta} XP from Base Ledger (Parity: ${currentOnChainXp})`;
            } else if (isReset) {
                logDescription = `Contract Upgrade Alignment: Reset on-chain watermark to ${currentOnChainXp}`;
            } else {
                logDescription = `Ecosystem Parity Recovery: Restored +${recoveryDelta} XP from under-sync.`;
            }

            await logActivity({
                wallet: cleanAddress,
                category: logCategory,
                type: recoveryDelta > 0 && xpDelta === 0 ? 'Parity Recovery' : logType,
                description: logDescription,
                amount: totalXpToIncrement,
                symbol: 'XP',
                txHash: (cleanTxHash && skipSignature) ? cleanTxHash : null,
                metadata: {
                    chain_id: isMainnet ? 8453 : 84532,
                    contract_address: DAILY_APP_ADDRESS,
                    on_chain_xp: currentOnChainXp,
                    sync_status: 'synced',
                    recovered_xp: recoveryDelta
                }
            });

            if (xpDelta > 0) {
                // Award referral bonus to referrer (fire-and-forget)
                awardReferralBonus(cleanAddress, xpDelta, logType).catch(() => {});
            }

            result.xp_synced = totalXpToIncrement;
        }

        return res.status(200).json(result);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        await logSystemError({
            surface: 'api',
            bundle: 'user-bundle',
            action: 'xp-sync',
            wallet_address: wallet_address || 'unknown',
            message: sanitizeError(msg)
        });
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
        const cleanWallet = wallet.toLowerCase();
        const [viewResult, profileResult] = await Promise.all([
            getSupabaseAdmin()
            .from('v_user_full_profile')
            .select('*')
                .eq('wallet_address', cleanWallet)
                .maybeSingle(),
            getSupabaseAdmin()
                .from('user_profiles')
                .select('wallet_address,total_xp,tier,streak_count,raffle_tickets_bought,raffles_created,last_streak_claim,last_daily_bonus_claim,is_base_social_verified,base_username,display_name,username,pfp_url,last_onchain_xp,updated_at')
                .eq('wallet_address', cleanWallet)
                .maybeSingle()
        ]);

        if (viewResult.error) throw viewResult.error;
        if (profileResult.error) throw profileResult.error;

        const data = viewResult.data || profileResult.data
            ? { ...(viewResult.data || {}), ...(profileResult.data || {}) }
            : null;
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
            } else if (category === 'DAILY') {
                logsQuery = logsQuery
                    .eq('category', 'XP')
                    .or('activity_type.ilike.%daily claim%,description.ilike.daily claim%,description.ilike.%daily bonus%');
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
            category: isDailyActivityLog(log) ? 'DAILY' : log.category,
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

async function handleGetPublicActivityFeed(req: VercelRequest, res: VercelResponse) {
    const { limit = '10' } = req.query as { limit?: string };

    try {
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 20);
        const { data: logs, error: logError } = await getSupabaseAdmin()
            .from('user_activity_logs')
            .select('id, description, activity_type, created_at, wallet_address')
            .order('created_at', { ascending: false })
            .limit(parsedLimit);

        if (logError) throw logError;
        const typedLogs = (logs || []) as Array<{
            id: string | number;
            description: string | null;
            activity_type: string | null;
            wallet_address: string;
        }>;

        if (typedLogs.length === 0) {
            return res.status(200).json({ success: true, activities: [] });
        }

        const wallets = [...new Set(typedLogs.map((log) => String(log.wallet_address || '').trim().toLowerCase()).filter(Boolean))];
        const { data: profiles, error: profileError } = await getSupabaseAdmin()
            .from('v_user_full_profile')
            .select('wallet_address, display_name, username, pfp_url')
            .in('wallet_address', wallets);

        if (profileError) throw profileError;
        const profileMap = ((profiles || []) as Array<{
            wallet_address: string;
            display_name: string | null;
            username: string | null;
            pfp_url: string | null;
        }>).reduce((acc: Record<string, { display_name: string | null; username: string | null; pfp_url: string | null }>, profile) => {
            acc[String(profile.wallet_address || '').toLowerCase()] = profile;
            return acc;
        }, {});

        const activities: PublicActivityFeedItem[] = typedLogs.map((log) => {
            const wallet = String(log.wallet_address || '').trim().toLowerCase();
            const profile = profileMap[wallet];
            return {
                id: log.id,
                name: profile?.display_name || profile?.username || `${wallet.slice(0, 4)}...${wallet.slice(-4)}`,
                avatar: profile?.pfp_url || undefined,
                message: log.description || log.activity_type || 'is active in the Nexus',
                type: 'activity'
            };
        });

        return res.status(200).json({ success: true, activities });
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

        // [SECURITY FIX] Disallow frontend from logging sensitive/admin categories to prevent Admin Metrics Poisoning.
        // Financial/Swap categories are allowed ONLY if they include a txHash that is successfully verified on-chain.
        const forbiddenCategories = ['XP', 'ADMIN'];
        if (forbiddenCategories.includes(category?.toUpperCase())) {
            return res.status(403).json({ error: `Category ${category} must be logged by the backend.` });
        }

        // For financial activities (PURCHASE/REWARD/SWAP), verify receipt on-chain
        let receiptVerified = false;
        const isFinancialOrSwap = ['PURCHASE', 'REWARD', 'SWAP'].includes(category?.toUpperCase());

        if (isFinancialOrSwap) {
            if (!txHash) {
                return res.status(400).json({ error: `Category ${category} requires a transaction hash (txHash) for verification.` });
            }
            try {
                const receipt = await rpcClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
                receiptVerified = receipt?.status === 'success' && receipt.from.toLowerCase() === wallet_address.toLowerCase();
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error('[handleFrontendLogActivity] Transaction receipt verification error:', msg);
            }
            if (!receiptVerified) {
                return res.status(400).json({ error: `On-chain transaction verification failed for category ${category}.` });
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

        const [{ data: ugcConfigRes }, { data: sysSetting }, { data: pointSetting }, { data: tokenPricesRes }] = await Promise.all([
            getSupabaseAdmin().from('system_settings').select('value').eq('key', 'ugc_config').maybeSingle(),
            getSupabaseAdmin().from('system_settings').select('value').eq('key', 'sponsorship_listing_fee_usdc').maybeSingle(),
            getSupabaseAdmin().from('point_settings').select('points_value').eq('activity_key', 'ugc_task_completion').maybeSingle(),
            getSupabaseAdmin().from('system_settings').select('value').eq('key', 'token_prices_usd').maybeSingle()
        ]);

        const ugcConfig = (ugcConfigRes?.value || {}) as Record<string, unknown>;
        const minRewardPerTaskUsdc = parseFloat(String(ugcConfig.min_reward_amount || '0.01'));
        const taskCount = Array.isArray(tasks_batch) ? tasks_batch.length : 1;
        const minRewardUsdc = minRewardPerTaskUsdc * taskCount;

        // [v3.64.10] Enforce backend budget check with server-side live price resolution.
        const tokenPrices = (tokenPricesRes?.value || {}) as TokenPriceMap;
        const symbol = (reward_symbol || 'USDC').toUpperCase();
        const rewardAmount = parseFloat(String(reward_amount_per_user));
        if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
            return res.status(400).json({ error: '[Budget Guard] Reward per user must be greater than 0.' });
        }

        const tokenPrice = await resolveTokenPriceUsd(symbol, payment_token, tokenPrices);
        if (tokenPrice <= 0) {
            return res.status(400).json({ error: `[Price Oracle] Live USD price is unavailable for ${symbol}. Please choose a supported liquid token or wait for market indexing.` });
        }

        const rewardAmountUsdc = rewardAmount * tokenPrice;
        if (rewardAmountUsdc < minRewardUsdc * 0.95) { // 5% buffer for price fluctuations
            return res.status(400).json({ error: `[Budget Guard] Reward per user must be at least $${minRewardUsdc.toFixed(2)} USDC equivalent for ${taskCount} task(s) ($${minRewardPerTaskUsdc.toFixed(2)} per task). Provided: $${rewardAmountUsdc.toFixed(6)} USDC.` });
        }

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

async function handleSbtMintEntitlement(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, requested_tier } = req.body as Partial<SbtMintEntitlementRequest>;
    if (!wallet || !signature || !message || !requested_tier) {
        return res.status(400).json({ error: 'Missing entitlement data' });
    }

    try {
        const valid = await verifyMessage({
            address: wallet as `0x${string}`,
            message,
            signature: signature as `0x${string}`
        });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanWallet = wallet.toLowerCase();
        const requestedTier = Number(requested_tier);
        if (!Number.isInteger(requestedTier) || requestedTier < 1 || requestedTier > 5) {
            return res.status(400).json({ error: 'Invalid requested_tier' });
        }

        const lowerMessage = message.toLowerCase();
        if (!lowerMessage.includes('sbt mint entitlement') || !lowerMessage.includes(cleanWallet)) {
            return res.status(400).json({ error: 'Invalid entitlement message format' });
        }

        const isVerified = await checkIdentityStatus(cleanWallet);
        if (!isVerified) {
            const body: SbtMintEntitlementResponse = {
                success: false,
                eligible: false,
                voucher_status: 'not_issued',
                reason: 'Identity verification required for SBT mint entitlement'
            };
            return res.status(403).json(body);
        }

        if (!SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS) {
            return res.status(500).json({ error: 'SBT entitlement verifier is not configured' });
        }

        const account = getWalletBotAccount();
        if (!account) return res.status(500).json({ error: 'Signer wallet not configured' });

        const { data: profile, error: profileErr } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('total_xp, tier')
            .eq('wallet_address', cleanWallet)
            .maybeSingle();
        if (profileErr) throw profileErr;
        if (!profile) return res.status(404).json({ error: 'User profile not found' });

        const { data: threshold, error: thresholdErr } = await getSupabaseAdmin()
            .from('sbt_thresholds')
            .select('level, tier_name, min_xp')
            .eq('level', requestedTier)
            .maybeSingle();
        if (thresholdErr) throw thresholdErr;
        if (!threshold) return res.status(404).json({ error: 'SBT threshold not found' });

        const contractStats = await rpcClient.readContract({
            address: DAILY_APP_ADDRESS as `0x${string}`,
            abi: DAILY_APP_USER_STATS_ABI,
            functionName: 'userStats',
            args: [cleanWallet as `0x${string}`],
        }) as unknown as [bigint, bigint, bigint, number, bigint, bigint, boolean];

        const currentOnchainXp = Number(contractStats?.[0] || 0);
        const currentOnchainTier = Number(contractStats?.[3] || 0);
        const expectedNextTier = currentOnchainTier + 1;
        if (requestedTier !== expectedNextTier) {
            const body: SbtMintEntitlementResponse = {
                success: false,
                eligible: false,
                voucher_status: 'not_issued',
                reason: `Sequential tier required. Next mintable tier is ${expectedNextTier}.`
            };
            return res.status(409).json(body);
        }

        const nftConfig = await rpcClient.readContract({
            address: DAILY_APP_ADDRESS as `0x${string}`,
            abi: [{ name: 'nftConfigs', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint8' }], outputs: [{ name: 'pointsRequired', type: 'uint256' }, { name: 'mintPrice', type: 'uint256' }, { name: 'dailyBonus', type: 'uint256' }, { name: 'multiplierBP', type: 'uint256' }, { name: 'maxSupply', type: 'uint256' }, { name: 'currentSupply', type: 'uint256' }, { name: 'isOpen', type: 'bool' }] }],
            functionName: 'nftConfigs',
            args: [requestedTier]
        }) as unknown as [bigint, bigint, bigint, bigint, bigint, bigint, boolean];

        const requiredXp = threshold.min_xp;
        const maxSupply = Number(nftConfig[4] || 0n);
        const currentSupply = Number(nftConfig[5] || 0n);
        const isOpen = Boolean(nftConfig[6]);
        const dbTotalXp = profile.total_xp || 0;

        let reason: string | undefined;
        if (dbTotalXp < requiredXp) reason = 'Database XP is below required tier threshold';
        else if (!isOpen) reason = 'Requested SBT tier is not open';
        else if (maxSupply > 0 && currentSupply >= maxSupply) reason = 'Requested SBT tier is sold out';

        if (reason) {
            const body: SbtMintEntitlementResponse = {
                success: false,
                eligible: false,
                voucher_status: 'not_issued',
                reason
            };
            return res.status(409).json(body);
        }

        const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
        const expiresAt = new Date(deadline * 1000).toISOString();
        const nonceHex = keccak256(encodePacked(
            ['address', 'uint8', 'uint256', 'uint256'],
            [cleanWallet as `0x${string}`, requestedTier, BigInt(requiredXp), BigInt(deadline)]
        ));
        const nonce = BigInt(nonceHex);

        const entitlement = {
            wallet: cleanWallet as `0x${string}`,
            targetContract: DAILY_APP_ADDRESS as `0x${string}`,
            targetTier: requestedTier,
            requiredXp: BigInt(requiredXp),
            nonce,
            deadline: BigInt(deadline)
        };

        const typedSignature = await account.signTypedData({
            domain: {
                name: 'DiscoDailySBTMintEntitlement',
                version: '1',
                chainId: Number(CHAIN_ID),
                verifyingContract: SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS as `0x${string}`
            },
            types: {
                SBTMintEntitlement: [
                    { name: 'wallet', type: 'address' },
                    { name: 'targetContract', type: 'address' },
                    { name: 'targetTier', type: 'uint8' },
                    { name: 'requiredXp', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' }
                ]
            },
            primaryType: 'SBTMintEntitlement',
            message: entitlement
        });

        const body: SbtMintEntitlementResponse = {
            success: true,
            eligible: true,
            voucher_status: 'signed',
            voucher: {
                wallet: cleanWallet,
                tier: requestedTier,
                tier_name: threshold.tier_name || `Tier ${requestedTier}`,
                db_total_xp: dbTotalXp,
                required_xp: requiredXp,
                current_onchain_tier: currentOnchainTier,
                current_onchain_xp: currentOnchainXp,
                mint_price_wei: String(nftConfig[1] || 0n),
                contract_address: DAILY_APP_ADDRESS,
                verifier_address: SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS,
                chain_id: isMainnet ? 8453 : 84532,
                deadline,
                expires_at: expiresAt,
                nonce: nonce.toString(),
                signature: typedSignature
            }
        };

        return res.status(200).json(body);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleSyncSbtUpgrade(req: VercelRequest, res: VercelResponse) {
    const { wallet, signature, message, payload } = req.body;
    if (!wallet || !payload) return res.status(400).json({ error: 'Missing sync data' });

    try {
        const cleanWallet = String(wallet).trim().toLowerCase();
        const { tierName: payloadTierName, ethSpent, txHash } = payload;
        if (!txHash) return res.status(400).json({ error: 'Missing transaction hash' });
        const cleanTxHash = String(txHash).trim().toLowerCase();

        if (signature && message) {
            const valid = await verifyMessage({
                address: cleanWallet as `0x${string}`,
                message,
                signature: signature as `0x${string}`
            });
            if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        }

        // Rule 61: IDENTITY GATING MANDATE
        const isVerified = await checkIdentityStatus(cleanWallet);
        if (!isVerified) return res.status(403).json({ error: 'Identity verification required for tier upgrades' });

        const receipt = await rpcClient.waitForTransactionReceipt({ hash: cleanTxHash as `0x${string}`, timeout: 15000 });
        if (!receipt || receipt.status !== 'success') {
            return res.status(400).json({ error: 'SBT mint transaction reverted or invalid on-chain' });
        }
        if (receipt.from.toLowerCase() !== cleanWallet) {
            return res.status(403).json({ error: 'Transaction sender does not match wallet' });
        }
        if (DAILY_APP_ADDRESS && receipt.to?.toLowerCase() !== DAILY_APP_ADDRESS.toLowerCase()) {
            return res.status(403).json({ error: 'Transaction destination is not the DailyApp contract' });
        }

        const mintLogs = parseEventLogs({
            abi: DAILY_APP_SBT_MINT_EVENT_ABI,
            eventName: 'NFTMinted',
            logs: receipt.logs,
            strict: false
        }) as DailyAppSbtMintLog[];
        const mintLog = mintLogs.find((log) => String(log.args?.user || '').toLowerCase() === cleanWallet);
        if (!mintLog) {
            return res.status(400).json({ error: 'Transaction did not emit a DailyApp SBT mint event for this wallet' });
        }

        const { data: thresholds } = await getSupabaseAdmin().from('sbt_thresholds').select('level, tier_name, min_xp, badge_url');
        const tierMap: Record<string, number> = thresholds?.reduce((acc, t) => { if (t.tier_name) acc[t.tier_name] = t.level; return acc; }, {} as Record<string, number>) || {};
        const minXpMap: Record<number, number> = thresholds?.reduce((acc, t) => { acc[t.level] = t.min_xp; return acc; }, {} as Record<number, number>) || {};
        const mintedTier = Number(mintLog.args?.tier || 0);
        const thresholdMeta = thresholds?.find((t) => Number(t.level) === mintedTier);
        const tierName = String(payloadTierName || thresholdMeta?.tier_name || `Tier ${mintedTier}`);
        const tierIndex = tierMap[tierName] || mintedTier;
        const tokenId = mintLog.args?.tokenId != null
            ? String(mintLog.args.tokenId)
            : (mintedTier > 0 ? String(mintedTier) : String(cleanTxHash));

        const contractStats = await rpcClient.readContract({
            address: DAILY_APP_ADDRESS as `0x${string}`,
            abi: DAILY_APP_USER_STATS_ABI,
            functionName: 'userStats',
            args: [cleanWallet as `0x${string}`],
        }) as unknown as [bigint, bigint, bigint, number, bigint, bigint, boolean];

        const actualTierOnChain = Number(contractStats?.[3] || 0);
        const actualPointsOnChain = Number(contractStats?.[0] || 0);
        if (actualTierOnChain < mintedTier) {
            return res.status(503).json({ error: 'RPC_STATE_LAG', message: 'SBT mint event indexed but user tier is not updated yet. Please retry shortly.' });
        }

        let ethSpentValue = parseFloat(String(ethSpent ?? ''));
        if (!Number.isFinite(ethSpentValue) || ethSpentValue < 0) {
            const tx = await rpcClient.getTransaction({ hash: cleanTxHash as `0x${string}` });
            ethSpentValue = parseFloat(formatEther(tx.value || 0n));
        }

        if (actualTierOnChain >= tierIndex && tierIndex > 0) {
            // Check if burn already logged to prevent double-burn on retry
            const { data: existingBurn } = await getSupabaseAdmin().from('user_task_claims').select('id').eq('task_id', `sbt_upgrade_burn_${cleanTxHash}`).maybeSingle();

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
                        wallet_address: cleanWallet,
                        task_id: `sbt_upgrade_burn_${cleanTxHash}`,
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
                .eq('wallet_address', cleanWallet);
        }

        const { data: existingPurchaseLog } = await getSupabaseAdmin()
            .from('user_activity_logs')
            .select('id')
            .eq('wallet_address', cleanWallet)
            .eq('tx_hash', cleanTxHash)
            .eq('category', 'PURCHASE')
            .eq('activity_type', 'SBT Tier Ascension')
            .maybeSingle();

        if (!existingPurchaseLog) {
            await logActivity({
                wallet: cleanWallet,
                category: 'PURCHASE',
                type: 'SBT Tier Ascension',
                description: `Upgraded to ${tierName} Tier (Ledger Verified)`,
                amount: ethSpentValue,
                symbol: 'ETH',
                txHash: cleanTxHash,
                metadata: { tierName, onchain_tier: actualTierOnChain, tx_verified: true }
            });
        }

        // Dedicated SBT / Mint event for profile/admin filter
        const { data: existingMintLog } = await getSupabaseAdmin()
            .from('user_activity_logs')
            .select('id')
            .eq('wallet_address', cleanWallet)
            .eq('tx_hash', cleanTxHash)
            .eq('category', 'SBT')
            .eq('activity_type', 'Mint')
            .maybeSingle();

        if (!existingMintLog) {
            await logActivity({
                wallet: cleanWallet,
                category: 'SBT',
                type: 'Mint',
                description: `Minted ${tierName} SBT NFT`,
                amount: ethSpentValue,
                symbol: 'ETH',
                txHash: cleanTxHash,
                metadata: {
                    tier: actualTierOnChain,
                    tier_name: tierName,
                    token_id: tokenId,
                    name: `${tierName} SBT #${tokenId}`,
                    image_url: thresholdMeta?.badge_url || null,
                    mint_price_eth: ethSpentValue,
                    contract_address: DAILY_APP_ADDRESS,
                    chain_id: isMainnet ? 8453 : 84532,
                    tx_verified: true
                }
            });
        }

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
                    args: [[cleanWallet as `0x${string}`], [actualTierOnChain]]
                });

                await logActivity({
                    wallet: cleanWallet,
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
                wallet: cleanWallet,
                category: 'SYNC',
                type: 'MasterX Tier Sync Failed',
                description: `Auto-sync to MasterX failed. Admin batchUpdateUserTiers needed.`,
                amount: 0,
                symbol: 'XP',
                txHash: cleanTxHash,
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

/**
 * handleDailyClaim — Synchronous single-signature daily claim handler.
 * [v3.64.33-Hardened] Frontend sends tx_hash after claimDailyBonus() succeeds.
 * Backend verifies on-chain receipt, reads contract userStats, and immediately
 * updates user_profiles (streak, last_onchain_xp, total_xp via fn_increment_xp)
 * and logs activity — all in one atomic flow. No extra signMessage needed.
 */
async function handleDailyClaim(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, tx_hash, chain_id } = req.body;
    if (!wallet_address || !tx_hash) return res.status(400).json({ error: 'Missing wallet_address or tx_hash' });

    try {
        const cleanAddress = wallet_address.toLowerCase();
        const cleanTxHash = String(tx_hash).trim().toLowerCase();

        // 1. Prevent replay: check if this tx_hash was already synced
        const { data: existingLog } = await getSupabaseAdmin()
            .from('user_activity_logs')
            .select('id')
            .eq('tx_hash', cleanTxHash)
            .maybeSingle();

        if (existingLog) {
            return res.status(200).json({ success: true, xp_synced: 0, already_synced: true });
        }

        // 2. Verify on-chain receipt
        let receipt;
        try {
            receipt = await rpcClient.waitForTransactionReceipt({ hash: cleanTxHash as `0x${string}`, timeout: 15000 });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (msg.includes('timeout') || msg.includes('could not be found')) {
                return res.status(503).json({ error: 'RPC_SYNC_DELAYED', message: 'Transaction receipt not indexed yet. Sync queued for CRON.' });
            }
            throw err;
        }

        if (!receipt || receipt.status !== 'success') {
            return res.status(400).json({ error: 'Transaction reverted or invalid on-chain' });
        }

        // 3. Verify sender matches wallet and target is DailyApp contract
        if (receipt.from.toLowerCase() !== cleanAddress) {
            return res.status(403).json({ error: 'Transaction sender does not match wallet' });
        }
        if (DAILY_APP_ADDRESS && receipt.to?.toLowerCase() !== DAILY_APP_ADDRESS.toLowerCase()) {
            return res.status(403).json({ error: 'Transaction destination is not DailyApp contract' });
        }

        // 4. Read current on-chain stats
        const contractStats = await rpcClient.readContract({
            address: DAILY_APP_ADDRESS as `0x${string}`,
            abi: DAILY_APP_USER_STATS_ABI,
            functionName: 'userStats',
            args: [cleanAddress as `0x${string}`],
        }) as unknown as [bigint, bigint, bigint, number, bigint, bigint, boolean];

        const currentOnChainXp = Number(contractStats?.[0] || 0);
        const currentTierOnChain = Number(contractStats?.[3] || 0);

        // 5. Read current DB profile
        const { data: profile } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('last_onchain_xp, total_xp, streak_count, last_streak_claim')
            .eq('wallet_address', cleanAddress)
            .maybeSingle();

        if (!profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const lastOnChainXp = profile.last_onchain_xp || 0;
        let xpDelta = 0;
        if (currentOnChainXp > lastOnChainXp) {
            xpDelta = currentOnChainXp - lastOnChainXp;
        } else if (currentOnChainXp < lastOnChainXp) {
            xpDelta = currentOnChainXp;
        }

        // 6. Calculate streak
        const now = new Date();
        const lastClaimDate = profile.last_streak_claim ? new Date(profile.last_streak_claim) : null;
        let newStreak = profile.streak_count || 0;

        if (!lastClaimDate) {
            newStreak = 1;
        } else {
            const diffHours = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);
            if (diffHours >= 20 && diffHours <= 48) newStreak += 1;
            else if (diffHours > 48) newStreak = 1;
        }

        const streakIso = now.toISOString();

        // 7. Atomic DB update: watermark + streak + XP increment
        const { error: updateErr } = await getSupabaseAdmin()
            .from('user_profiles')
            .update({
                last_onchain_xp: currentOnChainXp,
                streak_count: newStreak,
                last_streak_claim: streakIso,
                tier: currentTierOnChain,
                updated_at: streakIso
            })
            .eq('wallet_address', cleanAddress)
            .eq('last_onchain_xp', lastOnChainXp);

        if (updateErr) throw updateErr;

        // 8. Increment XP via RPC
        if (xpDelta > 0) {
            const { error: rpcErr } = await getSupabaseAdmin().rpc('fn_increment_xp', {
                p_wallet: cleanAddress,
                p_amount: xpDelta
            });

            if (rpcErr && rpcErr.code !== '23505') throw rpcErr;
        }

        // 9. Log activity
        await logActivity({
            wallet: cleanAddress,
            category: 'XP',
            type: 'On-chain Daily Claim',
            description: `Daily claim: +${xpDelta} XP (streak: ${newStreak})`,
            amount: xpDelta,
            symbol: 'XP',
            txHash: cleanTxHash,
            metadata: {
                chain_id: chain_id || (isMainnet ? 8453 : 84532),
                contract_address: DAILY_APP_ADDRESS,
                on_chain_xp: currentOnChainXp,
                sync_status: 'synced',
                streak: newStreak
            }
        });

        // 10. Fire-and-forget referral bonus
        if (xpDelta > 0) {
            awardReferralBonus(cleanAddress, xpDelta, 'Daily Claim').catch(() => {});
        }

        return res.status(200).json({ success: true, xp_synced: xpDelta, streak: newStreak });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        await logSystemError({
            surface: 'api',
            bundle: 'user-bundle',
            action: 'daily-claim',
            wallet_address: wallet_address || 'unknown',
            message: sanitizeError(msg)
        });
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
            .maybeSingle();

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
    const { wallet_address, signature, message, provider, oauth_token, oauth_data } = req.body;
    if (!wallet_address || !signature || !message || !provider || !oauth_token || !oauth_data) {
        return res.status(400).json({ error: 'Missing fields (wallet_address, signature, message, provider, oauth_token, oauth_data)' });
    }

    try {
        // 1. Verify EIP-191 signature to ensure the request is from the wallet owner
        const validSig = await verifyMessage({
            address: wallet_address as `0x${string}`,
            message,
            signature: signature as `0x${string}`
        });
        if (!validSig) {
            return res.status(401).json({ error: 'Cryptographic signature verification failed' });
        }

        const cleanWallet = wallet_address.toLowerCase();

        // 2. Verify Supabase OAuth session JWT token securely on the server
        const { data: { user }, error: authErr } = await getSupabaseAdmin().auth.getUser(oauth_token);
        if (authErr || !user) {
            return res.status(401).json({ error: 'Invalid or expired Supabase Auth session token' });
        }

        // 3. Prevent Client-Side Trust: verify that the user retrieved from Supabase owns the requested identity
        const expectedId = provider === 'google' ? oauth_data.google_id : oauth_data.twitter_id;
        if (!expectedId) {
            return res.status(400).json({ error: 'Missing provider identifier in oauth_data' });
        }

        const matchesIdentity = user.identities?.some(identity => {
            const prov = identity.provider?.toLowerCase();
            const idStr = String(identity.id || '');
            if (provider === 'google' && prov === 'google' && idStr === String(expectedId)) return true;
            if ((provider === 'x' || provider === 'twitter') && (prov === 'twitter' || prov === 'x') && idStr === String(expectedId)) return true;
            return false;
        }) || (provider === 'google' && user.id === expectedId) || ((provider === 'x' || provider === 'twitter') && user.id === expectedId);

        if (!matchesIdentity) {
            return res.status(403).json({ error: `Verification mismatch: The Supabase session does not own the requested ${provider === 'google' ? 'Google' : 'X (Twitter)'} identity.` });
        }

        // 4. Identity Lock: Ensure no other wallet is already linked to this social identity
        const targetColumn = provider === 'google' ? 'google_id' : 'twitter_id';
        const { data: existingLink } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('wallet_address')
            .eq(targetColumn, expectedId)
            .neq('wallet_address', cleanWallet)
            .maybeSingle();

        if (existingLink) {
            return res.status(400).json({ error: `This ${provider === 'google' ? 'Google' : 'X (Twitter)'} account is already linked to another wallet.` });
        }

        // 5. Update user profile database record
        const updatePayload: Partial<Database['public']['Tables']['user_profiles']['Update']> = {
            updated_at: new Date().toISOString()
        };

        if (provider === 'google') {
            updatePayload.google_id = oauth_data.google_id;
            updatePayload.google_email = oauth_data.google_email || null;
            if (oauth_data.name) updatePayload.display_name = oauth_data.name.substring(0, PROFILE_LIMITS.MAX_NAME_LEN);
            if (oauth_data.pfp_url) updatePayload.pfp_url = oauth_data.pfp_url;
        } else {
            updatePayload.twitter_id = oauth_data.twitter_id;
            updatePayload.twitter_username = oauth_data.twitter_username || null;
            if (oauth_data.name) updatePayload.display_name = oauth_data.name.substring(0, PROFILE_LIMITS.MAX_NAME_LEN);
            if (oauth_data.pfp_url) updatePayload.pfp_url = oauth_data.pfp_url;
        }

        const { error: dbErr } = await getSupabaseAdmin()
            .from('user_profiles')
            .update(updatePayload)
            .eq('wallet_address', cleanWallet);

        if (dbErr) throw dbErr;

        // 6. Log the link action in activity history
        const socialDetail = provider === 'google' ? oauth_data.google_email : `@${oauth_data.twitter_username}`;
        await logActivity({
            wallet: cleanWallet,
            category: 'IDENTITY',
            type: `${provider === 'google' ? 'Google' : 'X'} Link`,
            description: `Successfully linked ${provider === 'google' ? 'Google: ' + socialDetail : 'X: ' + socialDetail} to wallet.`
        });

        return res.status(200).json({ success: true, provider });
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
        const { data: profile, error } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('fid, twitter_username, twitter_id, is_base_social_verified, google_id, google_email, base_username')
            .eq('wallet_address', cleanAddress)
            .maybeSingle();
        if (error) throw error;

        const hasFarcaster = !!profile?.fid;
        const hasTwitter = !!profile?.twitter_id;
        const hasGoogle = !!profile?.google_id;
        const hasBase = !!profile?.is_base_social_verified;
        const isVerified = hasFarcaster || hasTwitter || hasGoogle || hasBase;

        return res.status(200).json({
            farcaster: hasFarcaster ? { fid: profile.fid, verified: true } : null,
            twitter: hasTwitter ? { username: profile.twitter_username, id: profile.twitter_id, verified: true } : null,
            google: hasGoogle ? { email: profile.google_email, id: profile.google_id, verified: true } : null,
            base: hasBase ? { username: profile.base_username, verified: true } : null,
            isVerified: !!isVerified
        });
    } catch (e: unknown) { return res.status(500).json({ error: 'Internal Error', isVerified: false }); }
}

export default withMiddleware(handler);
