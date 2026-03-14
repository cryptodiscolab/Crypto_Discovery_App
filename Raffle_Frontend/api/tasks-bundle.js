import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabaseAdmin = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

/**
 * 🛡️ Lurah Protocol: Centralized Point Lookup
 * Mandatory dynamic fetching for Zero-Hardcode compliance.
 */
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
        if (tier === 0) return 10000; // 1x

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
    // 1. Check for specific point_settings keys first
    if (taskId?.startsWith('raffle_buy_')) return await getPointValue('raffle_buy');
    if (taskId?.startsWith('raffle_win_')) return await getPointValue('raffle_win');
    if (taskId?.startsWith('raffle_draw_')) return await getPointValue('raffle_ticket'); // Unified key

    // 2. Fetch from daily_tasks table
    try {
        const { data: task } = await supabaseAdmin
            .from('daily_tasks')
            .select('xp_reward, platform, action_type')
            .eq('id', taskId)
            .single();

        if (!task) return 0;

        // 3. 🛡️ Dynamic Priority: Check if point_settings has a dynamic rule for this task type
        // This allows global management of rewards across all similar tasks
        const dynamicKey = `${task.platform}_${task.action_type}`.toLowerCase().replace(/\s+/g, '_');
        const dynamicValue = await getPointValue(dynamicKey);

        // If a dynamic rule exists, it OVERRIDES the static xp_reward in the task record
        return dynamicValue > 0 ? dynamicValue : (task.xp_reward || 0);
    } catch (e) {
        return 0;
    }
}

export default async function handler(req, res) {
    const action = req.body?.action || req.query?.action;

    switch (action) {
        case 'claim':
            return handleClaim(req, res);
        case 'verify':
            return handleVerify(req, res);
        case 'social-verify':
            return handleSocialVerify(req, res);
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

async function handleClaim(req, res) {
    const { wallet_address, signature, message, task_id } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        let xp = await getTaskReward(task_id);

        // 🛡️ Apply Tier Multiplier
        const multiplier = await getUserMultiplier(wallet_address);
        xp = Math.floor((xp * multiplier) / 10000);

        // 🛡️ Dynamic Multiplier for Raffle Tickets
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

        // Anti-Cheat: Check for target duplication
        if (targetId) {
            const { count } = await supabaseAdmin
                .from('user_task_claims')
                .select('id', { count: 'exact', head: true })
                .eq('wallet_address', wallet_address.toLowerCase())
                .eq('target_id', targetId);
            if (count > 0) return res.status(401).json({ error: '[Security] Target account already claimed' });
        }

        const { error } = await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet_address.toLowerCase(),
            task_id,
            xp_earned: xp,
            target_id: targetId
        });

        if (error) throw error;

        // Increment raffle tickets counter if it's a ticket purchase
        if (task_id.startsWith('raffle_buy_')) {
            const ticketAmount = message.match(/Amount:\s*(\d+)/i)?.[1];
            const ticketCount = ticketAmount ? parseInt(ticketAmount, 10) : 1;
            await supabaseAdmin.rpc('fn_increment_raffle_tickets', {
                p_wallet: wallet_address.toLowerCase(),
                p_amount: ticketCount
            });
        }

        // Log Activity
        let category = 'XP';
        let type = 'Task Claim';
        if (task_id.startsWith('raffle_buy_')) {
            category = 'PURCHASE';
            type = 'Raffle Ticket Buy';
        } else if (task_id.startsWith('raffle_win_')) {
            category = 'REWARD';
            type = 'NFT Raffle Win';
        }

        await logActivity({
            wallet: wallet_address,
            category,
            type,
            description: `Claimed ${xp} XP for ${task_id}`,
            amount: xp,
            symbol: 'XP'
        });

        return res.status(200).json({ success: true, xp });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}


async function handleVerify(req, res) {
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        let xp = await getTaskReward(task_id);

        // 🛡️ Apply Tier Multiplier
        const multiplier = await getUserMultiplier(wallet_address);
        xp = Math.floor((xp * multiplier) / 10000);

        // 🛡️ Dynamic Multiplier for Raffle Tickets
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

        // Anti-Cheat: Check for target duplication
        if (targetId) {
            const { count } = await supabaseAdmin
                .from('user_task_claims')
                .select('id', { count: 'exact', head: true })
                .eq('wallet_address', wallet_address.toLowerCase())
                .eq('target_id', targetId);
            if (count > 0) return res.status(401).json({ error: '[Security] Target account already claimed' });
        }

        const { error } = await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet_address.toLowerCase(),
            task_id,
            platform,
            action_type,
            xp_earned: xp,
            target_id: targetId
        });

        if (error) throw error;

        // Log Activity
        let category = 'XP';
        let type = 'Task Verify';
        if (task_id.startsWith('raffle_buy_')) {
            category = 'PURCHASE';
            type = 'Raffle Ticket Buy';
        } else if (task_id.startsWith('raffle_win_')) {
            category = 'REWARD';
            type = 'NFT Raffle Win';
        }

        await logActivity({
            wallet: wallet_address,
            category,
            type,
            description: `Verified ${task_id} on ${platform}`,
            amount: xp,
            symbol: 'XP'
        });

        return res.status(200).json({ success: true, xp });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleSocialVerify(req, res) {
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        let xp = await getTaskReward(task_id);

        // 🛡️ Apply Tier Multiplier
        const multiplier = await getUserMultiplier(wallet_address);
        xp = Math.floor((xp * multiplier) / 10000);

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
                .eq('wallet_address', wallet_address.toLowerCase())
                .eq('target_id', targetId);
            if (count > 0) return res.status(401).json({ error: '[Security] Target account already claimed' });
        }

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
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
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
