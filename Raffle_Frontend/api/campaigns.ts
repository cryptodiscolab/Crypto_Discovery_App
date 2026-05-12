import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    sanitizeError
} from './constants';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, campaign_id, wallet, signature, message } = req.body;

    try {
        if (action === 'join') {
            if (!campaign_id || !wallet || !signature || !message) {
                return res.status(400).json({ error: 'Missing join data' });
            }

            const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
            if (!valid) return res.status(401).json({ error: 'Invalid signature' });

            const isoMatch = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
            if (!isoMatch) return res.status(401).json({ error: 'Invalid message format: Missing timestamp' });
            const messageTime = new Date(isoMatch[0]).getTime();
            if (Math.abs(Date.now() - messageTime) / (1000 * 60) > 5) return res.status(401).json({ error: 'Signature expired' });

            const { data: existing } = await supabaseAdmin
                .from('user_claims')
                .select('id')
                .eq('campaign_id', campaign_id)
                .eq('user_address', wallet.toLowerCase())
                .maybeSingle();

            if (existing) return res.status(400).json({ error: 'Already joined' });

            const { data: campaign, error: cErr } = await supabaseAdmin
                .from('campaigns')
                .select('max_participants, current_participants, status')
                .eq('id', campaign_id)
                .maybeSingle();

            if (cErr || !campaign) throw new Error('Campaign not found');
            if (campaign.status !== 'active') throw new Error('Campaign is not active');
            if (campaign.max_participants && campaign.current_participants >= campaign.max_participants) {
                throw new Error('Campaign is full');
            }

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

            await supabaseAdmin.rpc('fn_increment_campaign_participants', { p_campaign_id: campaign_id });

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (error: any) {
        return res.status(500).json({ error: sanitizeError(error) });
    }
}
