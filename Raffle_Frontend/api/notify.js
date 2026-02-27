/**
 * /api/notify
 * ===========
 * Secure Neynar notification endpoint.
 * NEYNAR_API_KEY disimpan di server — TIDAK pernah dikirim ke client.
 *
 * POST body: { fid: number, message: string, type?: "mention"|"cast" }
 */

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export default async function handler(req, res) {
    // ── Method Guard ──
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // ── Server Config Guard ──
    if (!NEYNAR_API_KEY) {
        console.error('[Notify] Missing NEYNAR_API_KEY on server');
        return res.status(500).json({ error: 'Internal server error' });
    }

    const { fid, message, type = 'mention' } = req.body || {};

    // ── Input Validation ──
    if (!fid || !message) {
        return res.status(400).json({ error: 'Missing required fields: fid, message' });
    }
    if (typeof message !== 'string' || message.length > 500) {
        return res.status(400).json({ error: 'Invalid message format or too long' });
    }

    try {
        // ── Neynar API Call (server-side only) ──
        const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
            method: 'POST',
            headers: {
                'api_key': NEYNAR_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                signer_uuid: process.env.NEYNAR_SIGNER_UUID || '',
                text: message,
                // Mention user by FID if type is 'mention'
                ...(type === 'mention' ? {
                    mentions: [fid],
                    mentions_positions: [0]
                } : {})
            })
        });

        if (!response.ok) {
            // Non-blocking: Log error but don't expose Neynar internals
            const errText = await response.text().catch(() => '');
            console.error(`[Notify] Neynar API error ${response.status}:`, errText.slice(0, 200));
            return res.status(502).json({ error: 'Notification service unavailable' });
        }

        return res.status(200).json({ ok: true });

    } catch (err) {
        // ZERO TRUST: Never expose stack trace or env status to client
        console.error('[Notify] Fatal error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
