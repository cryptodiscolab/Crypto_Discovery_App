import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AUTHORIZED_ADMINS = [
    '0x08452b1bdaa6acd11f6ccf5268d16e2ac29c204b', // Primary Admin
    '0x455DF75735d2a18c26f0AfDefa93217B60369fe5'  // Secondary Admin
].map(a => a.toLowerCase());

// Basic in-memory rate limiter
// ⚠️ NOTE: This Map resets on serverless cold starts — provides best-effort
// protection only. For strict rate limiting, use Redis or Supabase-based counters.
const lastActions = new Map();
const RATE_LIMIT_MS = 2000; // 2 seconds between admin actions

export default async function handler(req, res) {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (lastActions.has(clientIP) && (now - lastActions.get(clientIP) < RATE_LIMIT_MS)) {
        return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }
    lastActions.set(clientIP, now);

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
        let isAuthorized = AUTHORIZED_ADMINS.includes(cleanAddress);

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
                if (!Array.isArray(payload) || payload.length === 0) {
                    return res.status(400).json({ error: 'Payload must be a non-empty array' });
                }
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('point_settings')
                    .upsert(payload, { onConflict: 'activity_key' }));
                break;

            case 'UPDATE_THRESHOLDS':
                // payload: array of threshold settings
                if (!Array.isArray(payload) || payload.length === 0) {
                    return res.status(400).json({ error: 'Payload must be a non-empty array' });
                }
                // Atomic upsert instead of delete+insert for safety
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('sbt_thresholds')
                    .upsert(payload, { onConflict: 'level' }));
                break;

            case 'GRANT_ROLE':
                // payload: { target_address: '0x...' }
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('user_profiles')
                    .update({ is_admin: true })
                    .eq('wallet_address', payload.target_address.toLowerCase())
                    .select());
                break;

            case 'REVOKE_ROLE':
                // payload: { target_address: '0x...' }
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('user_profiles')
                    .update({ is_admin: false })
                    .eq('wallet_address', payload.target_address.toLowerCase())
                    .select());
                break;

            case 'GRANT_PRIVILEGE':
                // payload: { target_address: '0x...', feature_id: '...' }
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('user_privileges')
                    .upsert({
                        wallet_address: payload.target_address.toLowerCase(),
                        feature_id: payload.feature_id,
                        granted_at: new Date().toISOString()
                    }, { onConflict: 'wallet_address,feature_id' })
                    .select());
                break;

            case 'REVOKE_PRIVILEGE':
                // payload: { target_address: '0x...', feature_id: '...' }
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('user_privileges')
                    .delete()
                    .eq('wallet_address', payload.target_address.toLowerCase())
                    .eq('feature_id', payload.feature_id));
                break;

            case 'BATCH_GRANT_PRIVILEGE':
                // payload: { target_addresses: ['0x...', ...], feature_id: '...' }
                const batchData = payload.target_addresses.map(addr => ({
                    wallet_address: addr.toLowerCase(),
                    feature_id: payload.feature_id,
                    granted_at: new Date().toISOString()
                }));
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('user_privileges')
                    .upsert(batchData, { onConflict: 'wallet_address,feature_id' })
                    .select());
                break;

            case 'SYNC_RAFFLE':
                // payload: { raffle_id, creator, nft_address, token_id, end_time, max_tickets, metadata_uri, prize_pool }
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('raffles')
                    .upsert({
                        id: payload.raffle_id,
                        creator_address: payload.creator.toLowerCase(),
                        sponsor_address: payload.creator.toLowerCase(), // In V2, sponsor is creator
                        nft_contract: payload.nft_address?.toLowerCase() || '',
                        token_id: payload.token_id || 0,
                        end_time: payload.end_time,
                        max_tickets: payload.max_tickets || 100,
                        metadata_uri: payload.metadata_uri || '',
                        prize_pool: payload.prize_pool || 0,
                        is_active: true,
                        is_finalized: payload.is_finalized || false,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' })
                    .select());
                break;

            case 'ISSUE_ENS':
                // payload: { fid, wallet_address, label, full_name }
                if (!payload.wallet_address) return res.status(400).json({ error: 'wallet_address is required in payload' });

                const cleanPayload = {
                    ...payload,
                    wallet_address: payload.wallet_address.toLowerCase()
                };

                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('ens_subdomains')
                    .insert([cleanPayload]));
                break;

            case 'UPDATE_TIER_CONFIG':
                // payload: { gold: 0.10, silver: 0.30, bronze: 0.70 }
                if (typeof payload !== 'object') return res.status(400).json({ error: 'Invalid payload' });
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('system_settings')
                    .upsert({
                        key: 'tier_percentiles',
                        value: payload,
                        updated_at: new Date().toISOString()
                    }));
                break;

            case 'MANUAL_TIER_OVERRIDE':
                // payload: { target_address: '0x...', tier: 0..3 }
                if (!payload.target_address || payload.tier === undefined) {
                    return res.status(400).json({ error: 'target_address and tier are required' });
                }
                ({ data: result, error: dbError } = await supabaseAdmin
                    .from('user_profiles')
                    .update({ tier_override: parseInt(payload.tier) })
                    .eq('wallet_address', payload.target_address.toLowerCase())
                    .select());
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
        return res.status(500).json({ error: 'Internal server error' });
    }
}
