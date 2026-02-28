import { createClient } from '@supabase/supabase-js';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { createPublicClient, http, verifyMessage } from 'viem';
import { baseSepolia } from 'viem/chains';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const neynar = new NeynarAPIClient({ apiKey: neynarApiKey || '' });

const rpcClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
});

const DAILY_APP_ADDRESS = process.env.VITE_V12_CONTRACT_ADDRESS || '0x263e7dD71845C4C2B95D50859a7396C793C76435';

export default async function handler(req, res) {
    const action = req.body?.action || req.query?.action;

    switch (action) {
        case 'sync': // Logic from api/user/sync.js (Login Sync)
            return handleLoginSync(req, res);
        case 'xp': // Logic from api/user/sync.js (XP Sync)
            return handleXpSync(req, res);
        case 'fc-sync': // Logic from api/farcaster/sync.js
            return handleFarcasterSync(req, res);
        case 'update-profile': // Logic from api/profile/update.js
            return handleUpdateProfile(req, res);
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

async function handleLoginSync(req, res) {
    const { wallet_address, signature, message, fid, metadata } = req.body;
    if (!wallet_address || !signature || !message) return res.status(400).json({ error: 'Missing fields' });

    try {
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const cleanAddress = wallet_address.toLowerCase();
        const { data, error } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                wallet_address: cleanAddress,
                fid: fid || null,
                last_login_at: new Date().toISOString(),
                ...(metadata || {}),
            }, { onConflict: 'wallet_address' })
            .select().single();

        if (error) throw error;
        return res.status(200).json({ success: true, profile: data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleXpSync(req, res) {
    const { wallet_address } = req.body;
    if (!wallet_address) return res.status(400).json({ error: 'Missing wallet' });

    try {
        const stats = await rpcClient.readContract({
            address: DAILY_APP_ADDRESS,
            abi: [{
                inputs: [{ name: '', type: 'address' }],
                name: 'userStats',
                outputs: [
                    { name: 'points', type: 'uint256' },
                    { name: 'totalTasksCompleted', type: 'uint256' },
                    { name: 'referralCount', type: 'uint256' },
                    { name: 'currentTier', type: 'uint8' },
                    { name: 'tasksForReferralProgress', type: 'uint256' },
                    { name: 'lastDailyBonusClaim', type: 'uint256' },
                    { name: 'isBlacklisted', type: 'bool' },
                ],
                stateMutability: 'view',
                type: 'function',
            }],
            functionName: 'userStats',
            args: [wallet_address],
        });

        const onChainXP = Number(stats[0] || 0);
        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ total_xp: onChainXP, updated_at: new Date().toISOString() })
            .eq('wallet_address', wallet_address.toLowerCase());

        if (error) throw error;
        return res.status(200).json({ ok: true, xp: onChainXP });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleFarcasterSync(req, res) {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Missing address' });

    try {
        const response = await neynar.fetchBulkUsersByEthOrSolAddress({ addresses: [address] });
        const fcUser = response?.[address.toLowerCase()]?.[0];

        if (fcUser) {
            const { data, error } = await supabaseAdmin
                .from('user_profiles')
                .upsert({
                    wallet_address: address.toLowerCase(),
                    fid: fcUser.fid,
                    username: fcUser.username,
                    pfp_url: fcUser.pfp_url,
                    neynar_score: fcUser.experimental?.neynar_user_score || 0
                }, { onConflict: 'wallet_address' })
                .select().single();
            if (error) throw error;
            return res.status(200).json({ ok: true, profile: data });
        }
        return res.status(404).json({ error: 'No Farcaster profile' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleUpdateProfile(req, res) {
    // Logic from verify-action/route.js
    const { wallet, payload } = req.body;
    if (!wallet || !payload) return res.status(400).json({ error: 'Missing data' });

    try {
        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update(payload)
            .eq('wallet_address', wallet.toLowerCase());
        if (error) throw error;
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
