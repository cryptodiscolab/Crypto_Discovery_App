import { verifyMessage } from 'viem';
import { createClient } from '@supabase/supabase-js';

const NEYNAR_API_KEY = (process.env.NEYNAR_API_KEY || '').trim();
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);


export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        if (!NEYNAR_API_KEY) {
            return res.status(500).json({ error: 'Internal server error: missing API key' });
        }

        const { fid, message, type = 'mention', signature, signedMessage, wallet } = req.body || {};

        if (!fid || !message || !signature || !signedMessage || !wallet) {
            return res.status(400).json({ error: 'Missing required security fields' });
        }

        // 1. Verify Signature
        const validSignature = await verifyMessage({ address: wallet, message: signedMessage, signature });
        if (!validSignature) return res.status(401).json({ error: 'Invalid signature' });

        // 2. Security Check: Does this wallet own this FID?
        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('fid')
            .eq('wallet_address', wallet.toLowerCase())
            .maybeSingle();

        if (!profile || Number(profile.fid) !== Number(fid)) {
            return res.status(403).json({ error: 'Unauthorized: You can only notify your own FID' });
        }

        // 3. Neynar API Call
        const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
            method: 'POST',
            headers: {
                'api_key': NEYNAR_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                signer_uuid: process.env.NEYNAR_SIGNER_UUID || '',
                text: message,
                ...(type === 'mention' ? {
                    mentions: [fid],
                    mentions_positions: [0]
                } : {})
            })
        });

        if (!response.ok) {
            return res.status(502).json({ error: 'Notification service unavailable' });
        }

        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error('[Notify] Fatal error:', err.message);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
