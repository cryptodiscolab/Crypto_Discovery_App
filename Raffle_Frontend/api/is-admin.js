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

    // Zero Hardcode Mandate: Fetch strictly from server environment
    const rawEnv = [
        process.env.ADMIN_ADDRESS,
        process.env.VITE_ADMIN_ADDRESS,
        process.env.VITE_ADMIN_WALLETS
    ].join(',');

    const adminList = rawEnv
        .split(',')
        .map(a => a?.trim().toLowerCase())
        .filter(Boolean);

    const isAdminEnv = adminList.includes(wallet.trim().toLowerCase());
    if (isAdminEnv) return res.status(200).json({ isAdmin: true });

    // Fallback: Check Database for is_admin flag
    try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('is_admin')
            .eq('wallet_address', wallet.toLowerCase())
            .maybeSingle();

        return res.status(200).json({ isAdmin: !!profile?.is_admin });
    } catch (e) {
        console.error('[is-admin] DB check failed:', e.message);
        return res.status(200).json({ isAdmin: false });
    }
}
