import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabaseAdmin = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

// 🛡️ REFACTORED HELPERS 🛡️

async function getPointValue(activityKey) {
    try {
        const { data, error } = await supabaseAdmin
            .from('point_settings')
            .select('points_value')
            .eq('activity_key', activityKey)
            .eq('is_active', true)
            .single();
        if (error || !data) return 0;
        return data.points_value || 0;
    } catch (e) {
        console.error(`[PointLookup Error] Key: ${activityKey}`, e);
        return 0;
    }
}

async function getUserMultiplier(walletAddress) {
    try {
        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('tier')
            .eq('wallet_address', walletAddress.toLowerCase())
            .single();
        const tier = profile?.tier || 0;
        if (tier === 0) return 10000;
        const { data: multiplierSetting } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'tier_multipliers')
            .single();
        const multipliers = multiplierSetting?.value || {};
        return parseInt(multipliers[tier]) || 10000;
    } catch (e) {
        return 10000;
    }
}

async function getTaskReward(taskId) {
    if (taskId?.startsWith('raffle_buy_')) return await getPointValue('raffle_buy');
    if (taskId?.startsWith('raffle_win_')) return await getPointValue('raffle_win');
    if (taskId?.startsWith('raffle_draw_')) return await getPointValue('raffle_ticket');
    try {
        const { data: task } = await supabaseAdmin
            .from('daily_tasks')
            .select('xp_reward, platform, action_type')
            .eq('id', taskId)
            .single();
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
    const multiplier = await getUserMultiplier(wallet_address);
    xp = Math.floor((xp * multiplier) / 10000);

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
        const { data: task } = await supabaseAdmin.from('daily_tasks').select('target_id').eq('id', task_id).single();
        targetId = task?.target_id;
    }

    if (targetId) {
        const { count } = await supabaseAdmin
            .from('user_task_claims')
            .select('id', { count: 'exact', head: true })
            .eq('target_id', targetId);
        if (count > 0) throw new Error('[Security] Target account already claimed');
    }

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

// ── HANDLERS ──

export default async function handler(req, res) {
    const action = req.body?.action || req.query?.action;
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
    if (error) throw error;

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
    if (error) throw error;

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

    await logActivity({
        wallet: wallet_address,
        category: 'XP',
        type: 'Social Verify',
        description: `Verified ${action_type} on ${platform}`,
        amount: xp,
        symbol: 'XP'
    });

    return res.status(200).json({ success: true, message: `Task verified.` });
}
