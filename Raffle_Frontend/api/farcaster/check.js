const fetch = require("node-fetch"); // Vercel functions support fetch natively in newer runtimes, but node-fetch is safer for consistency

module.exports = async (req, res) => {
    const { address } = req.query;

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid address' });
    }

    const normalizedAddress = address.toLowerCase();

    try {
        const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${normalizedAddress}`,
            {
                headers: {
                    'api_key': process.env.NEYNAR_API_KEY || '',
                }
            }
        );

        if (response.status === 404) {
            return res.status(404).json(null);
        }

        if (!response.ok) {
            return res.status(502).json({ error: 'Upstream API failure' });
        }

        const data = await response.json();
        const userList = data[normalizedAddress] || [];
        const user = userList.length > 0 ? userList[0] : null;

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json(user);

    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
};
