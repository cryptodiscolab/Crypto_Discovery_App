import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AUTHORIZED_ADMINS = [
    '0x08452b1bdaa6acd11f6ccf5268d16e2ac29c204b',
    '0x455DF75735d2a18c26f0AfDefa93217B60369fe5'
].map(a => a.toLowerCase());

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

        // 2. Admin Check (Genesis Admins)
        const cleanAddress = address.trim().toLowerCase();
        let isAdmin = AUTHORIZED_ADMINS.includes(cleanAddress);

        // Database Check (Dynamic assigned admins)
        if (!isAdmin && supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data: userProfile, error } = await supabase
                .from('user_profiles')
                .select('is_admin')
                .eq('wallet_address', cleanAddress)
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
