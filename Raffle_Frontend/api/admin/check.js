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

        // Get admin address from environment variable
        const adminAddress = process.env.ADMIN_ADDRESS;

        if (!adminAddress) {
            console.error('ADMIN_ADDRESS not configured in environment variables');
            return res.status(500).json({ error: 'Admin configuration missing' });
        }

        // Case-insensitive comparison
        const isAdmin = address.toLowerCase() === adminAddress.toLowerCase();

        return res.status(200).json({
            isAdmin,
            message: isAdmin ? 'Admin access granted' : 'Regular user access'
        });

    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
