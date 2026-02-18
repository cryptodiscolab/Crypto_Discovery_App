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
        const { wallet_address, signature, message, fid, metadata } = req.body;

        if (!wallet_address || !signature || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Verify Signature (SIWE)
        const valid = await verifyMessage({
            address: wallet_address,
            message: message,
            signature: signature,
        });

        if (!valid) {
            return res.status(401).json({ error: 'Invalid signature! Security verification failed.' });
        }

        // 2. Replay Protection: Validate Timestamp
        const timeMatch = message.match(/Time:\s*(.+)$/m);
        if (!timeMatch) return res.status(400).json({ error: 'Message missing timestamp' });

        const msgTime = new Date(timeMatch[1]).getTime();
        const diff = Math.abs(Date.now() - msgTime);
        if (diff > 5 * 60 * 1000) { // 5 minutes window
            return res.status(401).json({ error: 'Signature expired (Replay Protection)' });
        }

        const cleanAddress = wallet_address.toLowerCase();

        // 3. Replay Protection: (DB Level)
        const { error: replayError } = await supabaseAdmin
            .from('api_action_log')
            .insert([{
                wallet_address: cleanAddress,
                action: 'USER_SYNC',
                msg_timestamp: msgTime
            }]);

        if (replayError && (replayError.code === '23505' || replayError.message?.includes('duplicate key'))) {
            // It's possible for user/sync to be called twice very fast (e.g. double trigger in FE)
            // If the action is USER_SYNC, we can be more lenient or just skip the update.
            // But for audit compliance, we enforce replay protection strictly.
            return res.status(401).json({ error: 'Signature already used (Replay attack prevention)' });
        }

        // 4. Synchronize User Profile
        const { data: profile, error: upsertError } = await supabaseAdmin
            .from('user_profiles')
            .upsert(
                {
                    wallet_address: cleanAddress,
                    fid: fid || null,
                    last_login_at: new Date().toISOString(),
                    last_seen_at: new Date().toISOString(),
                    ...(metadata || {})
                },
                {
                    onConflict: 'wallet_address',
                    ignoreDuplicates: false
                }
            )
            .select()
            .single();

        if (upsertError) throw upsertError;

        // 4. Log Audit
        await supabaseAdmin.from('admin_audit_logs').insert([{
            admin_address: 'SYSTEM_SYNC',
            action: 'USER_LOGIN_SYNC',
            details: {
                address: cleanAddress,
                fid: fid,
                timestamp: new Date().toISOString()
            }
        }]);

        return res.status(200).json({
            success: true,
            message: 'User synchronized successfully.',
            profile
        });

    } catch (error) {
        console.error('[API] User Sync Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
