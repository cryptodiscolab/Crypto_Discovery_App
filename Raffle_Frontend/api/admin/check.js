export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { address } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        // Get admin addresses from environment variables
        const adminStr = process.env.ADMIN_ADDRESS || '';
        const walletsStr = process.env.VITE_ADMIN_WALLETS || '';
        const fidsStr = process.env.VITE_ADMIN_FIDS || '';
        const allAdminStr = `${adminStr},${walletsStr}`;

        // Support multiple comma-separated addresses
        const adminAddresses = allAdminStr.split(',').map(a => a.trim().toLowerCase()).filter(a => a !== '');
        const adminFids = fidsStr.split(',').map(f => f.trim()).filter(f => f !== '').map(f => parseInt(f)).filter(f => !isNaN(f));

        const isWalletAdmin = address && adminAddresses.includes(address.toLowerCase());
        const isFidAdmin = req.body.fid && adminFids.includes(parseInt(req.body.fid));

        const isAdmin = isWalletAdmin || isFidAdmin;

        return res.status(200).json({
            isAdmin,
            message: isAdmin ? 'Admin access granted' : 'Regular user access'
        });

    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
