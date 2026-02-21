import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { verifyMessage } from 'viem';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { wallet_address, signature, message, action } = req.body;

    if (!wallet_address || !signature || !message || action !== 'CLEAR_ALL') {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        // 1. Verify Identity (Anti-Cheat Admin)
        const isValid = await verifyMessage({
            address: wallet_address,
            message: message,
            signature: signature
        });

        if (!isValid) return res.status(401).json({ error: 'Unauthorized signature' });

        // 2. Check if admin exists in CMS (Security)
        const { data: admin } = await supabaseAdmin
            .from('cms_admins')
            .select('role')
            .eq('wallet_address', wallet_address.toLowerCase())
            .single();

        if (!admin || (admin.role !== 'owner' && admin.role !== 'admin')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // 3. Perform Cleanup
        // We either delete or deactivate. User said "terhapus" so we delete.
        const { error } = await supabaseAdmin
            .from('daily_tasks')
            .delete()
            .neq('id', 0); // Delete all where id is not 0

        if (error) throw error;

        // 4. Log Action
        await supabaseAdmin.from('admin_audit_logs').insert({
            admin_address: wallet_address.toLowerCase(),
            action: 'CLEAR_ALL_DAILY_TASKS',
            details: 'Admin cleared all daily tasks'
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('[Cleanup Error]', err);
        return res.status(500).json({ error: err.message });
    }
}
