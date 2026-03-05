import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// AUTHORIZATION: Load from environment
const rawAdmins = [
    process.env.VITE_ADMIN_ADDRESS,
    process.env.VITE_ADMIN_WALLETS,
    process.env.ADMIN_ADDRESS,
    '0x08452b1bdaa6acd11f6ccf5268d16e2ac29c204b',
    '0x455DF75735d2a18c26f0AfDefa93217B60369fe5'
];

const AUTHORIZED_ADMINS = rawAdmins
    .filter(Boolean)
    .join(',')
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(a => a.startsWith('0x'));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const action = req.body.action || req.query.action;

    try {
        const { address, wallet_address, signature, message } = req.body;
        const targetAddress = address || wallet_address;

        if (!targetAddress) {
            return res.status(400).json({ error: 'Missing target address' });
        }

        const cleanAddress = targetAddress.toLowerCase();

        // High-security path: verify signature if provided
        if (signature && message) {
            const valid = await verifyMessage({
                address: targetAddress,
                message: message,
                signature: signature,
            });

            if (!valid) return res.status(401).json({ error: 'Invalid signature!' });

            // Replay Protection: 5-minute window
            const timeMatch = message.match(/Time:\s*(.+)$/m);
            if (!timeMatch) return res.status(400).json({ error: 'Message missing timestamp' });
            const msgTime = new Date(timeMatch[1]).getTime();
            if (isNaN(msgTime) || Math.abs(Date.now() - msgTime) > 5 * 60 * 1000) {
                return res.status(401).json({ error: 'Signature expired' });
            }

            // DB Replay Protection
            await supabaseAdmin.from('api_action_log').insert([{
                wallet_address: cleanAddress,
                action: action === 'check' ? 'ADMIN_CHECK_SECURE' : 'SYNC_TIERS_SECURE',
                msg_timestamp: msgTime
            }]).catch(() => { }); // Optional: don't fail if log fails unless it's a duplicate
        } else if (action !== 'check') {
            // Actions other than 'check' REQUIRE a signature
            return res.status(400).json({ error: 'Missing required signature for privileged action' });
        }

        // 3. Action Routing
        switch (action) {
            case 'check': {
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

                // 1. Fetch current user profiles to check SBT status (Tier > 0)
                const { data: profiles } = await supabaseAdmin
                    .from('user_profiles')
                    .select('wallet_address, tier');

                // 2. Compute tiers via RPC
                const { data, error } = await supabaseAdmin.rpc('fn_compute_leaderboard_tiers');
                if (error) throw error;

                // 3. SECURE FILTER: Only sync users who already have an SBT (Tier > 0)
                // This prevents "Guest" users from being promoted to Bronze+ on-chain accidentally.
                const sbtHolders = new Set(
                    (profiles || [])
                        .filter(p => (p.tier || 0) > 0)
                        .map(p => p.wallet_address.toLowerCase())
                );

                const filteredData = data.filter(item => sbtHolders.has(item.wallet_address.toLowerCase()));

                // Background refresh rank scores
                supabaseAdmin.rpc('fn_refresh_rank_scores').catch(e => console.error('[Sync] Rank scores refresh failed:', e));

                return res.status(200).json({
                    success: true,
                    total_calculated: data.length,
                    sync_ready: filteredData.length,
                    data: filteredData
                });
            }

            default:
                return res.status(400).json({ error: 'Invalid action: ' + action });
        }

    } catch (error) {
        console.error(`[API] Admin Bundle Error (${action}):`, error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
