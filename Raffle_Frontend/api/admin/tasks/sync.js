import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MASTER_ADMIN = '0x08452b1bdaa6acd11f6ccf5268d16e2ac29c204b';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { wallet_address, signature, message, tasks, tx_hash } = req.body;

        if (!wallet_address || !signature || !message || !tasks || !tx_hash) {
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

        const cleanAddress = wallet_address.toLowerCase();

        // 2. Admin Check
        let isAuthorized = cleanAddress === MASTER_ADMIN.toLowerCase();

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

        // 3. Sync Tasks & Logs
        for (const task of tasks) {
            // Sync to 'tasks' table
            await supabaseAdmin.from('tasks').insert([{
                ...task,
                transaction_hash: tx_hash,
                is_active: true,
                created_at: new Date().toISOString()
            }]);

            // Audit Log
            await supabaseAdmin.from('admin_audit_logs').insert([{
                admin_address: cleanAddress,
                action: 'DEPLOY_BATCH_TASK',
                details: {
                    task_name: task.title,
                    points: task.reward_points,
                    platform: task.platform,
                    action_type: task.action_type,
                    tx_hash: tx_hash
                }
            }]);
        }

        return res.status(200).json({ success: true, synced: tasks.length });

    } catch (error) {
        console.error('[API] Task Sync Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
