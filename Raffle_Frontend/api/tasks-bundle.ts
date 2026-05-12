import { createClient } from '@supabase/supabase-js';
import { verifyMessage, createPublicClient, http, decodeEventLog } from 'viem';
import { VercelResponse } from '@vercel/node';
import { 
    SUPABASE_URL, 
    SUPABASE_SERVICE_ROLE_KEY, 
    VIEM_CHAIN, 
    RPC_URL, 
    getContractAddr,
    RAFFLE_EVENT_ABI,
    IS_MAINNET,
    sanitizeError
} from './constants';
import { 
    PointSetting,
    Database,
    DbDailyTask,
    ExtendedVercelRequest,
    TaskClaimResponse
} from './types';

const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const publicClient = createPublicClient({
    chain: VIEM_CHAIN,
    transport: http(RPC_URL)
});

// 🛡️ REFACTORED HELPERS 🛡️

// Fire-and-forget: trigger on-chain XP sync after DB update
function triggerOnchainSync() {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
    if (!baseUrl) return;
    fetch(`${baseUrl}/api/sync-xp-onchain`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET || ''}` }
    }).catch(() => {}); // fire-and-forget, don't block response
}

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
        if (!txHash || !txHash.startsWith('0x')) throw new Error('Missing transaction hash in task ID');

        const amountMatch = message.match(/Amount:\s*(\d+)/i);
        const expectedAmount = amountMatch ? parseInt(amountMatch[1], 10) : 0;
        if (expectedAmount <= 0) throw new Error('Invalid amount in message');

        try {
            const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
            if (!receipt || receipt.status !== 'success') throw new Error('Transaction failed or not found');

            let confirmedAmount = 0;
            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: RAFFLE_EVENT_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === 'TicketPurchased') {
                        if (decoded.args.user.toLowerCase() === wallet_address.toLowerCase()) {
                            confirmedAmount += Number(decoded.args.count);
                        }
                    }
                } catch (e) { /* skip logs from other contracts */ }
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
                event: RAFFLE_EVENT_ABI[1],
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
    if (task_id && task_id.startsWith('raffle_')) {
        targetId = task_id.split('_').pop() || null;
    } else {
        const { data: task } = await supabaseAdmin.from('daily_tasks').select('target_id').eq('id', task_id).maybeSingle<DbDailyTask>();
        targetId = task?.target_id || null;
    }

    if (targetId) {
        const { count } = await supabaseAdmin
            .from('user_task_claims')
            .select('id', { count: 'exact', head: true })
            .eq('wallet_address', wallet_address.toLowerCase())
            .eq('target_id', targetId);
        if (count && count > 0) throw new Error('[Security] Target account already claimed by this user');
    }

    return { xp, targetId };
}

async function logActivity(wallet: string, category: string, type: string, description: string) {
    try {
        await supabaseAdmin.from('user_activity_logs').insert({
            wallet_address: wallet.toLowerCase(),
            category,
            activity_type: type,
            description,
            value_amount: 0,
            value_symbol: 'XP',
            created_at: new Date().toISOString()
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[logActivity Error]', msg);
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
        
        const { error: claimErr } = await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet,
            task_id: 'daily_task_completion',
            xp_earned: bonusXp,
            platform: 'system',
            action_type: 'daily_bonus'
        });

        if (claimErr) return; 

        await supabaseAdmin.rpc('fn_increment_xp', {
            p_wallet: wallet,
            p_amount: bonusXp
        });

        await logActivity(wallet, 'XP', 'Daily Goal Reached', `Unlocked 3-Task Daily Bonus!`);

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

    try {
        switch (action) {
            case 'claim': await handleClaim(req, res); break;
            case 'verify': await handleVerify(req, res); break;
            case 'social-verify': await handleSocialVerify(req, res); break;
            case 'claim-ugc-campaign': await handleClaimUgcCampaign(req, res); break;
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

        const { error } = await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet_address.toLowerCase(),
            task_id,
            xp_earned: xp,
            target_id: targetId
        });

        if (error) {
            if (error.code === '23505') {
                return res.status(200).json({ success: true, message: "Already claimed.", already_claimed: true });
            }
            throw error;
        }

        if (xp > 0) {
            const { error: xpErr } = await supabaseAdmin.rpc('fn_increment_xp', {
                p_wallet: wallet_address.toLowerCase(),
                p_amount: xp
            });
            if (xpErr) throw xpErr;
        }

        await logActivity(wallet_address, 'XP', 'Claim Success', `Earned ${xp} XP for ${task_id}`);

        await checkAndGrantDailyBonus(wallet_address);
        triggerOnchainSync();
        return res.status(200).json({ success: true, xp });
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

    const { error } = await supabaseAdmin.from('user_task_claims').insert({
        wallet_address: wallet_address.toLowerCase(),
        task_id,
        platform,
        action_type,
        xp_earned: xp,
        target_id: targetId
    });

    if (error) {
        if (error.code === '23505') {
            return res.status(200).json({ success: true, message: "Already verified.", already_claimed: true });
        }
        throw error;
    }

    if (xp > 0) {
        const { error: xpErr } = await supabaseAdmin.rpc('fn_increment_xp', {
            p_wallet: wallet_address.toLowerCase(),
            p_amount: xp
        });
        if (xpErr) {
            console.error('[handleVerify] fn_increment_xp failed:', xpErr.message);
            return res.status(500).json({ error: "Failed to update XP. Please try again." });
        }
    }

    if (task_id.startsWith('raffle_buy_')) {
        const amountMatch = message.match(/Amount:\s*(\d+)/i);
        const ticketCount = amountMatch ? parseInt(amountMatch[1], 10) : 1;
        
        await supabaseAdmin.rpc('fn_increment_raffle_tickets', {
            p_wallet: wallet_address.toLowerCase(),
            p_amount: ticketCount
        });

        await logActivity(wallet_address, 'PURCHASE', 'Raffle Ticket Buy', `Purchased ${ticketCount} Tickets for Raffle`);
    } else {
        await logActivity(wallet_address, 'XP', 'Task Verify', `Verified ${task_id} on ${platform}`);
    }

    await checkAndGrantDailyBonus(wallet_address);
    return res.status(200).json({ success: true, xp } as TaskClaimResponse);
}

async function handleSocialVerify(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
    if (!wallet_address || !signature || !message || !task_id) throw new Error('Missing fields');

    const { xp, targetId } = await validateAndCalculateXP(wallet_address, signature, message, task_id);

    const { error } = await supabaseAdmin.from('user_task_claims').insert({
        wallet_address: wallet_address.toLowerCase(),
        task_id,
        platform: platform || 'regular',
        action_type: action_type || 'task',
        xp_earned: xp,
        target_id: targetId
    });

    if (error) {
        if (error.code === '23505') return res.status(200).json({ success: true, message: "Already recorded.", already_claimed: true });
        throw error;
    }

    if (xp > 0) {
        const { error: xpErr } = await supabaseAdmin.rpc('fn_increment_xp', {
            p_wallet: wallet_address.toLowerCase(),
            p_amount: xp
        });
        if (xpErr) {
            console.error('[handleSocialVerify] fn_increment_xp failed:', xpErr.message);
            return res.status(500).json({ error: "Failed to update XP. Please try again." });
        }
    }

    await logActivity(wallet_address, 'XP', 'Social Verify', `Verified ${action_type} on ${platform}`);

    await checkAndGrantDailyBonus(wallet_address);
    return res.status(200).json({ success: true, xp, message: `Task verified.` });
}

async function handleClaimUgcCampaign(req: ExtendedVercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, campaign_id } = req.body;

    if (!wallet_address || !signature || !message || !campaign_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const { data: subTasks, error: stErr } = await supabaseAdmin
            .from('daily_tasks')
            .select('id, action_type, xp_reward, platform')
            .eq('onchain_id', campaign_id)
            .eq('task_type', 'ugc')
            .eq('is_active', true);

        if (stErr) throw stErr;
        if (!subTasks || subTasks.length === 0) {
            return res.status(404).json({ error: 'Campaign sub-tasks not found or not yet activated.' });
        }

        const { data: existingClaim } = await supabaseAdmin
            .from('user_task_claims')
            .select('id')
            .eq('wallet_address', wallet_address.toLowerCase())
            .eq('task_id', `ugc_campaign_${campaign_id}`)
            .maybeSingle();

        if (existingClaim) {
            return res.status(200).json({ success: true, already_claimed: true, message: 'Campaign reward already claimed.' });
        }

        const subTaskIds = subTasks.map(t => t.id);
        const { data: userClaims, error: clErr } = await supabaseAdmin
            .from('user_task_claims')
            .select('task_id')
            .eq('wallet_address', wallet_address.toLowerCase())
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
            .select('reward_amount_per_user, reward_symbol, title')
            .eq('id', campaign_id)
            .maybeSingle();

        await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet_address.toLowerCase(),
            task_id: `ugc_campaign_${campaign_id}`,
            xp_earned: totalXp,
            platform: 'ugc',
            action_type: 'campaign_complete'
        });

        if (totalXp > 0) {
            const { error: xpErr } = await supabaseAdmin.rpc('fn_increment_xp', {
                p_wallet: wallet_address.toLowerCase(),
                p_amount: totalXp
            });
            if (xpErr) throw xpErr;
        }

        await logActivity(wallet_address, 'XP', 'UGC Campaign Complete', `Completed UGC Campaign: ${campaign?.title || campaign_id}`);

        return res.status(200).json({
            success: true,
            xp: totalXp,
            usdc_reward: campaign?.reward_amount_per_user || '0',
            reward_symbol: campaign?.reward_symbol || 'USDC',
            message: 'Campaign reward claimed successfully!'
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[handleClaimUgcCampaign]', msg);
        return res.status(500).json({ error: sanitizeError(msg) });
    }
}
