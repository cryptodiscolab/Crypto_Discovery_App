/**
 * POST /api/user/sync
 * ====================
 * Multi-action user sync endpoint. Routing via `action` field in body.
 *
 * Actions:
 *  - "login"    — Sync user login state (requires signature)
 *  - "xp"       — Read XP from on-chain and update DB (no signature needed, zero-trust via RPC)
 *
 * Consolidated to stay within Vercel Hobby 12-function limit.
 */

import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, verifyMessage } from 'viem';
import { baseSepolia } from 'viem/chains';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ---- On-chain client for XP sync ---- */
const DAILY_APP_ADDRESS = process.env.VITE_V12_CONTRACT_ADDRESS || '0x263e7dD71845C4C2B95D50859a7396C793C76435';
const GET_USER_STATS_ABI = [{
    inputs: [{ name: '_user', type: 'address' }],
    name: 'getUserStats',
    outputs: [{
        components: [
            { name: 'points', type: 'uint256' },
            { name: 'totalTasksCompleted', type: 'uint256' },
            { name: 'referralCount', type: 'uint256' },
            { name: 'currentTier', type: 'uint8' },
            { name: 'tasksForReferralProgress', type: 'uint256' },
            { name: 'lastDailyBonusClaim', type: 'uint256' },
            { name: 'isBlacklisted', type: 'bool' },
        ],
        name: '', type: 'tuple',
    }],
    stateMutability: 'view',
    type: 'function',
}];

const rpcClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
});

/* ====== HANDLER ====== */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { action = 'login', wallet_address } = req.body || {};

    if (!wallet_address || !wallet_address.startsWith('0x')) {
        return res.status(400).json({ error: 'Invalid wallet_address' });
    }

    // ── ACTION: XP SYNC (no signature required — verified on-chain) ──
    if (action === 'xp') {
        return handleXpSync(req, res, wallet_address);
    }

    // ── ACTION: LOGIN SYNC (signature required) ──
    return handleLoginSync(req, res, wallet_address);
}

/* ---------- XP Sync ---------- */
async function handleXpSync(req, res, wallet_address) {
    const cleanWallet = wallet_address.trim().toLowerCase();
    try {
        const stats = await rpcClient.readContract({
            address: DAILY_APP_ADDRESS,
            abi: GET_USER_STATS_ABI,
            functionName: 'getUserStats',
            args: [wallet_address],
        });

        const onChainXP = Number(stats.points);
        const tasksDone = Number(stats.totalTasksCompleted);
        const lastClaimTs = Number(stats.lastDailyBonusClaim);
        const lastClaimAt = lastClaimTs > 0 ? new Date(lastClaimTs * 1000).toISOString() : null;

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                wallet_address: cleanWallet,
                total_xp: onChainXP,
                tasks_completed: tasksDone,
                last_daily_claim_at: lastClaimAt,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'wallet_address' });

        if (error) {
            console.error('[sync/xp] DB error:', error.code, error.message);
            return res.status(500).json({ error: 'Internal server error' });
        }

        return res.status(200).json({ ok: true, xp: onChainXP, tasksDone, lastClaimAt });

    } catch (err) {
        console.error('[sync/xp] Fatal:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/* ---------- Login Sync ---------- */
async function handleLoginSync(req, res, wallet_address) {
    try {
        const { signature, message, fid, metadata } = req.body;

        if (!signature || !message) {
            return res.status(400).json({ error: 'Missing signature or message' });
        }

        // 1. Verify Signature (SIWE)
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // 2. Replay Protection: Timestamp
        const timeMatch = message.match(/Time:\s*(.+)$/m);
        if (!timeMatch) return res.status(400).json({ error: 'Message missing timestamp' });
        const msgTime = new Date(timeMatch[1]).getTime();
        if (Math.abs(Date.now() - msgTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: 'Signature expired' });
        }

        const cleanAddress = wallet_address.toLowerCase();

        // 3. Replay Protection: DB Level
        const { error: replayError } = await supabaseAdmin
            .from('api_action_log')
            .insert([{ wallet_address: cleanAddress, action: 'USER_SYNC', msg_timestamp: msgTime }]);

        if (replayError?.code === '23505') {
            return res.status(401).json({ error: 'Signature already used (Replay attack prevention)' });
        }

        // 4. Sync Profile
        const { data: profile, error: upsertError } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                wallet_address: cleanAddress,
                fid: fid || null,
                last_login_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
                ...(metadata || {}),
            }, { onConflict: 'wallet_address', ignoreDuplicates: false })
            .select().single();

        if (upsertError) throw upsertError;

        await supabaseAdmin.from('admin_audit_logs').insert([{
            admin_address: 'SYSTEM_SYNC',
            action: 'USER_LOGIN_SYNC',
            details: { address: cleanAddress, fid, timestamp: new Date().toISOString() },
        }]);

        return res.status(200).json({ success: true, message: 'User synchronized successfully.', profile });

    } catch (error) {
        console.error('[sync/login] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
