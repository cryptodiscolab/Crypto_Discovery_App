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
        const allAdminStr = `${adminStr},${walletsStr}`;

        if (!allAdminStr || allAdminStr === ',') {
            console.error('Admin configurations missing');
            return res.status(500).json({ error: 'Admin configuration missing' });
        }

        // Support multiple comma-separated addresses
        const adminAddresses = allAdminStr.split(',').map(a => a.trim().toLowerCase()).filter(a => a !== '');
        const isAdmin = address && adminAddresses.includes(address.toLowerCase());

        return res.status(200).json({
            isAdmin,
            message: isAdmin ? 'Admin access granted' : 'Regular user access'
        });

    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
