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

    const action = req.body.action || req.query.action;

    try {
        const { address, wallet_address, signature, message } = req.body;
        const targetAddress = address || wallet_address;

        if (!targetAddress || !signature || !message) {
            return res.status(400).json({ error: 'Missing required auth fields' });
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
            return res.status(401).json({ error: 'Signature expired' });
        }

        const cleanAddress = targetAddress.toLowerCase();

        // 3. Action Routing
        switch (action) {
            case 'check': {
                // Double check replay protection at DB level
                const { error: replayError } = await supabaseAdmin
                    .from('api_action_log')
                    .insert([{
                        wallet_address: cleanAddress,
                        action: 'ADMIN_CHECK_SECURE',
                        msg_timestamp: msgTime
                    }]);

                if (replayError && (replayError.code === '23505' || replayError.message?.includes('duplicate key'))) {
                    return res.status(401).json({ error: 'Signature already used' });
                }

                let isAdmin = AUTHORIZED_ADMINS.includes(cleanAddress);
                if (!isAdmin) {
                    const { data: profile } = await supabaseAdmin
                        .from('user_profiles')
                        .select('is_admin')
                        .eq('wallet_address', cleanAddress)
                        .single();
                    if (profile?.is_admin) isAdmin = true;
                }
                return res.status(200).json({ isAdmin, message: isAdmin ? 'Admin access granted' : 'Unauthorized' });
            }

            case 'sync-tiers': {
                // Admin check
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

                // Replay protection DB level
                await supabaseAdmin.from('api_action_log').insert([{
                    wallet_address: cleanAddress,
                    action: 'SYNC_TIERS',
                    msg_timestamp: msgTime
                }]);

                const { data, error } = await supabaseAdmin.rpc('fn_compute_leaderboard_tiers');
                if (error) throw error;

                // Background refresh rank scores
                supabaseAdmin.rpc('fn_refresh_rank_scores').catch(e => console.error('[Sync] Rank scores refresh failed:', e));

                return res.status(200).json({ success: true, count: data.length });
            }

            default:
                return res.status(400).json({ error: 'Invalid action: ' + action });
        }

    } catch (error) {
        console.error(`[API] Admin Bundle Error (${action}):`, error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
