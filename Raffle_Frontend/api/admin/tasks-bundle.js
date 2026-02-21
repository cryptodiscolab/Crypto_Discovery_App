import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AUTHORIZED_ADMINS = [
    '0x08452b1bdaa6acd11f6ccf5268d16e2ac29c204b',
    '0x455DF75735d2a18c26f0AfDefa93217B60369fe5'
].map(a => a.toLowerCase());

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Action-based routing from body or query
    const action = req.body.action || req.query.action;

    try {
        const { wallet_address, signature, message } = req.body;

        if (!wallet_address || !signature || !message) {
            return res.status(400).json({ error: 'Missing required auth fields' });
        }

        // 1. Verify Signature
        const valid = await verifyMessage({
            address: wallet_address,
            message: message,
            signature: signature,
        });

        if (!valid) return res.status(401).json({ error: 'Invalid signature!' });

        // 2. Replay Protection: 5-minute window
        const timeMatch = message.match(/Time:\s*(.+)$/m);
        if (!timeMatch) return res.status(400).json({ error: 'Message missing timestamp' });
        const msgTime = new Date(timeMatch[1]).getTime();
        if (isNaN(msgTime) || Math.abs(Date.now() - msgTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: 'Signature expired' });
        }

        const cleanAddress = wallet_address.toLowerCase();

        // 3. Admin Authorization
        let isAuthorized = AUTHORIZED_ADMINS.includes(cleanAddress);
        if (!isAuthorized) {
            const { data: profile } = await supabaseAdmin
                .from('user_profiles')
                .select('is_admin')
                .eq('wallet_address', cleanAddress)
                .single();
            if (profile?.is_admin) isAuthorized = true;
        }

        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized: Admin only' });

        // 4. Action Routing
        switch (action) {
            case 'create': {
                const { task_data } = req.body;
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
            }

            case 'CLEAR_ALL': // Match what frontend sends
            case 'cleanup': {
                const { error } = await supabaseAdmin
                    .from('daily_tasks')
                    .delete()
                    .neq('id', 0);
                if (error) throw error;

                await supabaseAdmin.from('admin_audit_logs').insert({
                    admin_address: cleanAddress,
                    action: 'CLEAR_ALL_DAILY_TASKS',
                    details: 'Admin cleared all daily tasks'
                });
                return res.status(200).json({ success: true });
            }

            case 'sync': {
                const { tasks, tx_hash } = req.body;
                if (!tasks || !tx_hash) throw new Error("Missing sync data");

                for (const task of tasks) {
                    await supabaseAdmin.from('tasks').insert([{
                        ...task,
                        transaction_hash: tx_hash,
                        is_active: true,
                        created_at: new Date().toISOString()
                    }]);

                    await supabaseAdmin.from('admin_audit_logs').insert([{
                        admin_address: cleanAddress,
                        action: 'DEPLOY_BATCH_TASK',
                        details: { ...task, tx_hash }
                    }]);
                }
                return res.status(200).json({ success: true, synced: tasks.length });
            }

            default:
                return res.status(400).json({ error: 'Invalid action: ' + action });
        }

    } catch (error) {
        console.error(`[API] Task Bundle Error (${action}):`, error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
