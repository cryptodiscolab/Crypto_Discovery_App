import { createClient } from '@supabase/supabase-js';
import { verifyMessage, createPublicClient, http, decodeEventLog, parseUnits, keccak256, toBytes, encodePacked, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { VercelResponse } from '@vercel/node';
import { 
    SUPABASE_URL, 
    SUPABASE_SERVICE_ROLE_KEY, 
    VIEM_CHAIN, 
    RPC_URL, 
    getContractAddr,
    DAILY_APP_ADDRESS,
    DAILY_APP_USER_STATS_ABI,
    RAFFLE_EVENT_ABI,
    IS_MAINNET,
    ERC20_ABI,
    UGC_REWARD_ESCROW_ABI,
    UGC_REWARD_ESCROW_ADDRESS,
    SAFE_MULTISIG,
    WALLET_BOT_SIGNER,
    CHAIN_ID,
    sanitizeError,
    logSystemError,
    awardOnChainXp,
    API_SECRET,
    VERIFY_SERVER_URL
} from './_shared/constants.js';
import type { 
    PointSetting,
    Database,
    DbDailyTask,
    ExtendedVercelRequest,
    TaskClaimResponse
} from './_shared/types.js';

const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
type UserTaskClaimInsert = Database['public']['Tables']['user_task_claims']['Insert'];
type OnChainXpFunction = Parameters<typeof awardOnChainXp>[0];
type RewardPoolRpcResult = {
    success?: boolean;
    error?: string;
    remaining_reward_pool?: number | string | null;
};
type CampaignClaimStatus = 'paid' | 'earned_pending_onchain_claim' | 'xp_only' | string | null;
type UgcRewardClaimedLog = {
    address?: string;
    args?: {
        campaignId?: `0x${string}`;
        claimant?: string;
        token?: string;
        amount?: bigint;
        deadline?: bigint;
        nonce?: bigint;
    };
};

const publicClient = createPublicClient({
    chain: VIEM_CHAIN,
    transport: http(RPC_URL)
});

// 🛡️ REFACTORED HELPERS 🛡️

async function getPointValue(activityKey: string): Promise<number> {
    try {
        const { data, error } = await supabaseAdmin
            .from('point_settings')
            .select('points_value')
            .eq('activity_key', activityKey)
            .eq('is_active', true)
            .maybeSingle<PointSetting>();
        
        if (error || !data) return 0;
        return data.points_value || 0;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[PointLookup Error] Key: ${activityKey}`, msg);
        return 0;
    }
}

async function getTaskReward(taskId: string): Promise<number> {
    if (taskId?.startsWith('raffle_buy_')) return await getPointValue('raffle_buy');
    if (taskId?.startsWith('raffle_win_')) return await getPointValue('raffle_win');
    try {
        const { data: task } = await supabaseAdmin
            .from('daily_tasks')
            .select('xp_reward, platform, action_type')
            .eq('id', taskId)
            .maybeSingle<DbDailyTask>();
            
        if (!task) return 0;
        const dynamicKey = `${task.platform}_${task.action_type}`.toLowerCase().replace(/\s+/g, '_');
        const dynamicValue = await getPointValue(dynamicKey);
        return dynamicValue > 0 ? dynamicValue : (task.xp_reward || 0);
    } catch (e: unknown) { return 0; }
}

/**
 * 🛡️ ON-CHAIN VERIFIER 🛡️
 * Verifies that the transaction actually happened and matches the claim.
 */
async function verifyRaffleOnChain(taskId: string, wallet_address: string, message: string): Promise<boolean> {
    // 1. Verification for Raffle Ticket Purchase
    if (taskId.startsWith('raffle_buy_')) {
        const parts = taskId.split('_');
        const txHash = parts[parts.length - 1];
        const raffleId = parts[2];
        if (!txHash || !txHash.startsWith('0x')) throw new Error('Missing transaction hash in task ID');

        const amountMatch = message.match(/Amount:\s*(\d+)/i);
        const expectedAmount = amountMatch ? parseInt(amountMatch[1], 10) : 0;
        if (expectedAmount <= 0) throw new Error('Invalid amount in message');

        try {
            const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
            if (!receipt || receipt.status !== 'success') throw new Error('Transaction failed or not found');

            const raffleContractAddr = getContractAddr('RAFFLE').toLowerCase();
            let confirmedAmount = 0;
            
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() !== raffleContractAddr) continue; // [SECURITY FIX] Reject spoofed logs from fake contracts
                
                try {
                    const decoded = decodeEventLog({
                        abi: RAFFLE_EVENT_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === 'TicketPurchased') {
                        // [SECURITY FIX] Enforce cross-raffle integrity
                        if (
                            decoded.args.user.toLowerCase() === wallet_address.toLowerCase() &&
                            decoded.args.raffleId.toString() === raffleId
                        ) {
                            confirmedAmount += Number(decoded.args.count);
                        }
                    }
                } catch (e) { /* skip unparseable logs */ }
            }

            if (confirmedAmount < expectedAmount) {
                throw new Error(`On-chain mismatch: Claimed ${expectedAmount} but found ${confirmedAmount} tickets in logs.`);
            }
            return true;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[verifyRaffleOnChain] Purchase verification failed:', msg);
            throw new Error(`Blockchain verification failed: ${msg}`);
        }
    }

    // 2. Verification for Raffle Winner
    if (taskId.startsWith('raffle_win_')) {
        const raffleId = taskId.split('_')[2]; // raffle_win_{id}
        if (!raffleId) throw new Error('Missing raffle ID in task ID');

        try {
            // Check RaffleWinner events in the contract for this raffleId
            const logs = await publicClient.getLogs({
                address: getContractAddr('RAFFLE'), // Zero-Hardcode ✅
                event: RAFFLE_EVENT_ABI[2], // [SECURITY FIX] Corrected ABI index from 1 (RaffleCreated) to 2 (RaffleWinner)
                args: { raffleId: BigInt(raffleId) },
                fromBlock: 'earliest'
            });

            const isWinner = logs.some(log => (log.args as { winner: string }).winner.toLowerCase() === wallet_address.toLowerCase());
            if (!isWinner) throw new Error(`User ${wallet_address} is not a winner of Raffle #${raffleId}`);
            
            return true;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[verifyRaffleOnChain] Win verification failed:', msg);
            throw new Error(`Winner verification failed: ${msg}`);
        }
    }

    return true; // Not a raffle task
}

async function validateAndCalculateXP(wallet_address: string, signature: string, message: string, task_id: string) {
    const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
    if (!valid) throw new Error('Invalid signature');

    if (task_id && task_id.startsWith('raffle_')) {
        const parts = task_id.split('_');
        const raffleId = parts[2];
        if (!message.includes(`Raffle ID: ${raffleId}`)) {
            throw new Error(`[Security] Message mismatch. Expected Raffle ID: ${raffleId}`);
        }
        await verifyRaffleOnChain(task_id, wallet_address, message);
    } else if (task_id) {
        if (!message.includes(`ID: ${task_id}`)) {
            throw new Error(`[Security] Message mismatch. Expected Task ID: ${task_id}`);
        }
    }

    let xp = await getTaskReward(task_id);

    if (task_id && task_id.startsWith('raffle_buy_')) {
        const amountMatch = message.match(/Amount:\s*(\d+)/i);
        if (amountMatch && amountMatch[1]) {
            const amount = parseInt(amountMatch[1], 10);
            if (amount > 0) xp = xp * amount;
        }
    }

    let targetId: string | null = null;
    let isUgc = false;
    if (task_id && task_id.startsWith('raffle_buy_')) {
        targetId = task_id.split('_').pop() || null;
    } else if (task_id && task_id.startsWith('raffle_win_')) {
        const parts = task_id.split('_');
        if (parts.length !== 3) throw new Error('[Security] Invalid task ID format for raffle_win');
        targetId = `raffle_win_${parts[2]}`;
    } else {
        const { data: task } = await supabaseAdmin.from('daily_tasks').select('target_id, task_type').eq('id', task_id).maybeSingle();
        targetId = task?.target_id || null;
        isUgc = task?.task_type === 'ugc';
    }

    if (targetId && !isUgc) {
        // [SECURITY FIX] UGC Sub-Task Lockout
        // UGC sub-tasks share the same target_id (campaign.id). If we don't bypass this,
        // users are blocked from claiming more than 1 sub-task per campaign.
        const { count } = await supabaseAdmin
            .from('user_task_claims')
            .select('id', { count: 'exact', head: true })
            .eq('wallet_address', wallet_address.toLowerCase())
            .eq('target_id', targetId);
        if (count && count > 0) throw new Error('[Security] Target account already claimed by this user');
    }

    return { xp, targetId };
}

async function logActivity(wallet: string, category: string, type: string, description: string, amount: number = 0, symbol: string = 'XP', metadata?: Record<string, unknown>, txHash?: string | null) {
    try {
        await supabaseAdmin.from('user_activity_logs').insert({
            wallet_address: wallet.toLowerCase(),
            category,
            activity_type: type,
            description,
            value_amount: amount,
            value_symbol: symbol,
            tx_hash: txHash || null,
            metadata: (metadata || {}) as import('./_shared/database.types.js').Json,
            created_at: new Date().toISOString()
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[logActivity Error]', msg);
    }
}

/**
 * On-chain SOT backup path: claims are inserted as indexer records only.
 * XP totals are mirrored from DailyAppV16 userStats(), never incremented here.
 */
async function insertClaimBackupOnly(claim: UserTaskClaimInsert, context: string): Promise<{ alreadyClaimed: boolean }> {
    const { error } = await supabaseAdmin.from('user_task_claims').insert(claim);
    if (error) {
        if (error.code === '23505') return { alreadyClaimed: true };
        await logSystemError({
            severity: 'critical',
            surface: 'api',
            bundle: 'tasks-bundle',
            action: context,
            message: `user_task_claims backup insert failed: ${error.message}`
        }).catch(() => {});
        throw error;
    }

    return { alreadyClaimed: false };
}

async function isClaimBackedUp(wallet: string, taskId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
        .from('user_task_claims')
        .select('id')
        .eq('wallet_address', wallet.toLowerCase())
        .eq('task_id', taskId)
        .maybeSingle();
    if (error) throw error;
    return !!data;
}

async function readOnChainUserStats(wallet: string): Promise<{ points: number; tier: number }> {
    if (!DAILY_APP_ADDRESS) throw new Error('DailyApp contract address is not configured');
    const stats = await publicClient.readContract({
        address: DAILY_APP_ADDRESS as `0x${string}`,
        abi: DAILY_APP_USER_STATS_ABI,
        functionName: 'userStats',
        args: [wallet.toLowerCase() as `0x${string}`]
    });
    const [points, , , currentTier] = stats as readonly [bigint, bigint, bigint, number, bigint, bigint, boolean];
    return { points: Number(points), tier: Number(currentTier) };
}

async function mirrorOnChainUserStats(wallet: string, context: string, txHash: `0x${string}`): Promise<{ points: number; tier: number }> {
    const cleanWallet = wallet.toLowerCase();
    const stats = await readOnChainUserStats(cleanWallet);
    const { error } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
            wallet_address: cleanWallet,
            total_xp: stats.points,
            last_onchain_xp: stats.points,
            tier: stats.tier,
            updated_at: new Date().toISOString()
        }, { onConflict: 'wallet_address' });

    if (error) {
        await logSystemError({
            severity: 'critical',
            surface: 'api',
            bundle: 'tasks-bundle',
            action: `${context}:mirrorOnChainUserStats`,
            wallet_address: cleanWallet,
            tx_hash: txHash,
            message: `Failed to mirror on-chain userStats: ${error.message}`
        }).catch(() => {});
        throw error;
    }

    return stats;
}

async function requireOnChainXpAward(functionName: OnChainXpFunction, args: readonly unknown[], wallet: string, context: string) {
    const txHash = await awardOnChainXp(functionName, args);
    if (!txHash) {
        await logSystemError({
            severity: 'critical',
            surface: 'api',
            bundle: 'tasks-bundle',
            action: context,
            wallet_address: wallet.toLowerCase(),
            message: `${functionName} did not produce an on-chain transaction hash`
        }).catch(() => {});
        throw new Error('ONCHAIN_XP_AWARD_FAILED');
    }

    const stats = await mirrorOnChainUserStats(wallet, context, txHash);
    return { txHash, ...stats };
}

async function decrementCampaignRewardPoolAtomic(campaignId: string, rewardAmount: number): Promise<number | null> {
    if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) return null;

    const { data, error } = await supabaseAdmin.rpc('fn_decrement_campaign_reward_pool_atomic', {
        p_campaign_id: campaignId,
        p_reward_amount: rewardAmount
    });

    if (!error) {
        const result = data as RewardPoolRpcResult | null;
        if (!result?.success) throw new Error(result?.error || 'UGC_REWARD_POOL_DECREMENT_FAILED');
        return Number(result.remaining_reward_pool ?? 0);
    }

    const missingRpc = error.code === 'PGRST202' || /fn_decrement_campaign_reward_pool_atomic/i.test(error.message || '');
    if (!missingRpc) throw error;

    await logSystemError({
        severity: 'critical',
        surface: 'api',
        bundle: 'tasks-bundle',
        action: 'decrementCampaignRewardPoolAtomic',
        message: `Atomic pool RPC missing; using non-atomic fallback: ${error.message}`
    }).catch(() => {});

    const { data: campaign, error: readErr } = await supabaseAdmin
        .from('campaigns')
        .select('remaining_reward_pool')
        .eq('id', campaignId)
        .maybeSingle();

    if (readErr) throw readErr;

    const current = Number(campaign?.remaining_reward_pool || 0);
    if (current < rewardAmount) throw new Error('INSUFFICIENT_REWARD_POOL');
    const nextRemaining = Math.max(0, current - rewardAmount);

    const { data: updated, error: updateErr } = await supabaseAdmin
        .from('campaigns')
        .update({ remaining_reward_pool: nextRemaining })
        .eq('id', campaignId)
        .gte('remaining_reward_pool', rewardAmount)
        .select('remaining_reward_pool')
        .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updated) throw new Error('UGC_REWARD_POOL_CONCURRENT_UPDATE_FAILED');
    return Number(updated.remaining_reward_pool || 0);
}

function isNativeRewardToken(tokenAddress?: string | null, symbol?: string | null): boolean {
    const token = String(tokenAddress || '').toLowerCase();
    const normalizedSymbol = String(symbol || '').toUpperCase();
    return !token || token === '0x0000000000000000000000000000000000000000' || normalizedSymbol === 'ETH';
}

function rewardTokenDecimals(symbol?: string | null): number {
    return String(symbol || '').toUpperCase() === 'USDC' ? 6 : 18;
}

function toCampaignKey(campaignId: string): `0x${string}` {
    return keccak256(toBytes(String(campaignId)));
}

function normalizeRewardToken(tokenAddress?: string | null, symbol?: string | null): `0x${string}` {
    if (isNativeRewardToken(tokenAddress, symbol)) return '0x0000000000000000000000000000000000000000';
    const token = String(tokenAddress || '').toLowerCase();
    if (!token.startsWith('0x')) throw new Error('Invalid reward token address');
    return token as `0x${string}`;
}

function rewardAmountRaw(amount: number, symbol?: string | null): bigint {
    const decimals = rewardTokenDecimals(symbol);
    return parseUnits(amount.toFixed(decimals), decimals);
}

function getWalletBotAccount() {
    if (!WALLET_BOT_SIGNER) return null;
    const privateKey = WALLET_BOT_SIGNER.startsWith('0x') ? WALLET_BOT_SIGNER : `0x${WALLET_BOT_SIGNER}`;
    return privateKeyToAccount(privateKey as `0x${string}`);
}

function isFinalCampaignClaimStatus(status: CampaignClaimStatus): boolean {
    return status === 'paid' || status === 'earned_pending_onchain_claim' || status === 'xp_only';
}

async function getUgcTreasuryAddress(): Promise<string> {
    const { data } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'ugc_config')
        .maybeSingle();
    const config = (data?.value || {}) as Record<string, unknown>;
    const treasury = String(config.treasury_address || SAFE_MULTISIG || '').trim().toLowerCase();
    if (!treasury.startsWith('0x')) throw new Error('UGC treasury address is not configured');
    return treasury;
}

async function verifyUgcPayoutTransfer(params: {
    txHash: string;
    campaignId?: string;
    wallet: string;
    tokenAddress?: string | null;
    rewardSymbol?: string | null;
    rewardAmount: number;
}): Promise<void> {
    if (!params.txHash?.startsWith('0x')) throw new Error('Missing payout transaction hash');
    if (!Number.isFinite(params.rewardAmount) || params.rewardAmount <= 0) throw new Error('Invalid payout amount');

    const wallet = params.wallet.toLowerCase();
    const expectedCampaignKey = params.campaignId ? toCampaignKey(params.campaignId).toLowerCase() : '';
    const treasury = await getUgcTreasuryAddress();
    const decimals = rewardTokenDecimals(params.rewardSymbol);
    const expectedRaw = parseUnits(params.rewardAmount.toFixed(decimals), decimals);
    const receipt = await publicClient.getTransactionReceipt({ hash: params.txHash as `0x${string}` });
    if (!receipt || receipt.status !== 'success') throw new Error('Payout transaction is not confirmed');

    const escrowAddress = String(UGC_REWARD_ESCROW_ADDRESS || '').toLowerCase();
    if (escrowAddress.startsWith('0x')) {
        const logs = parseEventLogs({
            abi: UGC_REWARD_ESCROW_ABI,
            eventName: 'RewardClaimed',
            logs: receipt.logs,
            strict: false
        }) as UgcRewardClaimedLog[];

        const escrowProof = logs.some((log) =>
            log.address?.toLowerCase() === escrowAddress &&
            (!expectedCampaignKey || String(log.args?.campaignId || '').toLowerCase() === expectedCampaignKey) &&
            String(log.args?.claimant || '').toLowerCase() === wallet &&
            String(log.args?.token || '').toLowerCase() === normalizeRewardToken(params.tokenAddress, params.rewardSymbol).toLowerCase() &&
            BigInt(log.args?.amount || 0n) >= expectedRaw
        );
        if (escrowProof) return;
    }

    if (isNativeRewardToken(params.tokenAddress, params.rewardSymbol)) {
        const tx = await publicClient.getTransaction({ hash: params.txHash as `0x${string}` });
        const isDirectPayout = tx.from.toLowerCase() === treasury
            && tx.to?.toLowerCase() === wallet
            && BigInt(tx.value || 0n) >= expectedRaw;
        if (!isDirectPayout) throw new Error('Native payout proof mismatch');
        return;
    }

    const tokenAddress = String(params.tokenAddress || '').toLowerCase();
    if (!tokenAddress.startsWith('0x')) throw new Error('Invalid payout token address');

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== tokenAddress) continue;
        try {
            const decoded = decodeEventLog({
                abi: ERC20_ABI,
                eventName: 'Transfer',
                data: log.data,
                topics: log.topics
            }) as { args: { from?: string; to?: string; value?: bigint } };

            if (
                String(decoded.args.from || '').toLowerCase() === treasury &&
                String(decoded.args.to || '').toLowerCase() === wallet &&
                BigInt(decoded.args.value || 0n) >= expectedRaw
            ) {
                return;
            }
        } catch {
            // Ignore logs that are not ERC20 Transfer events for this token.
        }
    }

    throw new Error('ERC20 payout proof mismatch');
}

/**
 * awardReferralBonus — Awards passive XP to referrer. Fire-and-forget.
 */
async function awardReferralBonus(userWallet: string, xpEarned: number, source: string) {
    if (!xpEarned || xpEarned <= 0) return;
    try {
        const cleanWallet = userWallet.toLowerCase();
        const { data: profile } = await supabaseAdmin.from('user_profiles').select('referred_by').eq('wallet_address', cleanWallet).maybeSingle();
        if (!profile?.referred_by) return;

        const { data: thresholdSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'referral_active_threshold').maybeSingle();
        const threshold = thresholdSetting?.value ? Number(thresholdSetting.value) : 500;
        const userStats = await readOnChainUserStats(cleanWallet);
        if (userStats.points < threshold) return;

        const { data: bonusSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'referral_bonus_percent').maybeSingle();
        const bonusPercent = bonusSetting?.value ? Number(bonusSetting.value) : 10;
        const bonusXp = Math.floor(xpEarned * (bonusPercent / 100));
        if (bonusXp <= 0) return;

        const referrerWallet = profile.referred_by.toLowerCase();
        if (referrerWallet === cleanWallet) return; // [SECURITY HARDENING] Prevent self-referral XP loop
        const award = await requireOnChainXpAward('awardSocialXp', [referrerWallet as `0x${string}`, BigInt(bonusXp)], referrerWallet, 'awardReferralBonus');
        await logActivity(referrerWallet, 'XP', 'Referral Bonus', `Referral Bonus: +${bonusXp} XP (${bonusPercent}% from ${cleanWallet.slice(0, 6)}...${cleanWallet.slice(-4)})`, bonusXp, 'XP', { source, referred_user: cleanWallet, bonus_percent: bonusPercent, onchain_xp: award.points }, award.txHash);
    } catch (err: unknown) {
        console.warn('[ReferralBonus]', err instanceof Error ? err.message : String(err));
    }
}

async function checkAndGrantDailyBonus(wallet_address: string) {
    try {
        const wallet = wallet_address.toLowerCase();
        
        // 🛡️ HARDENING (v3.60.4): Identity-Gated Retention
        const [{ data: profile }, { data: progress }] = await Promise.all([
            supabaseAdmin
                .from('user_profiles')
                .select('is_base_social_verified, fid, twitter_id')
                .eq('wallet_address', wallet)
                .maybeSingle(),
            supabaseAdmin
                .from('v_user_daily_progress')
                .select('*')
                .eq('wallet_address', wallet)
                .maybeSingle()
        ]);

        if (!progress || progress.bonus_claimed || (progress.completed_count ?? 0) < 3) return;

        const isVerified = !!(profile?.is_base_social_verified || profile?.fid || profile?.twitter_id);
        
        if (!isVerified) {
            console.warn(`[DailyBonus] User ${wallet} reached 3-task goal but is NOT verified. Identity Gating active.`);
            return;
        }

        const bonusXp = await getPointValue('daily_task_completion') || 50;
        const todayStr = new Date().toISOString().split('T')[0];
        
        const bonusTaskId = `daily_task_completion_${todayStr}`;
        if (await isClaimBackedUp(wallet, bonusTaskId)) return;

        const award = await requireOnChainXpAward('awardSocialXp', [wallet as `0x${string}`, BigInt(bonusXp)], wallet, 'checkAndGrantDailyBonus');

        const { alreadyClaimed } = await insertClaimBackupOnly({
            wallet_address: wallet,
            task_id: bonusTaskId,
            xp_earned: bonusXp,
            platform: 'system',
            action_type: 'daily_bonus'
        }, 'checkAndGrantDailyBonus');

        if (alreadyClaimed) return;

        await logActivity(wallet, 'DAILY', 'Daily Goal Bonus', `Unlocked 3-Task Daily Bonus! +${bonusXp} XP`, bonusXp, 'XP', { onchain_xp: award.points }, award.txHash);

        console.log(`[DailyBonus] Granted ${bonusXp} XP to ${wallet} (Verified)`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[DailyBonus Error]', msg);
    }
}


async function checkFeatureGuard(featureKey: string, res: VercelResponse): Promise<boolean> {
    if (!IS_MAINNET) return true; 
    
    try {
        const { data } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'active_features')
            .maybeSingle();
        
        const activeFeatures = (data?.value as Record<string, boolean>) || {};
        if (activeFeatures[featureKey] !== true) {
            console.warn(`[Feature Guard] BLOCKED: Attempt to access disabled feature '${featureKey}' on Mainnet.`);
            res.status(403).json({ error: `Feature [${featureKey}] is currently disabled for Phased Rollout. Please wait for the next phase.` });
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

// ── HANDLERS ──

export default async function handler(req: ExtendedVercelRequest, res: VercelResponse) {
    const action = req.body?.action || req.query?.action;
    
    if (['claim', 'verify'].includes(action)) {
        const allowed = await checkFeatureGuard('daily_claim', res);
        if (!allowed) return;
    }
    
    if (action === 'social-verify') {
        const allowed = await checkFeatureGuard('login_and_social', res);
        if (!allowed) return;
    }

    if (action === 'claim-ugc-campaign' || action === 'prepare-ugc-payout-claim' || action === 'sync-ugc-payout') {
        const allowed = await checkFeatureGuard('ugc_campaign', res);
        if (!allowed) return;
    }

    try {
        switch (action) {
            case 'claim': await handleClaim(req, res); break;
            case 'verify': await handleVerify(req, res); break;
            case 'social-verify': await handleSocialVerify(req, res); break;
            case 'claim-ugc-campaign': await handleClaimUgcCampaign(req, res); break;
            case 'prepare-ugc-payout-claim': await handlePrepareUgcPayoutClaim(req, res); break;
            case 'sync-ugc-payout': await handleSyncUgcPayout(req, res); break;
            case 'spin-gacha': await handleSpinGacha(req, res); break;
            default: res.status(400).json({ error: 'Invalid action' }); break;
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[API Handler Error] Action: ${action}`, msg);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleClaim(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, task_id } = req.body;
    if (!wallet_address || !signature || !message || !task_id) throw new Error('Missing fields');

    try {
        const { xp, targetId } = await validateAndCalculateXP(wallet_address, signature, message, task_id);
        const cleanWallet = wallet_address.toLowerCase();

        if (await isClaimBackedUp(cleanWallet, task_id)) {
            await logActivity(wallet_address, 'SYNC', 'Duplicate Claim Attempt', `Task ${task_id} already claimed`, 0, 'XP');
            return res.status(200).json({ success: true, message: "Already claimed.", already_claimed: true });
        }

        // [ON-CHAIN FIRST] Award XP on-chain via bot signer (bot pays gas ~$0.001)
        const award = await requireOnChainXpAward('awardSocialXp', [cleanWallet as `0x${string}`, BigInt(xp)], cleanWallet, 'handleClaim');

        const result = await insertClaimBackupOnly({
            wallet_address: cleanWallet,
            task_id,
            xp_earned: xp,
            target_id: targetId
        }, 'handleClaim');

        if (result.alreadyClaimed) {
            await logActivity(wallet_address, 'SYNC', 'Duplicate Claim Attempt', `Task ${task_id} already claimed`, 0, 'XP');
            return res.status(200).json({ success: true, message: "Already claimed.", already_claimed: true });
        }

        await logActivity(wallet_address, 'XP', 'Claim Success', `Earned ${xp} XP for ${task_id}`, xp, 'XP', { onchain_xp: award.points, onchain_tier: award.tier }, award.txHash);

        // Award referral bonus to referrer (fire-and-forget)
        awardReferralBonus(wallet_address, xp, 'Task Claim').catch(() => {});

        await checkAndGrantDailyBonus(wallet_address);
        return res.status(200).json({ success: true, xp, txHash: award.txHash, onchain_xp: award.points });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[handleClaim Error]', msg);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleVerify(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
    if (!wallet_address || !signature || !message || !task_id) throw new Error('Missing fields');

    const { xp, targetId } = await validateAndCalculateXP(wallet_address, signature, message, task_id);
    const cleanWallet = wallet_address.toLowerCase();

    if (await isClaimBackedUp(cleanWallet, task_id)) {
        await logActivity(wallet_address, 'SYNC', 'Duplicate Verify Attempt', `Task ${task_id} already verified on ${platform || 'unknown'}`, 0, 'XP');
        return res.status(200).json({ success: true, message: "Already verified.", already_claimed: true });
    }

    const amountMatch = message.match(/Amount:\s*(\d+)/i);
    const ticketCount = amountMatch ? parseInt(amountMatch[1], 10) : 1;
    const award = task_id.startsWith('raffle_buy_')
        ? await requireOnChainXpAward('awardRaffleBuyXp', [cleanWallet as `0x${string}`, BigInt(ticketCount)], cleanWallet, 'handleVerify:raffle_buy')
        : await requireOnChainXpAward('awardSocialXp', [cleanWallet as `0x${string}`, BigInt(xp)], cleanWallet, 'handleVerify');

    const result = await insertClaimBackupOnly({
        wallet_address: cleanWallet,
        task_id,
        platform,
        action_type,
        xp_earned: xp,
        target_id: targetId
    }, 'handleVerify');

    if (result.alreadyClaimed) {
        await logActivity(wallet_address, 'SYNC', 'Duplicate Verify Race', `Task ${task_id} was awarded on-chain but backup already existed`, 0, 'XP', { onchain_xp: award.points, onchain_tier: award.tier }, award.txHash);
        return res.status(200).json({ success: true, message: "Already verified.", already_claimed: true });
    }

    if (task_id.startsWith('raffle_buy_')) {
        const parts = task_id.split('_');
        const raffleId = parts[2] || null;
        const txHashFromId = parts[parts.length - 1] || null;

        await supabaseAdmin.rpc('fn_increment_raffle_tickets', {
            p_wallet: cleanWallet,
            p_amount: ticketCount
        });

        await logActivity(wallet_address, 'RAFFLE', 'Ticket Purchase', `Purchased ${ticketCount} ticket(s) for Raffle #${raffleId}`, ticketCount, 'TICKET', { raffle_id: raffleId, ticket_count: ticketCount, xp_award_tx: award.txHash, onchain_xp: award.points }, txHashFromId);
    } else {
        await logActivity(wallet_address, 'XP', 'Task Verify', `Verified ${task_id} on ${platform}`, xp, 'XP', { onchain_xp: award.points, onchain_tier: award.tier }, award.txHash);
    }

    await checkAndGrantDailyBonus(wallet_address);
    return res.status(200).json({ success: true, xp, txHash: award.txHash } as TaskClaimResponse);
}

async function handleSocialVerify(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
    if (!wallet_address || !signature || !message || !task_id) throw new Error('Missing fields');

    let xp: number;
    let targetId: string | null;
    try {
        const result = await validateAndCalculateXP(wallet_address, signature, message, task_id);
        xp = result.xp;
        targetId = result.targetId;
    } catch (verifyErr: unknown) {
        const errMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        // Persistent error log for failed social verification
        await logActivity(wallet_address, 'ERROR', 'Social Verify Failed', `Verification failed for ${action_type || 'task'} on ${platform || 'unknown'}: ${errMsg.slice(0, 200)}`);
        throw verifyErr;
    }

    const cleanWallet = wallet_address.toLowerCase();
    const { data: taskGuard, error: taskGuardErr } = await supabaseAdmin
        .from('daily_tasks')
        .select('task_type, platform, action_type, is_base_social_required, onchain_id')
        .eq('id', task_id)
        .maybeSingle();
    if (taskGuardErr) throw taskGuardErr;

    if (taskGuard?.task_type === 'ugc') {
        const expectedPlatform = String(taskGuard.platform || '').toLowerCase().trim();
        const expectedAction = String(taskGuard.action_type || '').toLowerCase().trim();
        const requestedPlatform = String(platform || '').toLowerCase().trim();
        const requestedAction = String(action_type || '').toLowerCase().trim();

        if (expectedPlatform && requestedPlatform && expectedPlatform !== requestedPlatform) {
            return res.status(400).json({ error: 'UGC task platform mismatch.' });
        }
        if (expectedAction && requestedAction && expectedAction !== requestedAction) {
            return res.status(400).json({ error: 'UGC task action mismatch.' });
        }

        const { data: profile, error: profileErr } = await supabaseAdmin
            .from('user_profiles')
            .select('is_base_social_verified, fid, twitter_id')
            .eq('wallet_address', cleanWallet)
            .maybeSingle();
        if (profileErr) throw profileErr;

        const isIdentityVerified = !!(profile?.is_base_social_verified || profile?.fid || profile?.twitter_id);
        if (!isIdentityVerified) {
            return res.status(403).json({ error: 'Identity verification is required before UGC task verification.' });
        }
    }

    if (await isClaimBackedUp(cleanWallet, task_id)) {
        return res.status(200).json({ success: true, message: "Already recorded.", already_claimed: true });
    }

    // ── CONNECT TO VERIFICATION SERVER FOR SOCIAL TASKS ──
    const taskPlatform = String(taskGuard?.platform || platform || '').toLowerCase().trim();
    const taskActionType = String(taskGuard?.action_type || action_type || '').toLowerCase().trim();
    const isSocialTask = ['farcaster', 'twitter', 'tiktok', 'instagram'].includes(taskPlatform);

    if (isSocialTask) {
        // Construct payload to forward to Verification Server
        const verifyBody = {
            userAddress: cleanWallet,
            taskId: taskGuard?.onchain_id || task_id, // contract numeric ID if available, otherwise UUID
            dbTaskId: task_id,
            xpEarned: xp,
            signature,
            message,
            socialId: req.body.socialId || req.body.fid || req.body.userId || req.body.tiktokHandle || req.body.instagramHandle,
            actionParams: req.body.actionParams || {
                targetFid: req.body.targetFid,
                castHash: req.body.castHash,
                tweetId: req.body.tweetId,
                targetUserId: req.body.targetUserId
            },
            // Flat fields for compatibility with verify.routes.js extractPlatformParams
            fid: req.body.fid,
            userId: req.body.userId,
            tiktokHandle: req.body.tiktokHandle,
            instagramHandle: req.body.instagramHandle,
            targetFid: req.body.targetFid,
            castHash: req.body.castHash,
            tweetId: req.body.tweetId,
            targetUserId: req.body.targetUserId,
            // CRITICAL: Request server to ONLY check status, do NOT record DB/on-chain there
            onlyVerify: true
        };

        const verifyUrl = `${VERIFY_SERVER_URL}/api/verify/${taskPlatform}/${taskActionType}`;
        console.log(`[Social Verify] Contacting verification server: ${verifyUrl}`);

        try {
            const vRes = await fetch(verifyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-secret': API_SECRET
                },
                body: JSON.stringify(verifyBody)
            });

            const vText = await vRes.text();
            let vData;
            try {
                vData = JSON.parse(vText);
            } catch (jsonErr) {
                console.error(`[Social Verify] Non-JSON response from verification server:`, vText);
                return res.status(502).json({ error: 'Verification server returned an invalid response.' });
            }

            if (!vRes.ok || !vData.success) {
                const errMsg = vData.error || `Verification failed (status ${vRes.status})`;
                console.warn(`[Social Verify] Action not completed or error for ${cleanWallet}:`, errMsg);
                return res.status(400).json({ error: errMsg });
            }

            console.log(`[Social Verify] Social action check succeeded for ${cleanWallet}.`);
        } catch (fetchErr: unknown) {
            const fetchErrMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            console.error('[Social Verify] Network error contacting verification server:', fetchErrMsg);
            return res.status(502).json({ error: `Verification server is currently unreachable. Please try again later.` });
        }
    }

    // [ON-CHAIN FIRST] Award XP on-chain via bot signer (bot pays gas ~$0.001)
    const award = await requireOnChainXpAward('awardSocialXp', [cleanWallet as `0x${string}`, BigInt(xp)], cleanWallet, 'handleSocialVerify');

    // DB backup (fire-and-forget) — insert claim + activity log
    const result = await insertClaimBackupOnly({
        wallet_address: cleanWallet,
        task_id,
        platform: platform || 'regular',
        action_type: action_type || 'task',
        xp_earned: xp,
        target_id: targetId
    }, 'handleSocialVerify');

    if (result.alreadyClaimed) {
        return res.status(200).json({ success: true, message: "Already recorded.", already_claimed: true });
    }

    await logActivity(wallet_address, 'XP', 'Social Verify', `Verified ${action_type} on ${platform}`, xp, 'XP', { onchain_xp: award.points, onchain_tier: award.tier }, award.txHash);

    // Award referral bonus to referrer (fire-and-forget)
    awardReferralBonus(wallet_address, xp, 'Social Verify').catch(() => {});

    await checkAndGrantDailyBonus(wallet_address);
    return res.status(200).json({ success: true, xp, txHash: award.txHash, message: `Task verified.` });
}

async function handleClaimUgcCampaign(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, campaign_id } = req.body;

    if (!wallet_address || !signature || !message || !campaign_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const cleanWallet = wallet_address.toLowerCase();
    let reservedCampaignClaim = false;
    let onChainAwarded = false;

    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // [SECURITY FIX] Enforce Campaign Join & Participant Limit
        // Ensure user actually joined the campaign so they can't bypass max_participants
        const { data: joinRecord } = await supabaseAdmin
            .from('user_claims')
            .select('id, is_claimed, payout_status, payout_amount, payout_tx_hash')
            .eq('user_address', cleanWallet)
            .eq('campaign_id', campaign_id)
            .maybeSingle();

        if (!joinRecord) {
            return res.status(403).json({ error: 'You must join the campaign before claiming rewards.' });
        }

        const { data: subTasks, error: stErr } = await supabaseAdmin
            .from('daily_tasks')
            .select('id, action_type, xp_reward, platform')
            // [SECURITY FIX] UGC Campaign Sub-task Linkage Failure
            // Previously queried 'onchain_id', but campaigns are linked via 'target_id'
            .eq('target_id', campaign_id)
            .eq('task_type', 'ugc')
            .eq('is_active', true);

        if (stErr) throw stErr;
        if (!subTasks || subTasks.length === 0) {
            return res.status(404).json({ error: 'Campaign sub-tasks not found or not yet activated.' });
        }

        const { data: existingClaim } = await supabaseAdmin
            .from('user_task_claims')
            .select('id')
            .eq('wallet_address', cleanWallet)
            .eq('task_id', `ugc_campaign_${campaign_id}`)
            .maybeSingle();

        if (existingClaim || joinRecord.is_claimed) {
            if (!isFinalCampaignClaimStatus(joinRecord.payout_status)) {
                await supabaseAdmin.from('user_claims')
                    .update({ payout_status: 'sync_failed' })
                    .eq('id', joinRecord.id)
                    .in('payout_status', ['joined', 'processing', 'xp_processing', 'failed']);

                return res.status(409).json({
                    error: 'Campaign claim is incomplete and requires payout/XP reconciliation before it can be claimed again.',
                    payout_status: 'sync_failed',
                    recovery_required: true
                });
            }

            return res.status(200).json({
                success: true,
                already_claimed: true,
                payout_status: joinRecord.payout_status || 'claimed',
                payout_amount: joinRecord.payout_amount,
                payout_tx_hash: joinRecord.payout_tx_hash,
                requires_onchain_payout: joinRecord.payout_status === 'earned_pending_onchain_claim',
                message: 'Campaign reward already recorded.'
            });
        }

        const subTaskIds = subTasks.map(t => t.id);
        const { data: userClaims, error: clErr } = await supabaseAdmin
            .from('user_task_claims')
            .select('task_id')
            .eq('wallet_address', cleanWallet)
            .in('task_id', subTaskIds);

        if (clErr) throw clErr;

        const completedIds = new Set((userClaims || []).map(c => c.task_id));
        const allDone = subTaskIds.every(id => completedIds.has(id));

        if (!allDone) {
            const remaining = subTaskIds.filter(id => !completedIds.has(id)).length;
            return res.status(400).json({
                error: `Belum semua tugas selesai. Sisa: ${remaining} tugas.`,
                completed: completedIds.size,
                total: subTaskIds.length
            });
        }

        let totalXp = 0;
        for (const task of subTasks) {
            const dynamicKey = `${task.platform}_${task.action_type}`.toLowerCase();
            const xpVal = await getPointValue(dynamicKey);
            totalXp += xpVal > 0 ? xpVal : (task.xp_reward || 0);
        }
        const ugcBonus = await getPointValue('ugc_task_completion');
        totalXp += ugcBonus;

        const { data: campaign } = await supabaseAdmin
            .from('campaigns')
            .select('reward_amount_per_user, reward_symbol, title, remaining_reward_pool, payment_token, reward_token_address')
            .eq('id', campaign_id)
            .maybeSingle();

        if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });

        const rewardAmount = Number(campaign.reward_amount_per_user || 0);
        const remainingRewardPool = Number(campaign.remaining_reward_pool || 0);
        if (rewardAmount > 0 && remainingRewardPool < rewardAmount) {
            return res.status(409).json({ error: 'Campaign reward pool is depleted.' });
        }

        const reservedAt = new Date().toISOString();
        const payoutDeadlineAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        const { data: reservedClaim, error: reserveErr } = await supabaseAdmin
            .from('user_claims')
            .update({
                is_claimed: true,
                claimed_at: reservedAt,
                payout_amount: rewardAmount,
                payout_status: rewardAmount > 0 ? 'processing' : 'xp_processing',
                payout_deadline_at: payoutDeadlineAt
            })
            .eq('user_address', cleanWallet)
            .eq('campaign_id', campaign_id)
            .or('is_claimed.is.false,is_claimed.is.null')
            .select('id')
            .maybeSingle();

        if (reserveErr) throw reserveErr;
        if (!reservedClaim) {
            return res.status(409).json({
                error: 'Campaign claim reservation failed or is already in progress. Please refresh before retrying.',
                recovery_required: true
            });
        }
        reservedCampaignClaim = true;

        // [ON-CHAIN FIRST] Award XP on-chain via bot signer (bot pays gas ~$0.001)
        const award = await requireOnChainXpAward('awardUgcTaskXp', [cleanWallet as `0x${string}`, BigInt(totalXp)], cleanWallet, 'handleClaimUgcCampaign');
        onChainAwarded = true;

        const claimResult = await insertClaimBackupOnly({
            wallet_address: cleanWallet,
            task_id: `ugc_campaign_${campaign_id}`,
            xp_earned: totalXp,
            platform: 'ugc',
            action_type: 'campaign_complete'
        }, 'handleClaimUgcCampaign');

        if (claimResult.alreadyClaimed) {
            throw new Error('UGC_CAMPAIGN_BACKUP_ALREADY_EXISTS_BEFORE_FINALIZATION');
        }

        const updatedRemainingRewardPool = await decrementCampaignRewardPoolAtomic(campaign_id, rewardAmount);

        const finalPayoutStatus = rewardAmount > 0 ? 'earned_pending_onchain_claim' : 'xp_only';
        const { data: finalizedClaim, error: finalizeErr } = await supabaseAdmin.from('user_claims')
            .update({
                is_claimed: true,
                claimed_at: reservedAt,
                payout_amount: rewardAmount,
                payout_status: finalPayoutStatus,
                payout_deadline_at: payoutDeadlineAt
            })
            .eq('user_address', cleanWallet)
            .eq('campaign_id', campaign_id)
            .select('id, payout_amount, payout_status, payout_tx_hash')
            .maybeSingle();

        if (finalizeErr) throw finalizeErr;
        if (!finalizedClaim || finalizedClaim.payout_status !== finalPayoutStatus) {
            throw new Error('UGC_CAMPAIGN_CLAIM_FINALIZATION_FAILED');
        }

        await logActivity(
            wallet_address, 
            'UGC', 
            'Campaign Complete', 
            `Completed UGC Campaign: ${campaign?.title || campaign_id}`, 
            totalXp, 
            'XP',
            { onchain_xp: award.points, onchain_tier: award.tier, remaining_reward_pool: updatedRemainingRewardPool },
            award.txHash
        );

        // Separate reward log if token reward exists
        if (rewardAmount > 0) {
            await logActivity(
                wallet_address,
                'REWARD',
                'UGC Campaign Reward',
                `Earned ${rewardAmount} ${campaign?.reward_symbol || 'USDC'} from campaign: ${campaign?.title || campaign_id}`,
                rewardAmount,
                campaign?.reward_symbol || 'USDC',
                { xp_award_tx: award.txHash, remaining_reward_pool: updatedRemainingRewardPool }
            );
        }

        return res.status(200).json({
            success: true,
            xp: totalXp,
            txHash: award.txHash,
            token_reward_amount: campaign?.reward_amount_per_user || '0',
            usdc_reward: campaign?.reward_amount_per_user || '0',
            reward_symbol: campaign?.reward_symbol || 'USDC',
            reward_token_address: campaign?.reward_token_address || campaign?.payment_token || null,
            remaining_reward_pool: updatedRemainingRewardPool,
            payout_status: finalizedClaim.payout_status,
            payout_tx_hash: finalizedClaim.payout_tx_hash,
            payout_deadline_at: payoutDeadlineAt,
            requires_onchain_payout: rewardAmount > 0,
            message: rewardAmount > 0
                ? 'Campaign XP recorded. Token reward is earned and pending on-chain payout claim.'
                : 'Campaign XP reward claimed successfully.'
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
            if (reservedCampaignClaim && !onChainAwarded) {
                await supabaseAdmin.from('user_claims')
                    .update({ is_claimed: false, claimed_at: null, payout_status: 'failed' })
                    .eq('user_address', cleanWallet)
                    .eq('campaign_id', campaign_id)
                    .in('payout_status', ['processing', 'xp_processing']);
            } else if (reservedCampaignClaim && onChainAwarded) {
                await supabaseAdmin.from('user_claims')
                    .update({ payout_status: 'sync_failed' })
                    .eq('user_address', cleanWallet)
                    .eq('campaign_id', campaign_id)
                    .in('payout_status', ['processing', 'xp_processing']);
            }
        } catch {
            // Preserve the original claim error; reconciliation can repair payout_status.
        }
        console.error('[handleClaimUgcCampaign]', msg);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handlePrepareUgcPayoutClaim(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, campaign_id } = req.body;
    if (!wallet_address || !signature || !message || !campaign_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const cleanWallet = String(wallet_address).trim().toLowerCase();
    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        if (!message.includes(`ID: ${campaign_id}`) || !String(message).toLowerCase().includes(cleanWallet)) {
            return res.status(400).json({ error: 'Payout authorization message mismatch.' });
        }

        if (!UGC_REWARD_ESCROW_ADDRESS?.startsWith('0x')) {
            return res.status(503).json({ error: 'UGC reward escrow contract is not configured.' });
        }

        const account = getWalletBotAccount();
        if (!account) return res.status(503).json({ error: 'UGC payout authorizer is not configured.' });

        const [{ data: joinRecord, error: joinErr }, { data: campaign, error: campaignErr }, { data: earnedClaim, error: earnedErr }] = await Promise.all([
            supabaseAdmin
                .from('user_claims')
                .select('id, is_claimed, payout_status, payout_amount, payout_tx_hash, payout_deadline_at')
                .eq('user_address', cleanWallet)
                .eq('campaign_id', campaign_id)
                .maybeSingle(),
            supabaseAdmin
                .from('campaigns')
                .select('id, title, reward_amount_per_user, reward_symbol, reward_token_address, payment_token, escrow_contract_address, claim_deadline_at')
                .eq('id', campaign_id)
                .maybeSingle(),
            supabaseAdmin
                .from('user_task_claims')
                .select('id')
                .eq('wallet_address', cleanWallet)
                .eq('task_id', `ugc_campaign_${campaign_id}`)
                .maybeSingle()
        ]);

        if (joinErr) throw joinErr;
        if (campaignErr) throw campaignErr;
        if (earnedErr) throw earnedErr;
        if (!joinRecord || !joinRecord.is_claimed || !earnedClaim) {
            return res.status(409).json({ error: 'Campaign reward must be earned before token payout claim.' });
        }
        if (joinRecord.payout_status === 'paid') {
            return res.status(200).json({ success: true, already_paid: true, payout_tx_hash: joinRecord.payout_tx_hash });
        }
        if (joinRecord.payout_status !== 'earned_pending_onchain_claim') {
            return res.status(409).json({ error: 'Campaign reward is not ready for on-chain payout claim.', payout_status: joinRecord.payout_status });
        }

        const deadlineAt = joinRecord.payout_deadline_at || campaign?.claim_deadline_at;
        const deadlineMs = deadlineAt ? new Date(deadlineAt).getTime() : Date.now() + 72 * 60 * 60 * 1000;
        if (!Number.isFinite(deadlineMs) || Date.now() > deadlineMs) {
            return res.status(410).json({ error: 'UGC payout claim window expired.', payout_deadline_at: deadlineAt });
        }

        const rewardAmount = Number(joinRecord.payout_amount || campaign?.reward_amount_per_user || 0);
        if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
            return res.status(409).json({ error: 'Invalid payout amount.' });
        }

        const campaignKey = toCampaignKey(campaign_id);
        const token = normalizeRewardToken(campaign?.reward_token_address || campaign?.payment_token || null, campaign?.reward_symbol);
        const amountRaw = rewardAmountRaw(rewardAmount, campaign?.reward_symbol);
        const deadline = BigInt(Math.floor(deadlineMs / 1000));
        const nonceHex = keccak256(encodePacked(
            ['bytes32', 'address', 'address', 'uint256', 'uint256'],
            [campaignKey, cleanWallet as `0x${string}`, token, amountRaw, deadline]
        ));
        const nonce = BigInt(nonceHex);

        const typedSignature = await account.signTypedData({
            domain: {
                name: 'DiscoDailyUGCRewardEscrow',
                version: '1',
                chainId: Number(CHAIN_ID),
                verifyingContract: UGC_REWARD_ESCROW_ADDRESS as `0x${string}`
            },
            types: {
                ClaimAuthorization: [
                    { name: 'campaignId', type: 'bytes32' },
                    { name: 'claimant', type: 'address' },
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' }
                ]
            },
            primaryType: 'ClaimAuthorization',
            message: {
                campaignId: campaignKey,
                claimant: cleanWallet as `0x${string}`,
                token,
                amount: amountRaw,
                deadline,
                nonce
            }
        });

        await supabaseAdmin
            .from('user_claims')
            .update({
                payout_authorization_nonce: nonce.toString(),
                payout_deadline_at: new Date(Number(deadline) * 1000).toISOString()
            })
            .eq('id', joinRecord.id);

        return res.status(200).json({
            success: true,
            escrow_address: UGC_REWARD_ESCROW_ADDRESS,
            campaign_key: campaignKey,
            token,
            amount: amountRaw.toString(),
            reward_amount: rewardAmount,
            reward_symbol: campaign?.reward_symbol || 'TOKEN',
            deadline: deadline.toString(),
            nonce: nonce.toString(),
            signature: typedSignature,
            payout_deadline_at: new Date(Number(deadline) * 1000).toISOString()
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[handlePrepareUgcPayoutClaim]', msg);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleSyncUgcPayout(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, campaign_id, tx_hash } = req.body;
    if (!wallet_address || !signature || !message || !campaign_id || !tx_hash) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const cleanWallet = String(wallet_address).trim().toLowerCase();
    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        if (!message.includes(`ID: ${campaign_id}`) || !message.includes(`Tx: ${tx_hash}`) || !String(message).toLowerCase().includes(cleanWallet)) {
            return res.status(400).json({ error: 'Payout sync message mismatch.' });
        }

        const [{ data: joinRecord, error: joinErr }, { data: campaign, error: campaignErr }, { data: earnedClaim, error: earnedErr }] = await Promise.all([
            supabaseAdmin
                .from('user_claims')
                .select('id, is_claimed, payout_status, payout_amount, payout_tx_hash')
                .eq('user_address', cleanWallet)
                .eq('campaign_id', campaign_id)
                .maybeSingle(),
            supabaseAdmin
                .from('campaigns')
                .select('id, title, reward_amount_per_user, reward_symbol, reward_token_address, payment_token')
                .eq('id', campaign_id)
                .maybeSingle(),
            supabaseAdmin
                .from('user_task_claims')
                .select('id')
                .eq('wallet_address', cleanWallet)
                .eq('task_id', `ugc_campaign_${campaign_id}`)
                .maybeSingle()
        ]);

        if (joinErr) throw joinErr;
        if (campaignErr) throw campaignErr;
        if (earnedErr) throw earnedErr;
        if (!joinRecord) return res.status(403).json({ error: 'You must join the campaign before syncing payout.' });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
        if (!joinRecord.is_claimed || !earnedClaim) {
            return res.status(409).json({ error: 'Campaign reward must be earned before payout can be synced.' });
        }

        if (joinRecord.payout_status === 'paid' && joinRecord.payout_tx_hash) {
            return res.status(200).json({
                success: true,
                already_synced: true,
                payout_status: 'paid',
                payout_tx_hash: joinRecord.payout_tx_hash
            });
        }

        const rewardAmount = Number(joinRecord.payout_amount || campaign.reward_amount_per_user || 0);
        await verifyUgcPayoutTransfer({
            txHash: tx_hash,
            campaignId: campaign_id,
            wallet: cleanWallet,
            tokenAddress: campaign.reward_token_address || campaign.payment_token || null,
            rewardSymbol: campaign.reward_symbol,
            rewardAmount
        });

        const { data: updatedClaim, error: updateErr } = await supabaseAdmin
            .from('user_claims')
            .update({
                payout_status: 'paid',
                payout_tx_hash: tx_hash
            })
            .eq('id', joinRecord.id)
            .select('id, payout_status, payout_amount, payout_tx_hash')
            .maybeSingle();

        if (updateErr) throw updateErr;
        if (!updatedClaim || updatedClaim.payout_status !== 'paid') {
            throw new Error('UGC_PAYOUT_SYNC_FINALIZATION_FAILED');
        }

        await logActivity(
            cleanWallet,
            'REWARD',
            'UGC Campaign Payout',
            `Claimed ${rewardAmount} ${campaign.reward_symbol || 'TOKEN'} payout for UGC campaign: ${campaign.title || campaign_id}`,
            rewardAmount,
            campaign.reward_symbol || 'TOKEN',
            { campaign_id, payout_verified: true },
            tx_hash
        );

        return res.status(200).json({
            success: true,
            payout_status: 'paid',
            payout_amount: updatedClaim.payout_amount,
            payout_tx_hash: updatedClaim.payout_tx_hash,
            message: 'UGC campaign payout verified and synced.'
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[handleSyncUgcPayout]', msg);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}

async function handleSpinGacha(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message } = req.body;
    if (!wallet_address || !signature || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let deductedWallet: string | null = null;
    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // Signature freshness guard: 5-minute threshold
        const timestampMatch = message.match(/Time:\s*([^\n]+)/i);
        const timeStr = timestampMatch ? timestampMatch[1].trim() : null;
        if (!timeStr) return res.status(400).json({ error: 'Message missing timestamp' });

        const sigTime = new Date(timeStr).getTime();
        const now = Date.now();
        if (Math.abs(now - sigTime) > 5 * 60 * 1000) {
            return res.status(400).json({ error: 'Signature expired (must be under 5 minutes)' });
        }

        const wallet = wallet_address.toLowerCase();

        // 1. Fetch current profile state
        const { data: profile, error: profileErr } = await supabaseAdmin
            .from('user_profiles')
            .select('raffle_tickets_bought, total_xp, streak_count, tier')
            .eq('wallet_address', wallet)
            .maybeSingle();

        if (profileErr) throw profileErr;
        if (!profile) return res.status(404).json({ error: 'User profile not found' });

        const currentTickets = Number(profile.raffle_tickets_bought || 0);
        if (currentTickets < 1) {
            return res.status(400).json({ error: 'Insufficient ticket balance to spin the Gacha Wheel.' });
        }

        // 2. Resolve Win Segment (0-5)
        const segmentPrizes = [
            { text: '+50 XP', category: 'XP', amount: 50 },
            { text: '+100 XP', category: 'XP', amount: 100 },
            { text: '+125 XP', category: 'XP', amount: 125 },
            { text: '+150 XP Bonus', category: 'XP', amount: 150 },
            { text: '+175 XP', category: 'XP', amount: 175 },
            { text: '+200 XP', category: 'XP', amount: 200 }
        ];

        const winIdx = Math.floor(Math.random() * segmentPrizes.length);
        const winPrize = segmentPrizes[winIdx];

        // 3. Deduct 1 ticket atomically
        await supabaseAdmin.rpc('fn_increment_raffle_tickets', {
            p_wallet: wallet,
            p_amount: -1
        });
        deductedWallet = wallet;

        // [ON-CHAIN FIRST] Award XP via bot signer for every prize.
        const award = await requireOnChainXpAward('awardMojoXp', [wallet as `0x${string}`, BigInt(winPrize.amount)], wallet, 'handleSpinGacha');

        // 4. Distribute reward
        const prizeDetail = `Earned +${winPrize.amount} XP on-chain`;

        // 5. Log Activity with millisecond-precision ISO timestamp
        await logActivity(
            wallet,
            'GACHA',
            'Wheel Spin',
            `Spun Gacha Wheel. Won: ${winPrize.text} (${prizeDetail})`,
            winPrize.amount,
            winPrize.category,
            { segment_index: winIdx, prize_label: winPrize.text, prize_detail: prizeDetail, onchain_xp: award.points, onchain_tier: award.tier },
            award.txHash
        );

        return res.status(200).json({
            success: true,
            winIndex: winIdx,
            prizeLabel: winPrize.text,
            prizeDetail,
            txHash: award.txHash
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (deductedWallet && msg === 'ONCHAIN_XP_AWARD_FAILED') {
            try {
                await supabaseAdmin.rpc('fn_increment_raffle_tickets', {
                    p_wallet: deductedWallet,
                    p_amount: 1
                });
            } catch {
                // Refund failure is logged by the outer error path.
            }
        }
        console.error('[handleSpinGacha Error]', msg);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}
