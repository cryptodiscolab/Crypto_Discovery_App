/* eslint-disable @typescript-eslint/no-explicit-any */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyMessage, keccak256, toBytes, formatEther } from 'viem';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    rpcClient,
    DAILY_APP_ADDRESS,
    DAILY_APP_USER_STATS_ABI,
    MASTER_X_ADDRESS,
    NEYNAR_API_KEY,
    MASTER_X_EVENT_ABI,
    DAILY_APP_EVENT_ABI,
    USDC_ADDRESS,
    getEnv,
    sanitizeError
} from './_shared/constants.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = getEnv('CRON_SECRET', '');

const TASK_IDS = {
    REFERRAL_XP: getEnv('REFERRAL_TASK_ID', "12e123f5-0ded-4ca1-af04-e8b6924823e2"),
    ONCHAIN_TASK: getEnv('ONCHAIN_TASK_ID', "885535d2-4c5c-4a80-9af5-36666192c244"),
    TIER_UPGRADE: getEnv('TIER_UPGRADE_TASK_ID', "2c1e23f5-0ded-4ca1-af04-e8b6924823e2")
};

function makeId(seed: string) {
    const hash = keccak256(toBytes(seed));
    return [
        hash.slice(2, 10), hash.slice(10, 14), hash.slice(14, 18), hash.slice(18, 22), hash.slice(22, 34)
    ].join("-");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    try {
        switch (action) {
            case 'check': await handleFarcasterCheck(req, res); break;
            case 'sync': await handleSyncEvents(req, res); break;
            case 'rpc': await handleRpcProxy(req, res); break;
            case 'reconcile-pending': await handleReconcilePending(req, res); break;
            default:
                return res.status(400).json({ error: "Invalid action" });
        }
    } catch (error: any) {
        return res.status(500).json({ error: sanitizeError(error) });
    }
}

async function handleRpcProxy(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { method } = req.body;
    const ALLOWED = ['eth_sendRawTransaction', 'eth_getTransactionCount', 'eth_chainId', 'eth_gasPrice', 'eth_call', 'eth_estimateGas', 'eth_blockNumber', 'eth_getTransactionReceipt', 'eth_getCode', 'eth_getBalance'];
    if (!ALLOWED.includes(method)) return res.status(403).json({ error: 'Method not allowed' });

    const ALCHEMY_KEY = getEnv('VITE_ALCHEMY_API_KEY', getEnv('ALCHEMY_API_KEY'));
    const CHAIN_ID = req.query.chainId || '84532';
    const targetRpc = CHAIN_ID === '8453' ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    try {
        const response = await fetch(targetRpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (e: any) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}

async function handleFarcasterCheck(req: VercelRequest, res: VercelResponse) {
    const { address, signature, message } = req.query as { address: string, signature?: string, message?: string };
    const clean = address.toLowerCase();

    if (signature && message) {
        const valid = await verifyMessage({ address: clean as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
        const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${clean}`, {
            headers: { 'api_key': NEYNAR_API_KEY || '' }
        });
        const data = await response.json();
        const user = data[clean]?.[0] || null;
        return res.status(user ? 200 : 404).json(user);
    } catch (e: any) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}

async function handleSyncEvents(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();
    const authHeader = req.headers['authorization'];
    if (!CRON_SECRET) return res.status(500).json({ error: "CRON_SECRET not configured" });
    if (authHeader !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { data: state } = await supabase.from("sync_state").select("last_synced_block").eq("id", "main").maybeSingle();
        const lastBlock = BigInt(state?.last_synced_block ?? 0);
        const latestBlock = await rpcClient.getBlockNumber();

        if (latestBlock <= lastBlock) return res.json({ status: "no_new_blocks" });

        const fromBlock = lastBlock + 1n;
        const toBlock = latestBlock > fromBlock + 2000n ? fromBlock + 2000n : latestBlock;

        const [pointLogs, taskLogs, upgradeLogs, , rewardLogs] = await Promise.all([
            rpcClient.getLogs({ address: MASTER_X_ADDRESS as `0x${string}`, event: MASTER_X_EVENT_ABI[0], fromBlock, toBlock }),
            rpcClient.getLogs({ address: DAILY_APP_ADDRESS as `0x${string}`, event: DAILY_APP_EVENT_ABI[0], fromBlock, toBlock }),
            rpcClient.getLogs({ address: MASTER_X_ADDRESS as `0x${string}`, event: MASTER_X_EVENT_ABI[1], fromBlock, toBlock }),
            rpcClient.getLogs({ address: MASTER_X_ADDRESS as `0x${string}`, event: MASTER_X_EVENT_ABI[2], fromBlock, toBlock }),
            rpcClient.getLogs({ address: DAILY_APP_ADDRESS as `0x${string}`, event: DAILY_APP_EVENT_ABI[1], fromBlock, toBlock }),
        ]);

        const rows: any[] = [];

        for (const log of pointLogs) {
            const { user, points, reason } = log.args as any;
            const wallet = user.toLowerCase();
            const xp = Number(points);
            rows.push({
                id: makeId(`MX_P_${log.transactionHash}_${log.logIndex}`),
                wallet_address: wallet,
                task_id: TASK_IDS.REFERRAL_XP,
                xp_earned: xp,
                claimed_at: new Date().toISOString(),
                tx_hash: log.transactionHash,
                source: `MasterX:${reason}`
            });
            await logActivity(supabase, { wallet, category: 'XP', type: 'Reward', description: reason, amount: xp, symbol: 'XP', txHash: log.transactionHash });
        }

        for (const log of taskLogs) {
            const { user, taskId, reward, timestamp } = log.args as any;
            const wallet = user.toLowerCase();
            const xp = Number(reward);
            rows.push({
                id: makeId(`DA_T_${log.transactionHash}_${log.logIndex}`),
                wallet_address: wallet,
                task_id: TASK_IDS.ONCHAIN_TASK,
                xp_earned: xp,
                claimed_at: new Date(Number(timestamp) * 1000).toISOString(),
                tx_hash: log.transactionHash,
                source: `DailyApp:task_${taskId}`
            });
            await logActivity(supabase, { wallet, category: 'XP', type: 'Task', description: `Task #${taskId}`, amount: xp, symbol: 'XP', txHash: log.transactionHash });
        }

        for (const log of upgradeLogs) {
            const { user, oldTier, newTier, xpBurned } = log.args as any;
            const wallet = user.toLowerCase();
            const burn = Number(xpBurned);
            rows.push({
                id: makeId(`MX_U_${log.transactionHash}_${log.logIndex}`),
                wallet_address: wallet,
                task_id: TASK_IDS.TIER_UPGRADE,
                xp_earned: -burn,
                claimed_at: new Date().toISOString(),
                tx_hash: log.transactionHash,
                source: `TierUpgrade:${oldTier}->${newTier}`
            });
            await supabase.from('user_profiles').update({ tier: Number(newTier) }).eq('wallet_address', wallet);
            // Persistent SBT / Tier Upgrade log for profile and admin filters
            await logActivity(supabase, { wallet, category: 'SBT', type: 'Tier Upgrade Synced', description: `Tier ${Number(oldTier)} → ${Number(newTier)} (XP burned: ${burn})`, amount: burn, symbol: 'XP', txHash: log.transactionHash });
        }

        for (const log of rewardLogs) {
            const { user, token, amount } = log.args as any;
            const wallet = user.toLowerCase();
            const isUsdc = token.toLowerCase() === USDC_ADDRESS.toLowerCase();
            const symbol = isUsdc ? 'USDC' : 'ETH';
            const norm = isUsdc ? Number(amount) / 1e6 : Number(formatEther(amount));
            await logActivity(supabase, { wallet, category: 'REWARD', type: 'Payout', description: `Claimed ${norm} ${symbol}`, amount: norm, symbol, txHash: log.transactionHash });
        }

        if (rows.length > 0) await supabase.from("user_task_claims").upsert(rows, { onConflict: "id" });
        await supabase.from("sync_state").upsert({ id: "main", last_synced_block: Number(toBlock), updated_at: new Date().toISOString() });

        return res.json({ status: "ok", scanned: `${fromBlock}->${toBlock}`, duration: Date.now() - startTime });
    } catch (e: any) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}

async function logActivity(supabase: SupabaseClient, { wallet, category, type, description, amount, symbol, txHash }: any) {
    await supabase.from('user_activity_logs').insert({
        wallet_address: wallet.toLowerCase(),
        category,
        activity_type: type,
        description,
        value_amount: amount || 0,
        value_symbol: symbol || 'XP',
        tx_hash: txHash,
        created_at: new Date().toISOString() // Rule 75 precision timestamp
    });
}

// ─── Pending Sync Reconciliation ─────────────────────────────────────────────
// Picks up pending_sync_jobs rows and retries the corresponding backend sync.
// Called by cron or admin trigger.

async function handleReconcilePending(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();
    const authHeader = req.headers['authorization'];
    if (!CRON_SECRET) return res.status(500).json({ error: "CRON_SECRET not configured" });
    if (authHeader !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: "Unauthorized" });

    const MAX_RETRIES = 5;
    const BATCH_SIZE = 20;

    try {
        const { data: jobs, error: fetchErr } = await (supabase as any)
            .from('pending_sync_jobs')
            .select('*')
            .eq('status', 'pending')
            .lt('retry_count', MAX_RETRIES)
            .order('created_at', { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchErr || !jobs || jobs.length === 0) {
            return res.status(200).json({ success: true, processed: 0, message: 'No pending jobs' });
        }

        let resolved = 0;
        let failed = 0;

        for (const job of jobs) {
            try {
                // Verify the tx_hash is still valid on-chain
                let txValid = false;
                if (job.tx_hash) {
                    try {
                        const receipt = await rpcClient.getTransactionReceipt({ hash: job.tx_hash as `0x${string}` });
                        txValid = receipt?.status === 'success';
                    } catch {
                        // Receipt not found or RPC error — mark as attempted, don't resolve
                    }
                }

                if (txValid) {
                    // Transaction confirmed on-chain — perform action-specific sync before marking resolved.
                    
                    // For SBT upgrade jobs: read on-chain tier and update DB
                    if (job.action_type === 'sbt_upgrade' || job.action_type === 'sbt_mint') {
                        try {
                            const wallet = job.wallet_address.toLowerCase();
                            const stats = await rpcClient.readContract({
                                address: DAILY_APP_ADDRESS as `0x${string}`,
                                abi: DAILY_APP_USER_STATS_ABI,
                                functionName: 'userStats',
                                args: [wallet as `0x${string}`]
                            }) as unknown as [bigint, bigint, bigint, number, bigint, bigint, boolean];
                            
                            const onChainTier = Number(stats[3]);
                            const onChainXp = Number(stats[0]);
                            
                            await (supabase as any).from('user_profiles').update({
                                tier: onChainTier,
                                total_xp: onChainXp,
                                last_onchain_xp: onChainXp,
                                updated_at: new Date().toISOString()
                            }).eq('wallet_address', wallet);
                        } catch (syncErr) {
                            console.warn(`[Reconcile] SBT tier sync for job ${job.id} failed:`, syncErr);
                        }
                    }

                    // For daily_claim jobs: sync daily bonus XP, streak, and log activity
                    if (job.action_type === 'daily_claim') {
                        try {
                            const wallet = job.wallet_address.toLowerCase();
                            const cleanTxHash = job.tx_hash ? String(job.tx_hash).trim().toLowerCase() : '';

                            // Check if the transaction is already in user_activity_logs (already synced)
                            const { data: existingLog, error: logCheckErr } = await (supabase as any)
                                .from('user_activity_logs')
                                .select('id')
                                .eq('tx_hash', cleanTxHash)
                                .maybeSingle();

                            if (logCheckErr) throw logCheckErr;

                            if (existingLog) {
                                console.log(`[Reconcile] Job ${job.id} daily claim already synced in user_activity_logs.`);
                            } else {
                                // Fetch current profile
                                const { data: profile, error: profErr } = await (supabase as any)
                                    .from('user_profiles')
                                    .select('last_onchain_xp, total_xp, streak_count, last_streak_claim')
                                    .eq('wallet_address', wallet)
                                    .maybeSingle();

                                if (profErr) throw profErr;
                                if (!profile) {
                                    throw new Error(`Profile not found for wallet: ${wallet}`);
                                }

                                const lastOnChainXp = profile.last_onchain_xp || 0;
                                const currentTotalXp = profile.total_xp || 0;

                                // Fetch contract stats
                                const stats = await rpcClient.readContract({
                                    address: DAILY_APP_ADDRESS as `0x${string}`,
                                    abi: DAILY_APP_USER_STATS_ABI,
                                    functionName: 'userStats',
                                    args: [wallet as `0x${string}`]
                                }) as unknown as [bigint, bigint, bigint, number, bigint, bigint, boolean];

                                const currentOnChainXp = Number(stats[0] || 0);
                                const currentTierOnChain = Number(stats[3] || 0);

                                const xpDelta = currentOnChainXp > lastOnChainXp ? (currentOnChainXp - lastOnChainXp) : 0;
                                const finalLastOnChainXpToSave = currentOnChainXp;

                                let recoveryDelta = 0;
                                if (currentTotalXp < lastOnChainXp) {
                                    recoveryDelta = lastOnChainXp - currentTotalXp;
                                }

                                const totalXpToIncrement = xpDelta + recoveryDelta;

                                if (totalXpToIncrement === 0) {
                                    if (currentTotalXp === currentOnChainXp && lastOnChainXp === currentOnChainXp) {
                                        console.log(`[Reconcile] Job ${job.id} already has DB/on-chain XP parity; resolving without XP mutation.`);
                                    } else {
                                        // No delta to sync, and not in user_activity_logs.
                                        // This means RPC state is lagging or the tx didn't change points.
                                        throw new Error('RPC_STATE_LAG: No XP delta or recovery found yet.');
                                    }
                                }

                                if (totalXpToIncrement > 0) {
                                    // Calculate streak updates
                                    let currentStreakToSave = profile.streak_count || 0;
                                    let lastStreakClaimToSave = profile.last_streak_claim || null;

                                    if (xpDelta > 0) {
                                        const now = new Date();
                                        const lastClaimDate = profile.last_streak_claim ? new Date(profile.last_streak_claim) : null;

                                        if (!lastClaimDate) {
                                            currentStreakToSave = 1;
                                        } else {
                                            const diffHours = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);
                                            if (diffHours >= 20 && diffHours <= 48) currentStreakToSave += 1;
                                            else if (diffHours > 48) currentStreakToSave = 1;
                                        }
                                        lastStreakClaimToSave = now.toISOString();
                                    }

                                    // Apply updates with OCC
                                    const updatePayload: any = {
                                        tier: currentTierOnChain,
                                        updated_at: new Date().toISOString()
                                    };

                                    if (xpDelta > 0) {
                                        updatePayload.last_onchain_xp = finalLastOnChainXpToSave;
                                    }

                                    updatePayload.streak_count = currentStreakToSave;
                                    updatePayload.last_streak_claim = lastStreakClaimToSave;

                                    const { data: updateData, error: updateErr } = await (supabase as any)
                                        .from('user_profiles')
                                        .update(updatePayload)
                                        .eq('wallet_address', wallet)
                                        .eq('last_onchain_xp', lastOnChainXp)
                                        .eq('total_xp', currentTotalXp)
                                        .select('wallet_address');

                                    if (updateErr) throw updateErr;
                                    if (!updateData || updateData.length === 0) {
                                        throw new Error('Conflict: Sync already processed concurrently.');
                                    }

                                    // Increment total_xp
                                    const { error: rpcErr } = await (supabase as any).rpc('fn_increment_xp', {
                                        p_wallet: wallet,
                                        p_amount: totalXpToIncrement
                                    });

                                    if (rpcErr) throw rpcErr;

                                    // Log activity using logActivity helper
                                    const logDescription = xpDelta > 0 && recoveryDelta > 0
                                        ? `Daily claim (reconciled): +${xpDelta} XP (streak: ${currentStreakToSave}) and recovered +${recoveryDelta} XP from under-sync.`
                                        : xpDelta > 0
                                            ? `Daily claim (reconciled): +${xpDelta} XP (streak: ${currentStreakToSave})`
                                            : `Ecosystem Parity Recovery (reconciled): Restored +${recoveryDelta} XP from under-sync.`;

                                    await logActivity(supabase, {
                                        wallet,
                                        category: 'XP',
                                        type: recoveryDelta > 0 && xpDelta === 0 ? 'Parity Recovery' : 'On-chain Daily Claim',
                                        description: logDescription,
                                        amount: totalXpToIncrement,
                                        symbol: 'XP',
                                        txHash: cleanTxHash || null
                                    });
                                }
                            }
                        } catch (syncErr) {
                            console.warn(`[Reconcile] Daily claim sync for job ${job.id} failed:`, syncErr);
                            throw syncErr; // Re-throw to trigger retry_count increment in the outer catch block
                        }
                    }

                    await (supabase as any)
                        .from('pending_sync_jobs')
                        .update({
                            status: 'resolved',
                            resolved_at: new Date().toISOString(),
                            last_attempted_at: new Date().toISOString(),
                            retry_count: job.retry_count + 1
                        })
                        .eq('id', job.id);
                    resolved++;
                } else {
                    if (job.action_type === 'daily_claim' && job.wallet_address) {
                        try {
                            const wallet = job.wallet_address.toLowerCase();
                            const [{ data: profile, error: profileErr }, stats] = await Promise.all([
                                (supabase as any)
                                    .from('user_profiles')
                                    .select('total_xp, last_onchain_xp')
                                    .eq('wallet_address', wallet)
                                    .maybeSingle(),
                                rpcClient.readContract({
                                    address: DAILY_APP_ADDRESS as `0x${string}`,
                                    abi: DAILY_APP_USER_STATS_ABI,
                                    functionName: 'userStats',
                                    args: [wallet as `0x${string}`]
                                }) as Promise<[bigint, bigint, bigint, number, bigint, bigint, boolean]>
                            ]);

                            if (profileErr) throw profileErr;

                            const dbTotalXp = Number(profile?.total_xp || 0);
                            const dbLastOnChainXp = Number(profile?.last_onchain_xp || 0);
                            const onChainXp = Number(stats[0] || 0);

                            if (profile && dbTotalXp === onChainXp && dbLastOnChainXp === onChainXp) {
                                await (supabase as any)
                                    .from('pending_sync_jobs')
                                    .update({
                                        status: 'resolved',
                                        resolved_at: new Date().toISOString(),
                                        last_attempted_at: new Date().toISOString(),
                                        retry_count: job.retry_count + 1,
                                        error_message: 'Reconciliation: no XP drift detected; resolved without receipt'
                                    })
                                    .eq('id', job.id);
                                resolved++;
                                continue;
                            }
                        } catch (parityErr) {
                            console.warn(`[Reconcile] No-drift resolution check for job ${job.id} failed:`, parityErr);
                        }
                    }

                    // Tx not confirmed or no tx_hash — increment retry count
                    const newRetryCount = job.retry_count + 1;
                    const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
                    await (supabase as any)
                        .from('pending_sync_jobs')
                        .update({
                            status: newStatus,
                            retry_count: newRetryCount,
                            last_attempted_at: new Date().toISOString(),
                            error_message: 'Reconciliation: tx receipt not confirmed'
                        })
                        .eq('id', job.id);
                    if (newStatus === 'failed') failed++;
                }
            } catch (jobErr: unknown) {
                const msg = jobErr instanceof Error ? jobErr.message : String(jobErr);
                console.error(`[Reconcile] Job ${job.id} error:`, msg);
                await (supabase as any)
                    .from('pending_sync_jobs')
                    .update({
                        retry_count: job.retry_count + 1,
                        last_attempted_at: new Date().toISOString(),
                        error_message: msg.slice(0, 500)
                    })
                    .eq('id', job.id);
            }
        }

        return res.status(200).json({
            success: true,
            processed: jobs.length,
            resolved,
            failed,
            duration_ms: Date.now() - startTime
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}
