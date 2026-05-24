import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    NEYNAR_API_KEY,
    NEYNAR_API_URL,
    getEnv,
    sanitizeError
} from './_shared/constants.js';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { fid, message, type = 'mention', signature, signedMessage, wallet } = req.body;
        if (!fid || !message) return res.status(400).json({ error: 'Missing fid or message' });

        // Auth: Accept either wallet signature OR internal CRON_SECRET
        const cronSecret = getEnv('CRON_SECRET', '');
        const authHeader = req.headers['authorization'];
        const isInternalCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

        if (!isInternalCall) {
            // User-initiated: require wallet signature
            if (!signature || !signedMessage || !wallet) return res.status(400).json({ error: 'Missing auth fields (signature, signedMessage, wallet)' });

            const valid = await verifyMessage({ address: wallet as `0x${string}`, message: signedMessage, signature: signature as `0x${string}` });
            if (!valid) return res.status(401).json({ error: 'Invalid signature' });

            const { data: profile } = await supabaseAdmin.from('user_profiles').select('fid').eq('wallet_address', wallet.toLowerCase()).maybeSingle();
            if (!profile || Number(profile.fid) !== Number(fid)) return res.status(403).json({ error: 'Unauthorized' });
        }

        const response = await fetch(NEYNAR_API_URL, {
            method: 'POST',
            headers: { 'api_key': NEYNAR_API_KEY || '', 'content-type': 'application/json' },
            body: JSON.stringify({
                signer_uuid: getEnv('NEYNAR_SIGNER_UUID', ''),
                text: message,
                ...(type === 'mention' ? { mentions: [fid], mentions_positions: [0] } : {})
            })
        });

        if (!response.ok) return res.status(502).json({ error: 'Neynar error' });
        return res.status(200).json({ ok: true });
    } catch (e: unknown) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}
