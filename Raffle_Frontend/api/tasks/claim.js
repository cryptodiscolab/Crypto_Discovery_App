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
        const { wallet_address, signature, message, task_id } = req.body;

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
            return res.status(401).json({ error: 'Invalid signature! Unauthorized access attempt.' });
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
        // Note: Claim message format might vary, checking for 'Task ID:' or 'ID:'
        const idMatch = message.match(/(?:Task ID|ID):\s*(.+)$/m);
        if (idMatch && idMatch[1] !== String(task_id)) {
            return res.status(400).json({ error: 'Task ID mismatch in signature' });
        }

        const cleanAddress = wallet_address.toLowerCase();

        // 4. Secure Reward Lookup: Get XP from DB
        const { data: taskData, error: taskError } = await supabaseAdmin
            .from('daily_tasks')
            .select('xp_reward')
            .eq('id', task_id)
            .single();

        if (taskError || !taskData) {
            return res.status(404).json({ error: 'Task not found in system' });
        }

        const actualXPReward = taskData.xp_reward || 0;

        // 5. Profile Check/Upsert (Bypass RLS)
        await supabaseAdmin
            .from('user_profiles')
            .upsert({ wallet_address: cleanAddress }, { onConflict: 'wallet_address' });

        // 6. Insert Completion — canonical table (same as tasks/verify.js)
        // BUG-6 fix: was writing to user_task_claims, now unified to user_task_completions
        const { error: claimError } = await supabaseAdmin
            .from('user_task_completions')
            .insert({
                user_address: cleanAddress,
                task_id: task_id,
                platform: 'claim',
                action_type: 'task',
                points_awarded: actualXPReward
            });

        if (claimError) {
            if (claimError.code === '23505') {
                return res.status(409).json({ error: 'You already claimed this task today' });
            }
            throw claimError;
        }

        // 7. Atomic XP increment (consistent with verify.js)
        await supabaseAdmin.rpc('fn_increment_user_xp', {
            p_wallet: cleanAddress,
            p_xp: actualXPReward
        });

        // 7. Log Audit (Non-blocking: don't crash if audit table fails)
        supabaseAdmin.from('admin_audit_logs').insert([{
            admin_address: 'SYSTEM_CLAIMER',
            action: 'TASK_CLAIMED',
            details: {
                user: cleanAddress,
                task_id: task_id,
                xp_reward: actualXPReward,
                timestamp: new Date().toISOString()
            }
        }]).catch(err => {
            console.warn('[API] Audit logging failed (table might be missing):', err.message);
        });

        return res.status(200).json({
            success: true,
            message: `Claim successful! +${actualXPReward} XP awarded.`
        });

    } catch (error) {
        console.error('[API] Task Claim Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
