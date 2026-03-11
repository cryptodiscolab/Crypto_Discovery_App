import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, campaign_id, wallet, signature, message } = req.body;

    try {
        if (action === 'join') {
            if (!campaign_id || !wallet || !signature || !message) {
                return res.status(400).json({ error: 'Missing join data (campaign_id, wallet, signature, message)' });
            }

            // Verify Signature
            const valid = await verifyMessage({ address: wallet, message, signature });
            if (!valid) return res.status(401).json({ error: 'Invalid signature' });

            // 1. Check if user already joined
            const { data: existing } = await supabaseAdmin
                .from('user_claims')
                .select('id')
                .eq('campaign_id', campaign_id)
                .eq('user_address', wallet.toLowerCase())
                .single();

            if (existing) {
                return res.status(400).json({ error: 'Already joined this campaign' });
            }

            // 2. Check campaign capacity
            const { data: campaign, error: cErr } = await supabaseAdmin
                .from('campaigns')
                .select('max_participants, current_participants, status')
                .eq('id', campaign_id)
                .single();

            if (cErr || !campaign) throw new Error('Campaign not found');
            if (campaign.status !== 'active') throw new Error('Campaign is not active');
            if (campaign.max_participants && campaign.current_participants >= campaign.max_participants) {
                throw new Error('Campaign is full');
            }

            // 3. Create claim record
            const { error: claimErr } = await supabaseAdmin
                .from('user_claims')
                .insert({
                    user_address: wallet.toLowerCase(),
                    campaign_id: campaign_id,
                    is_verified: false,
                    is_claimed: false,
                    created_at: new Date().toISOString()
                });

            if (claimErr) throw claimErr;

            // 4. Increment participants (Atomic Fix)
            await supabaseAdmin.rpc('fn_increment_campaign_participants', { p_campaign_id: campaign_id });

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
        console.error('[API] Campaign Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
