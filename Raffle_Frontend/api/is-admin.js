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

    const raw = process.env.ADMIN_ADDRESS || '';
    const adminList = raw
        .split(',')
        .map(a => a.trim().toLowerCase())
        .filter(Boolean);

    const isAdmin = adminList.includes(wallet.trim().toLowerCase());
    return res.status(200).json({ isAdmin });
}
