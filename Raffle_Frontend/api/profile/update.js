import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin (Service Role)
// NOTE: Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel Environment Variables
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SECURITY FIX: Whitelist allowed origins instead of wildcard '*'
const ALLOWED_ORIGINS = [
    'https://crypto-discovery-app.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
];

export default async function handler(req, res) {
    // CORS Headers (Hardened: domain-specific)
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
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

        // 2.5 Replay Protection: Validate Timestamp
        const timeMatch = message.match(/Time:\s*(.+)$/m);
        if (!timeMatch) return res.status(400).json({ error: 'Message missing timestamp' });

        const msgTime = new Date(timeMatch[1]).getTime();
        const diff = Math.abs(Date.now() - msgTime);
        if (diff > 5 * 60 * 1000) { // 5 minutes window
            return res.status(401).json({ error: 'Signature expired (Replay Protection)' });
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

        // 4. Audit Log (C5 Fix: was missing)
        await supabaseAdmin.from('admin_audit_logs').insert([{
            admin_address: cleanAddress,
            action: 'PROFILE_UPDATE',
            details: {
                fields_updated: Object.keys(safeProfileData).filter(k => safeProfileData[k] !== undefined),
                timestamp: new Date().toISOString()
            }
        }]).catch(() => { }); // Non-blocking audit

        return res.status(200).json({ success: true, data });

    } catch (error) {
        console.error('[API] Profile Update Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

