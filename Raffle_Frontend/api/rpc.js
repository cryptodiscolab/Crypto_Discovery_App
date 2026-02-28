export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { env } = process;
    const ALCHEMY_KEY = env.VITE_ALCHEMY_API_KEY || env.ALCHEMY_API_KEY;
    const CHAIN_ID = req.query.chainId || '84532'; // Default to Base Sepolia

    if (!ALCHEMY_KEY) {
        return res.status(500).json({ error: 'RPC Configuration Missing' });
    }

    const rpcUrl = CHAIN_ID === '8453'
        ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
        : `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    try {
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('[RPC Proxy Error]:', error);
        return res.status(500).json({ error: 'Failed to proxy RPC request' });
    }
}
