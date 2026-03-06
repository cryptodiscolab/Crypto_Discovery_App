import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AUTHORIZED_ADMINS = [
    '0x08452c1bdaa6acd11f6ccf5268d16e2ac29c204b',
    '0x455df75735d2a18c26f0afdefa93217b60369fe5'
].map(a => a.toLowerCase());

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Action-based routing from body or query
    const action = req.body.action || req.query.action;

    try {
        const { address, wallet_address, signature, message } = req.body;
        const targetAddress = address || wallet_address;

        if (!targetAddress || !signature || !message) {
            return res.status(400).json({ error: 'Missing required auth fields (address, signature, or message)' });
        }

        // 1. Verify Signature
        const valid = await verifyMessage({
            address: targetAddress,
            message: message,
            signature: signature,
        });

        if (!valid) return res.status(401).json({ error: 'Invalid signature!' });

        // 2. Replay Protection: 5-minute window
        const timeMatch = message.match(/Time:\s*(.+)$/m);
        if (!timeMatch) return res.status(400).json({ error: 'Message missing timestamp' });
        const msgTime = new Date(timeMatch[1]).getTime();
        if (isNaN(msgTime) || Math.abs(Date.now() - msgTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: 'Signature expired (Replay protection)' });
        }

        const cleanAddress = targetAddress.toLowerCase();

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
                        description: task_data.description || task_data.title,
                        xp_reward: task_data.xp_reward || 0,
                        platform: task_data.platform || 'base',
                        action_type: task_data.action_type || 'transaction',
                        link: task_data.link || 'https://warpcast.com/CryptoDisco',
                        min_tier: task_data.min_tier || 1,
                        requires_verification: task_data.requires_verification !== undefined ? task_data.requires_verification : true,
                        is_active: task_data.is_active !== undefined ? task_data.is_active : false,
                        expires_at: task_data.expires_at || null,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }

            case 'CLEAR_ALL': // Match what frontend sends
            case 'cleanup': {
                // Use a valid UUID filter to delete all rows (id is never null)
                const { error } = await supabaseAdmin
                    .from('daily_tasks')
                    .delete()
                    .not('id', 'is', 'null');

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
                    // Map frontend fields (TaskManagerTab.jsx) to DB columns
                    const { data: dbTask, error: dbError } = await supabaseAdmin
                        .from('daily_tasks')
                        .insert([{
                            description: task.title,
                            xp_reward: task.reward_points,
                            platform: task.platform,
                            action_type: task.action_type,
                            link: task.link,
                            min_tier: task.min_tier || 1,
                            requires_verification: task.requires_verification || false,
                            min_neynar_score: task.min_neynar_score || 0,
                            min_followers: task.min_followers || 0,
                            account_age_requirement: task.account_age_requirement || 0,
                            power_badge_required: task.power_badge_required || false,
                            no_spam_filter: task.no_spam_filter || true,
                            is_active: true,
                            created_at: new Date().toISOString()
                        }])
                        .select()
                        .single();

                    if (dbError) throw dbError;

                    // Audit Log Deployment
                    await supabaseAdmin.from('admin_audit_logs').insert([{
                        admin_address: cleanAddress,
                        action: 'DEPLOY_BATCH_TASK',
                        details: {
                            task_id: dbTask.id,
                            title: task.title,
                            platform: task.platform,
                            tx_hash
                        }
                    }]);
                }
                return res.status(200).json({ success: true, synced: tasks.length });
            }

            case 'RESET_SEASON': {
                // CRITICAL: Permanently resets all progress
                // 1. Clear all user completions (Standardized table name)
                const { error: claimErr } = await supabaseAdmin
                    .from('user_task_claims')
                    .delete()
                    .not('id', 'is', 'null');

                if (claimErr) throw claimErr;

                // 2. Reset scores in user_profiles (Canonical columns)
                // We reset BOTH 'xp' and 'total_xp' to ensure harmony across all views
                const { error: profileErr } = await supabaseAdmin
                    .from('user_profiles')
                    .update({
                        xp: 0,
                        total_xp: 0,
                        tier: 1,
                        updated_at: new Date().toISOString()
                    })
                    .not('wallet_address', 'is', 'null');

                if (profileErr) throw profileErr;

                // 3. Log this massive action
                await supabaseAdmin.from('admin_audit_logs').insert({
                    admin_address: cleanAddress,
                    action: 'SEASON_RESET',
                    details: 'Admin performed a full XP & Tier reset for a new season'
                });

                return res.status(200).json({ success: true, message: 'Season reset successfully' });
            }

            case 'AUDIT_GOVERNANCE': {
                const { tx_hash, governor_action, details } = req.body;
                if (!tx_hash || !governor_action) throw new Error("Missing governance data");

                await supabaseAdmin.from('admin_audit_logs').insert([{
                    admin_address: cleanAddress,
                    action: governor_action,
                    details: {
                        tx_hash,
                        ...details
                    }
                }]);
                return res.status(200).json({ success: true, message: 'Governance action logged' });
            }

            case 'SYNC_ECONOMY': {
                const { token_price_usd, tx_hash } = req.body;
                if (token_price_usd === undefined) throw new Error("Missing price data");

                // Update global point settings for calculations
                const { error: upsertErr } = await supabaseAdmin
                    .from('point_settings')
                    .upsert({
                        activity_key: 'global_token_price',
                        points_per_unit: token_price_usd,
                        is_active: true,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'activity_key' });

                if (upsertErr) throw upsertErr;

                // Log the economic update
                await supabaseAdmin.from('admin_audit_logs').insert([{
                    admin_address: cleanAddress,
                    action: 'SYNC_ECONOMY_PRICE',
                    details: {
                        new_price: token_price_usd,
                        tx_hash
                    }
                }]);

                return res.status(200).json({ success: true, message: 'Economy synchronized' });
            }

            default:
                return res.status(400).json({ error: 'Invalid action: ' + action });
        }

    } catch (error) {
        console.error(`[API] Task Bundle Error (${action}):`, error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
