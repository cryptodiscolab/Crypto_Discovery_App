import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AUTHORIZED_ADMINS = [
    '0x08452c1bdaa6acd11f6ccf5268d16e2ac29c204b',  // Primary admin (corrected checksum)
    '0x455df75735d2a18c26f0afdefa93217b60369fe5'   // Secondary admin
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { address, signature, message } = req.body;

        if (!address || !signature || !message) {
            return res.status(400).json({ error: 'address, signature, and message are required' });
        }

        // 1. Cryptographic identity verification
        const valid = await verifyMessage({
            address,
            message,
            signature,
        });

        if (!valid) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // 2. Replay protection: 5-minute timestamp window
        const timeMatch = message.match(/Time:\s*(.+)$/m);
        if (!timeMatch) {
            return res.status(400).json({ error: 'Message missing timestamp' });
        }

        const msgTime = new Date(timeMatch[1]).getTime();
        if (isNaN(msgTime) || Math.abs(Date.now() - msgTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: 'Signature expired' });
        }

        const cleanAddress = address.trim().toLowerCase();

        // 3. Replay protection (DB level): ensure this signature/timestamp hasn't been used
        if (supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            const { error: replayError } = await supabase
                .from('api_action_log')
                .insert([{
                    wallet_address: cleanAddress,
                    action: 'ADMIN_CHECK',
                    msg_timestamp: msgTime
                }]);

            if (replayError && (replayError.code === '23505' || replayError.message?.includes('duplicate key'))) {
                return res.status(401).json({ error: 'Signature already used (Replay attack prevention)' });
            }

            // 4. Admin check: hardcoded genesis admins first
            let isAdmin = AUTHORIZED_ADMINS.includes(cleanAddress);

            // 5. Dynamic admin check via DB (only if not already a genesis admin)
            if (!isAdmin) {
                const { data: userProfile } = await supabase
                    .from('user_profiles')
                    .select('is_admin')
                    .eq('wallet_address', cleanAddress)
                    .single();

                if (userProfile?.is_admin) {
                    isAdmin = true;
                }
            }

            if (!isAdmin) {
                console.warn(`[Security] Unauthorized admin check attempt: ${cleanAddress.slice(0, 8)}...`);
            }

            return res.status(200).json({
                isAdmin,
                message: isAdmin ? 'Admin access granted' : 'Unauthorized'
            });
        }

        // Fallback for missing Supabase config (though it shouldn't happen in prod)
        return res.status(500).json({ error: 'Server configuration error' });

    } catch (error) {
        console.error('[admin/check] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
