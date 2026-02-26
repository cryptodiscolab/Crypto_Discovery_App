/**
 * GET /api/farcaster/check?address=0x...
 * 
 * Server-side proxy for Neynar API.
 * NEYNAR_API_KEY is stored on server and NEVER exposed to browser.
 */
export default async function handler(req, res) {
    const { address } = req.query;

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid address' });
    }

    const normalizedAddress = address.toLowerCase();
    const apiKey = process.env.NEYNAR_API_KEY || process.env.VITE_NEYNAR_API_KEY;

    if (!apiKey) {
        console.error('[farcaster-check] Missing NEYNAR_API_KEY');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const neynarRes = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${normalizedAddress}`,
            {
                headers: {
                    'api_key': apiKey,
                },
            }
        );

        if (neynarRes.status === 404) {
            return res.status(404).json(null);
        }

        if (!neynarRes.ok) {
            console.error('[farcaster-check] Neynar API error:', neynarRes.status);
            return res.status(502).json({ error: 'Upstream API failure' });
        }

        const data = await neynarRes.json();
        const userList = data[normalizedAddress] || [];
        const user = userList.length > 0 ? userList[0] : null;

        return res.status(200).json(user);

    } catch (err) {
        console.error('[farcaster-check] Unexpected error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
