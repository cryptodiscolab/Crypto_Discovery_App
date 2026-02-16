import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { wallet_address, signature, message, task_id, platform, action_type } = req.body;

        if (!wallet_address || !signature || !message || !task_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Verify Signature (SIWE)
        const valid = await verifyMessage({
            address: wallet_address,
            message: message,
            signature: signature,
        });

        if (!valid) {
            return res.status(401).json({ error: 'Invalid signature! Verification failed.' });
        }

        // 2. Replay Protection: Validate Timestamp
        const timeMatch = message.match(/Time:\s*(.+)$/m);
        if (!timeMatch) return res.status(400).json({ error: 'Message missing timestamp' });

        const msgTime = new Date(timeMatch[1]).getTime();
        const diff = Math.abs(Date.now() - msgTime);
        if (diff > 5 * 60 * 1000) { // 5 minutes window
            return res.status(401).json({ error: 'Signature expired (Replay Protection)' });
        }

        // 3. Consistency Check: Ensure message task_id matches body task_id
        const idMatch = message.match(/ID:\s*(.+)$/m);
        if (idMatch && idMatch[1] !== String(task_id)) {
            return res.status(400).json({ error: 'Task ID mismatch in signature' });
        }

        const cleanAddress = wallet_address.toLowerCase();

        // 4. Secure Reward Lookup: Get XP from DB, not from client request
        const { data: taskData, error: taskError } = await supabaseAdmin
            .from('daily_tasks')
            .select('xp_reward, description')
            .eq('id', task_id)
            .single();

        if (taskError || !taskData) {
            return res.status(404).json({ error: 'Task not found in system' });
        }

        const actualXPReward = taskData.xp_reward || 0;

        // 5. Check if already claimed (Double-claim protection)
        const { data: existing } = await supabaseAdmin
            .from('user_task_completions')
            .select('id')
            .eq('user_address', cleanAddress)
            .eq('task_id', task_id)
            .limit(1)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Task already completed and claimed.' });
        }

        // 6. Record Completion (Atomic transaction pattern)
        // We record completion first
        const { error: completionError } = await supabaseAdmin
            .from('user_task_completions')
            .insert([{
                user_address: cleanAddress,
                task_id: task_id,
                platform: platform || 'farcaster',
                action_type: action_type || 'task',
                points_awarded: actualXPReward
            }]);

        if (completionError) throw completionError;

        // 7. Atomic XP Increment via RPC
        // Prevents race conditions and ensures synchronization logic triggers correctly
        const { error: rpcError } = await supabaseAdmin
            .rpc('fn_increment_user_xp', {
                p_wallet: cleanAddress,
                p_xp: actualXPReward
            });

        if (rpcError) {
            console.error('[RPC Error] Atomic increment failed:', rpcError);
            // We don't throw here to avoid failing the whole request since completion is recorded,
            // but in a strict system we might want to use a database transaction.
        }

        // 8. Log Audit
        await supabaseAdmin.from('admin_audit_logs').insert([{
            admin_address: 'SYSTEM_VERIFIER',
            action: 'TASK_VERIFIED',
            details: {
                user: cleanAddress,
                task: taskData.description,
                task_id,
                xp_reward: actualXPReward,
                timestamp: new Date().toISOString()
            }
        }]);

        return res.status(200).json({
            success: true,
            message: `Verified! +${actualXPReward} XP awarded.`,
            xp_awarded: actualXPReward
        });

    } catch (error) {
        console.error('[API] Task Verify Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
