import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin (Service Role)
// NOTE: Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel Environment Variables
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    // CORS Headers (Optional, but good for local dev)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { wallet_address, signature, message, profile_data } = req.body;

        // 1. Validation
        if (!wallet_address || !signature || !message || !profile_data) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 2. Signature Verification (The Core Security Layer)
        // Using viem's verifyMessage to check if the signature matches the wallet and message
        const valid = await verifyMessage({
            address: wallet_address,
            message: message,
            signature: signature,
        });

        if (!valid) {
            return res.status(401).json({ error: 'Invalid signature! Unauthorized access attempt.' });
        }

        // 3. Update Database (Secure Bypass of RLS)
        const cleanAddress = wallet_address.toLowerCase();

        // Sanitize profile data to prevent injecting unwanted fields
        const safeProfileData = {
            display_name: profile_data.display_name,
            bio: profile_data.bio,
            avatar_url: profile_data.avatar_url, // Optional
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                wallet_address: cleanAddress,
                ...safeProfileData
            }, { onConflict: 'wallet_address' })
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, data });

    } catch (error) {
        console.error('[API] Profile Update Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
