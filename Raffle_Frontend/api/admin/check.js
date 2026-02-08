import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { address, fid } = req.body;
        const userFid = fid ? parseInt(fid) : null;

        if (!address) {
            return res.status(400).json({
                error: 'Wallet Address is required'
            });
        }

        // PROTOKOL KEAMANAN KETAT (Double Check)
        // Wajib FID 1477344 DAN Wallet 0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B
        const REQUIRED_FID = 1477344;
        const REQUIRED_WALLET = '0x08452b1bdaa6acd11f6ccf5268d16e2ac29c204b';

        const isFidMatch = userFid === REQUIRED_FID;
        const isWalletMatch = address.toLowerCase() === REQUIRED_WALLET;

        // Hardcoded check
        let isAdmin = isFidMatch && isWalletMatch;

        // Database Check (Dynamic)
        if (!isAdmin && supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data: userProfile, error } = await supabase
                .from('user_profiles')
                .select('is_admin')
                .eq('wallet_address', address.toLowerCase())
                .single();

            if (userProfile && userProfile.is_admin) {
                isAdmin = true;
            }
        }

        if (!isAdmin) {
            console.warn(`[Security] Unauthorized access attempt: FID ${fid}, Wallet ${address}`);
        }

        return res.status(200).json({
            isAdmin,
            message: isAdmin ? 'Admin access granted' : 'Unauthorized'
        });

    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
