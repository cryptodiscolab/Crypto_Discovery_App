import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, getEnv, sanitizeError } from './_shared/constants.js';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CHAIN_ID = Number(getEnv('VITE_CHAIN_ID', '84532'));
const chain = CHAIN_ID === 8453 ? base : baseSepolia;
const RPC_URL = CHAIN_ID === 8453 
    ? getEnv('BASE_MAINNET_RPC_URL', 'https://mainnet.base.org')
    : getEnv('BASE_SEPOLIA_RPC_URL', 'https://sepolia.base.org');
// Server-side env: prefer V15_CONTRACT_ADDRESS, fallback to legacy VITE_V12 naming
const V15_ADDRESS = getEnv('V15_CONTRACT_ADDRESS', getEnv('VITE_V12_CONTRACT_ADDRESS_SEPOLIA', '')) as `0x${string}`;
const PRIVATE_KEY = getEnv('PRIVATE_KEY') as `0x${string}`;

const BATCH_MIGRATE_ABI = [{
    name: 'batchMigrateUsers', type: 'function', stateMutability: 'nonpayable',
    inputs: [
        { name: '_users', type: 'address[]' },
        { name: '_stats', type: 'tuple[]', components: [
            { name: 'points', type: 'uint256' },
            { name: 'totalTasksCompleted', type: 'uint256' },
            { name: 'referralCount', type: 'uint256' },
            { name: 'currentTier', type: 'uint8' },
            { name: 'tasksForReferralProgress', type: 'uint256' },
            { name: 'lastDailyBonusClaim', type: 'uint256' },
            { name: 'isBlacklisted', type: 'bool' }
        ]},
        { name: '_maxSyncedXp', type: 'uint256[]' }
    ],
    outputs: []
}];

const USER_STATS_ABI = [{
    name: 'userStats', type: 'function', stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [
        { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
        { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }
    ]
}];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Auth: cron secret (fail-closed)
    const authHeader = req.headers.authorization;
    const cronSecret = getEnv('CRON_SECRET');
    if (!cronSecret) {
        return res.status(500).json({ error: 'CRON_SECRET not configured' });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        if (!V15_ADDRESS || !PRIVATE_KEY) {
            return res.status(500).json({ error: 'Missing V15_ADDRESS or PRIVATE_KEY' });
        }

        // Chain ID assertion: verify we're targeting the expected network
        const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
        const liveChainId = await publicClient.getChainId();
        if (liveChainId !== CHAIN_ID) {
            return res.status(500).json({ error: `Chain ID mismatch: expected ${CHAIN_ID}, got ${liveChainId}` });
        }

        // 1. Fetch all users from DB
        const { data: users } = await supabaseAdmin
            .from('user_profiles')
            .select('wallet_address, total_xp, tier')
            .order('total_xp', { ascending: false });

        if (!users || users.length === 0) {
            return res.status(200).json({ success: true, message: 'No users to sync', synced: 0 });
        }

        // 2. Read on-chain XP for each user
        const drifted: { address: string; dbXp: number; onchainXp: number; tier: number }[] = [];

        for (const u of users) {
            try {
                const stats = await publicClient.readContract({
                    address: V15_ADDRESS, abi: USER_STATS_ABI,
                    functionName: 'userStats', args: [u.wallet_address as `0x${string}`]
                }) as [bigint, bigint, bigint, number, bigint, bigint, boolean];

                const onchainXp = Number(stats[0]);
                const dbXp = u.total_xp || 0;
                if (dbXp > onchainXp) {
                    drifted.push({ address: u.wallet_address, dbXp, onchainXp, tier: u.tier || 0 });
                }
            } catch { /* new user not on-chain yet */
                drifted.push({ address: u.wallet_address, dbXp: u.total_xp || 0, onchainXp: 0, tier: u.tier || 0 });
            }
        }

        if (drifted.length === 0) {
            return res.status(200).json({ success: true, message: 'All users synced', synced: 0 });
        }

        // 3. Batch migrate drifted users
        const account = privateKeyToAccount(PRIVATE_KEY);
        const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

        const addresses = drifted.map(d => d.address as `0x${string}`);
        const stats = drifted.map(d => ({
            points: BigInt(d.dbXp),
            totalTasksCompleted: 0n,
            referralCount: 0n,
            currentTier: d.tier,
            tasksForReferralProgress: 0n,
            lastDailyBonusClaim: 0n,
            isBlacklisted: false
        }));
        const maxSyncedXp = drifted.map(d => BigInt(d.dbXp));

        const hash = await walletClient.writeContract({
            address: V15_ADDRESS,
            abi: BATCH_MIGRATE_ABI,
            functionName: 'batchMigrateUsers',
            args: [addresses, stats, maxSyncedXp]
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // 4. Log
        await supabaseAdmin.from('user_activity_logs').insert(
            drifted.map(d => ({
                wallet_address: d.address.toLowerCase(),
                category: 'XP',
                activity_type: 'onchain_sync',
                description: `Auto-sync DB→V15: ${d.dbXp} XP (was ${d.onchainXp})`,
                tx_hash: hash
            }))
        );

        return res.status(200).json({
            success: true,
            synced: drifted.length,
            tx_hash: hash,
            status: receipt.status
        });
    } catch (err: unknown) {
        console.error('[sync-xp-onchain]', err);
        return res.status(500).json({ error: sanitizeError(err) });
    }
}
