/**
 * POST /api/user/sync-xp
 * =======================
 * Membaca XP on-chain dari DailyAppV12 lalu update DB.
 * Dipanggil setelah transaksi on-chain berhasil (claimDailyBonus, doTask, dll).
 *
 * Body: { wallet_address: string, tx_hash: string }
 *
 * Zero Trust: kita verifikasi langsung ke RPC, bukan percaya body user.
 */

import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ABI minimal untuk getUserStats
const DAILY_APP_ABI_MINIMAL = [
    {
        "inputs": [{ "name": "_user", "type": "address" }],
        "name": "getUserStats",
        "outputs": [
            {
                "components": [
                    { "name": "points", "type": "uint256" },
                    { "name": "totalTasksCompleted", "type": "uint256" },
                    { "name": "referralCount", "type": "uint256" },
                    { "name": "currentTier", "type": "uint8" },
                    { "name": "tasksForReferralProgress", "type": "uint256" },
                    { "name": "lastDailyBonusClaim", "type": "uint256" },
                    { "name": "isBlacklisted", "type": "bool" }
                ],
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const DAILY_APP_ADDRESS = process.env.VITE_V12_CONTRACT_ADDRESS || "0xEF8ab11E070359B9C0aA367656893B029c1d04d4";

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.VITE_BASE_SEPOLIA_RPC || "https://sepolia.base.org"),
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { wallet_address } = req.body || {};
    if (!wallet_address || !wallet_address.startsWith('0x')) {
        return res.status(400).json({ error: 'Invalid wallet_address' });
    }

    const cleanWallet = wallet_address.trim().toLowerCase();

    try {
        // 1. Baca XP langsung dari chain (tidak percaya input user)
        const stats = await publicClient.readContract({
            address: DAILY_APP_ADDRESS,
            abi: DAILY_APP_ABI_MINIMAL,
            functionName: 'getUserStats',
            args: [wallet_address],
        });

        const onChainXP = Number(stats.points);
        const tasksCompleted = Number(stats.totalTasksCompleted);
        const lastDailyBonusClaim = Number(stats.lastDailyBonusClaim);
        const lastClaimAt = lastDailyBonusClaim > 0
            ? new Date(lastDailyBonusClaim * 1000).toISOString()
            : null;

        // 2. Update DB dengan data on-chain yang terverifikasi
        const { error } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                wallet_address: cleanWallet,
                total_xp: onChainXP,
                tasks_completed: tasksCompleted,
                last_daily_claim_at: lastClaimAt,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'wallet_address' });

        if (error) {
            console.error('[sync-xp] DB upsert error:', error.code, error.message);
            return res.status(500).json({ error: 'Internal server error' });
        }

        return res.status(200).json({
            ok: true,
            xp: onChainXP,
            tasksCompleted,
            lastClaimAt,
        });

    } catch (err) {
        console.error('[sync-xp] Fatal:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
