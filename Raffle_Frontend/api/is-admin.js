/**
 * /api/is-admin
 * Lightweight read-only check: is a given wallet address an admin?
 * Reads ADMIN_ADDRESS from server environment — never exposed in frontend bundle.
 */
export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    const { wallet } = req.query;
    if (!wallet) {
        return res.status(400).json({ isAdmin: false, error: 'Missing wallet' });
    }

    const rawEnv = [
        process.env.ADMIN_ADDRESS,
        process.env.VITE_ADMIN_ADDRESS,
        process.env.VITE_ADMIN_WALLETS,
        '0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B', // Master primary hardcoded as safety
        '0x455DF75735d2a18c26f0AfDefa93217B60369fe5'
    ].join(',');

    const adminList = rawEnv
        .split(',')
        .map(a => a?.trim().toLowerCase())
        .filter(Boolean);

    const isAdmin = adminList.includes(wallet.trim().toLowerCase());
    return res.status(200).json({ isAdmin });
}
