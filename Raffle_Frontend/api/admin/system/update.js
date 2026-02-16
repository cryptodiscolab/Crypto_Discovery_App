import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin
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
        const { wallet_address, signature, message, action_type, payload } = req.body;

        if (!wallet_address || !signature || !message || !action_type || !payload) {
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

        const cleanAddress = wallet_address.toLowerCase();

        // 3. Admin Authorization Check
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
            console.warn(`[Security] Unauthorized admin action attempt: ${action_type} by ${cleanAddress}`);
            return res.status(403).json({ error: 'Unauthorized: Admin privileges required.' });
        }

        // 4. Process Actions
        let result;
        let dbError;

        switch (action_type) {
            case 'UPDATE_POINTS':
                // payload: array of point settings
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('point_settings')
                    .upsert(payload, { onConflict: 'activity_key' }));
                break;

            case 'UPDATE_THRESHOLDS':
                // payload: array of threshold settings (delete and re-insert pattern used in frontend)
                await supabaseAdmin.from('sbt_thresholds').delete().neq('level', 0);
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('sbt_thresholds')
                    .insert(payload));
                break;

            case 'ISSUE_ENS':
                // payload: { fid, wallet_address, label, full_name }
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('ens_subdomains')
                    .insert([payload]));
                break;

            default:
                return res.status(400).json({ error: 'Invalid action type' });
        }

        if (dbError) throw dbError;

        // 5. Log Audit
        await supabaseAdmin.from('admin_audit_logs').insert([{
            admin_address: cleanAddress,
            action: action_type,
            details: payload
        }]);

        return res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error('[API] Admin System Update Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
