import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AUTHORIZED_ADMINS = [
    '0x08452b1bdaa6acd11f6ccf5268d16e2ac29c204b',
    '0x455DF75735d2a18c26f0AfDefa93217B60369fe5'
].map(a => a.toLowerCase());

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { wallet_address, signature, message, task_data } = req.body;

        if (!wallet_address || !signature || !message || !task_data) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Verify Signature
        const valid = await verifyMessage({
            address: wallet_address,
            message: message,
            signature: signature,
        });

        if (!valid) {
            return res.status(401).json({ error: 'Invalid signature!' });
        }

        // 2. Replay protection: 5-minute timestamp window
        const timeMatch = message.match(/Time:\s*(.+)$/m);
        if (!timeMatch) return res.status(400).json({ error: 'Message missing timestamp' });

        const msgTime = new Date(timeMatch[1]).getTime();
        if (isNaN(msgTime) || Math.abs(Date.now() - msgTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: 'Signature expired' });
        }

        const cleanAddress = wallet_address.toLowerCase();

        // 3. Admin check
        let isAuthorized = AUTHORIZED_ADMINS.includes(cleanAddress);

        if (!isAuthorized) {
            const { data: profile } = await supabaseAdmin
                .from('user_profiles')
                .select('is_admin')
                .eq('wallet_address', cleanAddress)
                .single();

            if (profile?.is_admin) isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized: Admin only' });
        }

        // 3. Create Task
        const { data, error } = await supabaseAdmin
            .from('daily_tasks')
            .insert({
                description: task_data.description,
                xp_reward: task_data.xp_reward,
                expires_at: task_data.expires_at || null,
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, data });

    } catch (error) {
        console.error('[API] Task Create Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
