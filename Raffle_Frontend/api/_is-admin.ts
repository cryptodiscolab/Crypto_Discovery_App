import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    getEnv
} from './_shared/constants.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const { wallet } = req.query as { wallet?: string };
        if (!wallet) return res.status(400).json({ isAdmin: false });

        const adminEnv = [
            getEnv('ADMIN_ADDRESS', ''),
            getEnv('VITE_ADMIN_ADDRESS', ''),
            getEnv('VITE_ADMIN_WALLETS', '')
        ].join(',').toLowerCase().split(',').filter(Boolean);

        const clean = wallet.trim().toLowerCase();
        if (adminEnv.includes(clean)) return res.status(200).json({ isAdmin: true });

        const { data: profile } = await supabase.from('user_profiles').select('is_admin').eq('wallet_address', clean).maybeSingle();
        return res.status(200).json({ isAdmin: !!profile?.is_admin });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(200).json({ isAdmin: false, error: msg });
    }
}
