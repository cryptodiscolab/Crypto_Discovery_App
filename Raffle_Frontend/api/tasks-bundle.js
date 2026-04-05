import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabaseAdmin = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

// 1. DYNAMIC NETWORK SWITCHER (MAINNET SECURE)
const CHAIN_ID = (process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '84532').trim();
const isMainnet = CHAIN_ID === '8453';


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
    if (taskId?.startsWith('raffle_draw_')) return await getPointValue('raffle_ticket');
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

async function validateAndCalculateXP(wallet_address, signature, message, task_id) {
    const valid = await verifyMessage({ address: wallet_address, message, signature });
    if (!valid) throw new Error('Invalid signature');

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

    if (targetId) {
        const { count } = await supabaseAdmin
            .from('user_task_claims')
            .select('id', { count: 'exact', head: true })
            .eq('target_id', targetId);
        if (count > 0) throw new Error('[Security] Target account already claimed');
    }

    // [Hardening v3.40.12] Global Uniqueness Check
    // Ensuring user cannot claim the SAME task ID twice ever, unless a new task is created.
    const { count: globalClaimCount } = await supabaseAdmin
        .from('user_task_claims')
        .select('id', { count: 'exact', head: true })
        .eq('wallet_address', wallet_address.toLowerCase())
        .eq('task_id', task_id);
    
    if (globalClaimCount > 0) throw new Error('Task already completed. Look for new missions!');

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
            return res.status(200).json({ success: true, message: "Already claimed.", already_claimed: true });
        }
        throw error;
    }

    // FIX v3.40.6: Atomically update total_xp in user_profiles for off-chain tasks
    // (On-chain tasks use the 'xp' action in user-bundle which reads contract state)
    if (xp > 0) {
        try {
            await supabaseAdmin.rpc('fn_increment_xp', {
                p_wallet: wallet_address.toLowerCase(),
                p_amount: xp
            });
        } catch (xpErr) {
            console.error('[handleClaim] fn_increment_xp failed:', xpErr.message);
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
            description: `Claimed ${xp} XP for ${task_id}`,
            amount: xp,
            symbol: 'XP'
        });
    } else {
        await logActivity({
            wallet: wallet_address,
            category: 'XP',
            type: 'Task Claim',
            description: `Claimed ${xp} XP for ${task_id}`,
            amount: xp,
            symbol: 'XP'
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

    // [Fix v3.41.2 Hardening] Award XP atomically using the Hybrid Formula
    if (xp > 0) {
        try {
            await supabaseAdmin.rpc('fn_increment_xp', {
                p_wallet: wallet_address.toLowerCase(),
                p_amount: xp
            });
        } catch (xpErr) {
            console.error('[handleVerify] fn_increment_xp failed:', xpErr.message);
        }
    }

    await logActivity({
        wallet: wallet_address,
        category: 'XP',
        type: 'Task Verify',
        description: `Verified ${task_id} on ${platform}`,
        amount: xp,
        symbol: 'XP'
    });

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
        if (error.code === '23505') return res.status(200).json({ success: true, message: "Already recorded." });
        throw error;
    }

    // FIX v3.40.6: Atomically update total_xp in user_profiles for off-chain tasks
    if (xp > 0) {
        try {
            await supabaseAdmin.rpc('fn_increment_xp', {
                p_wallet: wallet_address.toLowerCase(),
                p_amount: xp
            });
        } catch (xpErr) {
            console.error('[handleSocialVerify] fn_increment_xp failed:', xpErr.message);
        }
    }

    await logActivity({
        wallet: wallet_address,
        category: 'XP',
        type: 'Social Verify',
        description: `Verified ${action_type} on ${platform}`,
        amount: xp,
        symbol: 'XP'
    });

    return res.status(200).json({ success: true, xp, message: `Task verified.` });
}
