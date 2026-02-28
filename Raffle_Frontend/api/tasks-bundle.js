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

        const { data: task } = await supabaseAdmin.from('daily_tasks').select('xp_reward').eq('id', task_id).single();
        const xp = task?.xp_reward || 0;

        const { error } = await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet_address.toLowerCase(),
            task_id,
            xp_earned: xp
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

        const { data: task } = await supabaseAdmin.from('daily_tasks').select('xp_reward').eq('id', task_id).single();
        const xp = task?.xp_reward || 0;

        const { error } = await supabaseAdmin.from('user_task_claims').insert({
            wallet_address: wallet_address.toLowerCase(),
            task_id,
            platform,
            action_type,
            xp_earned: xp
        });

        if (error) throw error;
        return res.status(200).json({ success: true, xp });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleSocialVerify(req, res) {
    // Logic from verify-action/route.js
    const { wallet, payload } = req.body;
    // ... logic ...
    return res.status(200).json({ success: true });
}
