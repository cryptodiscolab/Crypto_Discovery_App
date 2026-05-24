import { VercelRequest, VercelResponse } from '@vercel/node';
import { getEnv, sanitizeError, PINATA_API_URL } from './_shared/constants.js';

const PINATA_JWT = getEnv('PINATA_JWT');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!PINATA_JWT) return res.status(500).json({ error: 'Pinata not configured' });

    try {
        const { metadata, name } = req.body;
        if (!metadata || typeof metadata !== 'object') {
            return res.status(400).json({ error: 'Invalid metadata' });
        }

        const pinRes = await fetch(PINATA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PINATA_JWT}`
            },
            body: JSON.stringify({
                pinataOptions: { cidVersion: 1 },
                pinataMetadata: { name: name || 'metadata.json' },
                pinataContent: metadata
            })
        });

        if (!pinRes.ok) {
            const err = await pinRes.text();
            console.error('[pin-metadata] Pinata error:', err);
            return res.status(502).json({ error: 'IPFS pinning failed' });
        }

        const data = await pinRes.json();
        return res.status(200).json({ success: true, ipfsHash: data.IpfsHash, uri: `ipfs://${data.IpfsHash}` });
    } catch (err: unknown) {
        return res.status(500).json({ error: sanitizeError(err) });
    }
}
