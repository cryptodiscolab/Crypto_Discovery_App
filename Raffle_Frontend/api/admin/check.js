export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { address, fid } = req.body;

        if (!address || !fid) {
            return res.status(400).json({
                error: 'Both Address and FID are required for admin double-check'
            });
        }

        // PROTOKOL KEAMANAN KETAT (Double Check)
        // Wajib FID 1477344 DAN Wallet 0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B
        const REQUIRED_FID = 1477344;
        const REQUIRED_WALLET = '0x08452c1bdaa6acd11f6ccf5268d16e2ac29c204b';

        const isFidMatch = parseInt(fid) === REQUIRED_FID;
        const isWalletMatch = address.toLowerCase() === REQUIRED_WALLET;

        const isAdmin = isFidMatch && isWalletMatch;

        if (!isAdmin) {
            console.warn(`[Security] Unauthorized access attempt: FID ${fid}, Wallet ${address}`);
        }

        return res.status(200).json({
            isAdmin,
            message: isAdmin ? 'Admin access granted (Double Check Success)' : 'Unauthorized: Double Check Failed'
        });

    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
