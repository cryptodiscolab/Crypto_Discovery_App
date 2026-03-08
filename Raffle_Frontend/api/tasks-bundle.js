import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const action = req.body?.action || req.query?.action;

    switch (action) {
        case 'claim':
            return handleClaim(req, res);
        case 'verify':
            return handleVerify(req, res);
        case 'social-verify':
            // Logic from verify-action/route.js (claim_task)
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

        let xp = 0;
        let targetId = null;

        if (task_id && task_id.startsWith('raffle_buy_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_buy').single();
            xp = setting?.points_value || 500;
            targetId = task_id.replace('raffle_buy_', '');
        } else if (task_id && task_id.startsWith('raffle_win_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_win').single();
            xp = setting?.points_value || 1000;
            targetId = task_id.replace('raffle_win_', '');
        } else if (task_id && task_id.startsWith('raffle_draw_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_draw').single();
            xp = setting?.points_value || 200;
            targetId = task_id.replace('raffle_draw_', '');
        } else {
            const { data: task } = await supabaseAdmin.from('daily_tasks').select('xp_reward, target_id').eq('id', task_id).single();
            xp = task?.xp_reward || 0;
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
        return res.status(200).json({ success: true, xp });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleVerify(req, res) {
    // Same as claim but with platform/action_type
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        let xp = 0;
        let targetId = null;

        if (task_id && task_id.startsWith('raffle_buy_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_buy').single();
            xp = setting?.points_value || 500;
            targetId = task_id.replace('raffle_buy_', '');
        } else if (task_id && task_id.startsWith('raffle_win_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_win').single();
            xp = setting?.points_value || 1000;
            targetId = task_id.replace('raffle_win_', '');
        } else if (task_id && task_id.startsWith('raffle_draw_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_draw').single();
            xp = setting?.points_value || 200;
            targetId = task_id.replace('raffle_draw_', '');
        } else {
            const { data: task } = await supabaseAdmin.from('daily_tasks').select('xp_reward, target_id').eq('id', task_id).single();
            xp = task?.xp_reward || 0;
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
        return res.status(200).json({ success: true, xp });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleSocialVerify(req, res) {
    const { wallet_address, signature, message, task_id, platform, action_type } = req.body;
    try {
        // 1. Verify Signature
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // 2. Security Check: Fetch authoritative reward from DB
        let xp = 0;
        let targetId = null;

        if (task_id && task_id.startsWith('raffle_buy_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_buy').single();
            xp = setting?.points_value || 500;
            targetId = task_id.replace('raffle_buy_', '');
        } else if (task_id && task_id.startsWith('raffle_win_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_win').single();
            xp = setting?.points_value || 1000;
            targetId = task_id.replace('raffle_win_', '');
        } else if (task_id && task_id.startsWith('raffle_draw_')) {
            const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_draw').single();
            xp = setting?.points_value || 200;
            targetId = task_id.replace('raffle_draw_', '');
        } else {
            const { data: task } = await supabaseAdmin
                .from('daily_tasks')
                .select('xp_reward, target_id')
                .eq('id', task_id)
                .single();
            xp = task?.xp_reward || 0;
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

        // 3. Record Claim (Zero-Trust)
        const { error } = await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet_address.toLowerCase(),
            task_id,
            platform: platform || 'regular',
            action_type: action_type || 'task',
            xp_earned: xp,
            target_id: targetId
        });

        if (error) {
            if (error.code === '23505') { // Duplicate claim
                return res.status(200).json({ success: true, message: "Task already recorded." });
            }
            throw error;
        }

        return res.status(200).json({ success: true, message: `Task ${task_id} verified successfully.` });
    } catch (error) {
        console.error('[SocialVerify API Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
