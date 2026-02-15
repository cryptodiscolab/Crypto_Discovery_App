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
        const { wallet_address, signature, message, task_id, xp_reward } = req.body;

        if (!wallet_address || !signature || !message || !task_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Verify Signature
        const valid = await verifyMessage({
            address: wallet_address,
            message: message,
            signature: signature,
        });

        if (!valid) {
            return res.status(401).json({ error: 'Invalid signature! Unauthorized access attempt.' });
        }

        const cleanAddress = wallet_address.toLowerCase();

        // 2. Profile Check/Upsert (Bypass RLS)
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .upsert({ wallet_address: cleanAddress }, { onConflict: 'wallet_address' });

        if (profileError) {
            console.error('[API] Profile Upsert Error:', profileError);
        }

        // 3. Insert Claim (Bypass RLS)
        const { error: claimError } = await supabaseAdmin
            .from('user_task_claims')
            .insert({
                wallet_address: cleanAddress,
                task_id: task_id,
                xp_earned: xp_reward || 0
            });

        if (claimError) {
            if (claimError.code === '23505') { // Unique violation
                return res.status(409).json({ error: 'You already claimed this task today' });
            }
            throw claimError;
        }

        return res.status(200).json({ success: true, message: 'Claim successful' });

    } catch (error) {
        console.error('[API] Task Claim Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
