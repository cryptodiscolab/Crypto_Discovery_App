import { createClient } from '@supabase/supabase-js';
import { verifyMessage, createPublicClient, http, decodeEventLog } from 'viem';
import { baseSepolia, base } from 'viem/chains';

const supabaseAdmin = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

// 1. DYNAMIC NETWORK SWITCHER (MAINNET SECURE)
const CHAIN_ID = (process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '84532').trim();
const isMainnet = CHAIN_ID === '8453';
const RPC_URL = (isMainnet ? process.env.VITE_RPC_URL : process.env.VITE_BASE_SEPOLIA_RPC_URL) || 'https://sepolia.base.org';

const publicClient = createPublicClient({
    chain: isMainnet ? base : baseSepolia,
    transport: http(RPC_URL)
});

// ABIs for Verification
const RAFFLE_EVENT_ABI = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "user", "type": "address" },
            { "indexed": true, "name": "raffleId", "type": "uint256" },
            { "indexed": false, "name": "count", "type": "uint256" }
        ],
        "name": "TicketPurchased",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "raffleId", "type": "uint256" },
            { "indexed": true, "name": "winner", "type": "address" },
            { "indexed": false, "name": "prize", "type": "uint256" }
        ],
        "name": "RaffleWinner",
        "type": "event"
    }
];


// 🛡️ REFACTORED HELPERS 🛡️

async function getPointValue(activityKey) {
    try {
        const { data, error } = await supabaseAdmin
            .from('point_settings')
            .select('points_value')
            .eq('activity_key', activityKey)
            .eq('is_active', true)
            .maybeSingle();
        if (error || !data) return 0;
        return data.points_value || 0;
    } catch (e) {
        console.error(`[PointLookup Error] Key: ${activityKey}`, e);
        return 0;
    }
}

// [REMOVED v3.41.2] getUserMultiplier is now handled atomically by public.fn_increment_xp in Supabase


async function getTaskReward(taskId) {
    if (taskId?.startsWith('raffle_buy_')) return await getPointValue('raffle_buy');
    if (taskId?.startsWith('raffle_win_')) return await getPointValue('raffle_win');
    try {
        const { data: task } = await supabaseAdmin
            .from('daily_tasks')
            .select('xp_reward, platform, action_type')
            .eq('id', taskId)
            .maybeSingle();
        if (!task) return 0;
        const dynamicKey = `${task.platform}_${task.action_type}`.toLowerCase().replace(/\s+/g, '_');
        const dynamicValue = await getPointValue(dynamicKey);
        return dynamicValue > 0 ? dynamicValue : (task.xp_reward || 0);
    } catch (e) { return 0; }
}

/**
 * 🛡️ ON-CHAIN VERIFIER 🛡️
 * Verifies that the transaction actually happened and matches the claim.
 */
async function verifyRaffleOnChain(taskId, wallet_address, message) {
    // 1. Verification for Raffle Ticket Purchase
    if (taskId.startsWith('raffle_buy_')) {
        const parts = taskId.split('_');
        const txHash = parts[parts.length - 1];
        if (!txHash || !txHash.startsWith('0x')) throw new Error('Missing transaction hash in task ID');

        const amountMatch = message.match(/Amount:\s*(\d+)/i);
        const expectedAmount = amountMatch ? parseInt(amountMatch[1], 10) : 0;
        if (expectedAmount <= 0) throw new Error('Invalid amount in message');

        try {
            const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
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
        } catch (err) {
            console.error('[verifyRaffleOnChain] Purchase verification failed:', err.message);
            throw new Error(`Blockchain verification failed: ${err.message}`);
        }
    }

    // 2. Verification for Raffle Winner
    if (taskId.startsWith('raffle_win_')) {
        const raffleId = taskId.split('_')[2]; // raffle_win_{id}
        if (!raffleId) throw new Error('Missing raffle ID in task ID');

        try {
            // Check RaffleWinner events in the contract for this raffleId
            const logs = await publicClient.getLogs({
                address: process.env.VITE_RAFFLE_ADDRESS_SEPOLIA, // Fallback to env
                event: RAFFLE_EVENT_ABI[1],
                args: { raffleId: BigInt(raffleId) },
                fromBlock: 'earliest'
            });

            const isWinner = logs.some(log => log.args.winner.toLowerCase() === wallet_address.toLowerCase());
            if (!isWinner) throw new Error(`User ${wallet_address} is not a winner of Raffle #${raffleId}`);
            
            return true;
        } catch (err) {
            console.error('[verifyRaffleOnChain] Win verification failed:', err.message);
            throw new Error(`Winner verification failed: ${err.message}`);
        }
    }

    return true; // Not a raffle task
}

async function validateAndCalculateXP(wallet_address, signature, message, task_id) {
    const valid = await verifyMessage({ address: wallet_address, message, signature });
    if (!valid) throw new Error('Invalid signature');

    // [Hardening v3.55.0] On-chain verification for Raffle activities
    if (task_id && task_id.startsWith('raffle_')) {
        // [Hardening v3.56.7] Message Integrity Check
        const parts = task_id.split('_');
        const raffleId = parts[2];
        if (!message.includes(`Raffle ID: ${raffleId}`)) {
            throw new Error(`[Security] Message mismatch. Expected Raffle ID: ${raffleId}`);
        }
        await verifyRaffleOnChain(task_id, wallet_address, message);
    } else if (task_id) {
        // [Hardening v3.56.7] Social Task Message Integrity Check
        if (!message.includes(`ID: ${task_id}`)) {
            throw new Error(`[Security] Message mismatch. Expected Task ID: ${task_id}`);
        }
    }

    let xp = await getTaskReward(task_id);
    // [Refactor v3.41.2] Scaling is now handled via database RPC fn_increment_xp 
    // to ensure Global & Individual multipliers are calculated atomically.


    if (task_id && task_id.startsWith('raffle_buy_')) {
        const amountMatch = message.match(/Amount:\s*(\d+)/i);
        if (amountMatch && amountMatch[1]) {
            const amount = parseInt(amountMatch[1], 10);
            if (amount > 0) xp = xp * amount;
        }
    }

    let targetId = null;
    if (task_id && task_id.startsWith('raffle_')) {
        targetId = task_id.split('_').pop();
    } else {
        const { data: task } = await supabaseAdmin.from('daily_tasks').select('target_id').eq('id', task_id).maybeSingle();
        targetId = task?.target_id;
    }

    // [FIX] Anti-Cheat: Check if this user has already claimed THIS target_id
    if (targetId) {
        const { count } = await supabaseAdmin
            .from('user_task_claims')
            .select('id', { count: 'exact', head: true })
            .eq('wallet_address', wallet_address.toLowerCase())
            .eq('target_id', targetId);
        if (count > 0) throw new Error('[Security] Target account already claimed by this user');
    }

    // [Hardening v3.51.2] Removed strict throw to prevent State Lockout.
    // Database UNIQUE constraint in handleClaim will handle the 'already claimed' state
    // and return a proper response that allows the UI to sync and hide the task.
    return { xp, targetId };
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

// -----------------------------------------------------------------------------
// FEATURE FLAGS & PHASED ROLLOUT (MAINNET SAFEGUARD)
// -----------------------------------------------------------------------------

async function checkFeatureGuard(featureKey, res) {
    if (!isMainnet) return true; // Bypass restriction if still on Sepolia Testnet
    
    try {
        const { data } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'active_features')
            .maybeSingle();
        
        const activeFeatures = data?.value || {};
        if (activeFeatures[featureKey] !== true) {
            console.warn(`[Feature Guard] BLOCKED: Attempt to access disabled feature '${featureKey}' on Mainnet.`);
            res.status(403).json({ error: `Feature [${featureKey}] is currently disabled for Phased Rollout. Please wait for the next phase.` });
            return false;
        }
        return true; 
    } catch (e) {
        console.error(`[Feature Guard] Failed to verify ${featureKey}`, e.message);
        res.status(500).json({ error: "Feature Guard verification failed" });
        return false;
    }
}

// ── HANDLERS ──

export default async function handler(req, res) {
    const action = req.body?.action || req.query?.action;
    
    // Feature guards for Task Actions
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
    } catch (error) {
        console.error(`[API Handler Error] Action: ${action}`, error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleClaim(req, res) {
    const { wallet_address, signature, message, task_id } = req.body;
    const { xp, targetId } = await validateAndCalculateXP(wallet_address, signature, message, task_id);

    const { error } = await supabaseAdmin.from('user_task_claims').insert({
        wallet_address: wallet_address.toLowerCase(),
        task_id,
        xp_earned: xp,
        target_id: targetId
    });

    if (error) {
        if (error.code === '23505') {
            // Duplicate claim detected. Race conditions during spam clicking 
            // should safely return already_claimed without attempting to grant XP again.
            return res.status(200).json({ success: true, message: "Already claimed.", already_claimed: true });
        }
        throw error;
    }

    // FIX v3.40.6: Atomically update total_xp in user_profiles
    if (xp > 0) {
        const { error: xpErr } = await supabaseAdmin.rpc('fn_increment_xp', {
            p_wallet: wallet_address.toLowerCase(),
            p_amount: xp
        });
        if (xpErr) {
            console.error('[handleClaim] fn_increment_xp failed:', xpErr.message);
            return res.status(500).json({ error: "Failed to update XP. Please try again." });
        }
    }

    if (task_id && task_id.startsWith('raffle_buy_')) {
        const ticketAmount = message.match(/Amount:\s*(\d+)/i)?.[1];
        const ticketCount = ticketAmount ? parseInt(ticketAmount, 10) : 1;
        await supabaseAdmin.rpc('fn_increment_raffle_tickets', {
            p_wallet: wallet_address.toLowerCase(),
            p_amount: ticketCount
        });

        await logActivity({
            wallet: wallet_address,
            category: 'PURCHASE',
            type: 'Raffle Ticket Buy',
            description: `Purchased ${ticketCount} Tickets for Raffle`,
            amount: xp,
            symbol: 'XP',
            metadata: { task_id, tickets_bought: ticketCount }
        });
    } else {
        await logActivity({
            wallet: wallet_address,
            category: 'XP',
            type: 'Task Claim',
            description: `Claimed ${xp} XP for ${task_id}`,
            amount: xp,
            symbol: 'XP',
            metadata: { task_id }
        });
    }

    return res.status(200).json({ success: true, xp });
}

async function handleVerify(req, res) {
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
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

    // FIX v3.40.6: Atomically update total_xp in user_profiles
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
        
        const { error: ticketErr } = await supabaseAdmin.rpc('fn_increment_raffle_tickets', {
            p_wallet: wallet_address.toLowerCase(),
            p_amount: ticketCount
        });
        
        if (ticketErr) {
            console.error('[handleVerify] fn_increment_raffle_tickets failed:', ticketErr.message);
            // We don't return error here because XP was already added, but we log it
        }

        await logActivity({
            wallet: wallet_address,
            category: 'PURCHASE',
            type: 'Raffle Ticket Buy',
            description: `Purchased ${ticketCount} Tickets for Raffle`,
            amount: xp,
            symbol: 'XP',
            metadata: { task_id, tickets_bought: ticketCount }
        });
    } else {
        await logActivity({
            wallet: wallet_address,
            category: 'XP',
            type: 'Task Verify',
            description: `Verified ${task_id} on ${platform}`,
            amount: xp,
            symbol: 'XP',
            metadata: { task_id, platform, action_type }
        });
    }

    return res.status(200).json({ success: true, xp });
}

async function handleSocialVerify(req, res) {
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
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

    // FIX v3.40.6: Atomically update total_xp in user_profiles
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

    await logActivity({
        wallet: wallet_address,
        category: 'XP',
        type: 'Social Verify',
        description: `Verified ${action_type} on ${platform}`,
        amount: xp,
        symbol: 'XP',
        metadata: { task_id, platform, action_type }
    });

    return res.status(200).json({ success: true, xp, message: `Task verified.` });
}

/**
 * 🏆 ALL-OR-NOTHING UGC CAMPAIGN CLAIM
 * Validates all sub-tasks are verified for a campaign, then grants total XP + USDC reward.
 */
async function handleClaimUgcCampaign(req, res) {
    const { wallet_address, signature, message, campaign_id } = req.body;

    if (!wallet_address || !signature || !message || !campaign_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const valid = await verifyMessage({ address: wallet_address, message, signature });
    if (!valid) return res.status(401).json({ error: 'Invalid signature' });

    try {
        // 1. Fetch all sub-tasks for this campaign
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

        // 2. Check if already claimed this campaign
        const { data: existingClaim } = await supabaseAdmin
            .from('user_task_claims')
            .select('id')
            .eq('wallet_address', wallet_address.toLowerCase())
            .eq('task_id', `ugc_campaign_${campaign_id}`)
            .maybeSingle();

        if (existingClaim) {
            return res.status(200).json({ success: true, already_claimed: true, message: 'Campaign reward already claimed.' });
        }

        // 3. Verify user has completed ALL sub-tasks
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

        // 4. Calculate total XP from all sub-tasks dynamically
        let totalXp = 0;
        for (const task of subTasks) {
            const dynamicKey = `${task.platform}_${task.action_type}`.toLowerCase();
            const xpVal = await getPointValue(dynamicKey);
            totalXp += xpVal > 0 ? xpVal : (task.xp_reward || 0);
        }
        // Add UGC campaign completion bonus
        const ugcBonus = await getPointValue('ugc_task_completion');
        totalXp += ugcBonus;

        // 5. Fetch campaign for USDC reward amount
        const { data: campaign } = await supabaseAdmin
            .from('campaigns')
            .select('reward_amount_per_user, reward_symbol, title')
            .eq('id', campaign_id)
            .maybeSingle();

        // 6. Insert master campaign claim record (prevents double claim)
        await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet_address.toLowerCase(),
            task_id: `ugc_campaign_${campaign_id}`,
            xp_earned: totalXp,
            platform: 'ugc',
            action_type: 'campaign_complete'
        });

        // 7. Grant XP atomically
        if (totalXp > 0) {
            const { error: xpErr } = await supabaseAdmin.rpc('fn_increment_xp', {
                p_wallet: wallet_address.toLowerCase(),
                p_amount: totalXp
            });
            if (xpErr) console.error('[handleClaimUgcCampaign] fn_increment_xp failed:', xpErr.message);
        }

        // 8. Log activity
        await logActivity({
            wallet: wallet_address,
            category: 'XP',
            type: 'UGC Campaign Complete',
            description: `Completed UGC Campaign: ${campaign?.title || campaign_id}`,
            amount: totalXp,
            symbol: 'XP',
            metadata: { campaign_id, sub_task_count: subTasks.length, usdc_reward: campaign?.reward_amount_per_user }
        });

        return res.status(200).json({
            success: true,
            xp: totalXp,
            usdc_reward: campaign?.reward_amount_per_user || '0',
            reward_symbol: campaign?.reward_symbol || 'USDC',
            message: 'Campaign reward claimed successfully!'
        });
    } catch (err) {
        console.error('[handleClaimUgcCampaign]', err);
        return res.status(500).json({ error: err.message });
    }
}
