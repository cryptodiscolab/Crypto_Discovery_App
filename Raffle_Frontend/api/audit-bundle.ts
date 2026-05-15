/* eslint-disable @typescript-eslint/no-explicit-any */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyMessage, keccak256, toBytes, formatEther } from 'viem';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    rpcClient,
    isMainnet,
    MASTER_X_ADDRESS,
    NEYNAR_API_KEY,
    MASTER_X_EVENT_ABI,
    DAILY_APP_EVENT_ABI,
    USDC_ADDRESS,
    getEnv,
    sanitizeError
} from './_shared/constants.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = getEnv('CRON_SECRET', '');

const DAILY_APP_ADDRESS = isMainnet 
    ? getEnv('VITE_V12_CONTRACT_ADDRESS') 
    : getEnv('DAILY_APP_ADDRESS', getEnv('VITE_V12_CONTRACT_ADDRESS_SEPOLIA'));

const TASK_IDS = {
    REFERRAL_XP: getEnv('REFERRAL_TASK_ID', "12e123f5-0ded-4ca1-af04-e8b6924823e2"),
    ONCHAIN_TASK: getEnv('ONCHAIN_TASK_ID', "885535d2-4c5c-4a80-9af5-36666192c244"),
    TIER_UPGRADE: getEnv('TIER_UPGRADE_TASK_ID', "2c1e23f5-0ded-4ca1-af04-e8b6924823e2")
};

function makeId(seed: string) {
    const hash = keccak256(toBytes(seed));
    return [
        hash.slice(2, 10), hash.slice(10, 14), hash.slice(14, 18), hash.slice(18, 22), hash.slice(22, 34)
    ].join("-");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    try {
        switch (action) {
            case 'check': await handleFarcasterCheck(req, res); break;
            case 'sync': await handleSyncEvents(req, res); break;
            case 'rpc': await handleRpcProxy(req, res); break;
            default:
                return res.status(400).json({ error: "Invalid action" });
        }
    } catch (error: any) {
        return res.status(500).json({ error: sanitizeError(error) });
    }
}

async function handleRpcProxy(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { method } = req.body;
    const ALLOWED = ['eth_sendRawTransaction', 'eth_getTransactionCount', 'eth_chainId', 'eth_gasPrice', 'eth_call', 'eth_estimateGas', 'eth_blockNumber', 'eth_getTransactionReceipt', 'eth_getCode', 'eth_getBalance'];
    if (!ALLOWED.includes(method)) return res.status(403).json({ error: 'Method not allowed' });

    const ALCHEMY_KEY = getEnv('VITE_ALCHEMY_API_KEY', getEnv('ALCHEMY_API_KEY'));
    const CHAIN_ID = req.query.chainId || '84532';
    const targetRpc = CHAIN_ID === '8453' ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    try {
        const response = await fetch(targetRpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (e: any) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}

async function handleFarcasterCheck(req: VercelRequest, res: VercelResponse) {
    const { address, signature, message } = req.query as { address: string, signature?: string, message?: string };
    const clean = address.toLowerCase();

    if (signature && message) {
        const valid = await verifyMessage({ address: clean as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
        const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${clean}`, {
            headers: { 'api_key': NEYNAR_API_KEY || '' }
        });
        const data = await response.json();
        const user = data[clean]?.[0] || null;
        return res.status(user ? 200 : 404).json(user);
    } catch (e: any) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}

async function handleSyncEvents(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();
    const authHeader = req.headers['authorization'];
    if (!CRON_SECRET) return res.status(500).json({ error: "CRON_SECRET not configured" });
    if (authHeader !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { data: state } = await supabase.from("sync_state").select("last_synced_block").eq("id", "main").maybeSingle();
        const lastBlock = BigInt(state?.last_synced_block ?? 0);
        const latestBlock = await rpcClient.getBlockNumber();

        if (latestBlock <= lastBlock) return res.json({ status: "no_new_blocks" });

        const fromBlock = lastBlock + 1n;
        const toBlock = latestBlock > fromBlock + 2000n ? fromBlock + 2000n : latestBlock;

        const [pointLogs, taskLogs, upgradeLogs, , rewardLogs] = await Promise.all([
            rpcClient.getLogs({ address: MASTER_X_ADDRESS as `0x${string}`, event: MASTER_X_EVENT_ABI[0], fromBlock, toBlock }),
            rpcClient.getLogs({ address: DAILY_APP_ADDRESS as `0x${string}`, event: DAILY_APP_EVENT_ABI[0], fromBlock, toBlock }),
            rpcClient.getLogs({ address: MASTER_X_ADDRESS as `0x${string}`, event: MASTER_X_EVENT_ABI[1], fromBlock, toBlock }),
            rpcClient.getLogs({ address: MASTER_X_ADDRESS as `0x${string}`, event: MASTER_X_EVENT_ABI[2], fromBlock, toBlock }),
            rpcClient.getLogs({ address: DAILY_APP_ADDRESS as `0x${string}`, event: DAILY_APP_EVENT_ABI[1], fromBlock, toBlock }),
        ]);

        const rows: any[] = [];

        for (const log of pointLogs) {
            const { user, points, reason } = log.args as any;
            const wallet = user.toLowerCase();
            const xp = Number(points);
            rows.push({
                id: makeId(`MX_P_${log.transactionHash}_${log.logIndex}`),
                wallet_address: wallet,
                task_id: TASK_IDS.REFERRAL_XP,
                xp_earned: xp,
                claimed_at: new Date().toISOString(),
                tx_hash: log.transactionHash,
                source: `MasterX:${reason}`
            });
            await logActivity(supabase, { wallet, category: 'XP', type: 'Reward', description: reason, amount: xp, symbol: 'XP', txHash: log.transactionHash });
        }

        for (const log of taskLogs) {
            const { user, taskId, reward, timestamp } = log.args as any;
            const wallet = user.toLowerCase();
            const xp = Number(reward);
            rows.push({
                id: makeId(`DA_T_${log.transactionHash}_${log.logIndex}`),
                wallet_address: wallet,
                task_id: TASK_IDS.ONCHAIN_TASK,
                xp_earned: xp,
                claimed_at: new Date(Number(timestamp) * 1000).toISOString(),
                tx_hash: log.transactionHash,
                source: `DailyApp:task_${taskId}`
            });
            await logActivity(supabase, { wallet, category: 'XP', type: 'Task', description: `Task #${taskId}`, amount: xp, symbol: 'XP', txHash: log.transactionHash });
        }

        for (const log of upgradeLogs) {
            const { user, oldTier, newTier, xpBurned } = log.args as any;
            const wallet = user.toLowerCase();
            const burn = Number(xpBurned);
            rows.push({
                id: makeId(`MX_U_${log.transactionHash}_${log.logIndex}`),
                wallet_address: wallet,
                task_id: TASK_IDS.TIER_UPGRADE,
                xp_earned: -burn,
                claimed_at: new Date().toISOString(),
                tx_hash: log.transactionHash,
                source: `TierUpgrade:${oldTier}->${newTier}`
            });
            await supabase.from('user_profiles').update({ tier: Number(newTier) }).eq('wallet_address', wallet);
            // Persistent SBT / Tier Upgrade log for profile and admin filters
            await logActivity(supabase, { wallet, category: 'SBT', type: 'Tier Upgrade Synced', description: `Tier ${Number(oldTier)} → ${Number(newTier)} (XP burned: ${burn})`, amount: burn, symbol: 'XP', txHash: log.transactionHash });
        }

        for (const log of rewardLogs) {
            const { user, token, amount } = log.args as any;
            const wallet = user.toLowerCase();
            const isUsdc = token.toLowerCase() === USDC_ADDRESS.toLowerCase();
            const symbol = isUsdc ? 'USDC' : 'ETH';
            const norm = isUsdc ? Number(amount) / 1e6 : Number(formatEther(amount));
            await logActivity(supabase, { wallet, category: 'REWARD', type: 'Payout', description: `Claimed ${norm} ${symbol}`, amount: norm, symbol, txHash: log.transactionHash });
        }

        if (rows.length > 0) await supabase.from("user_task_claims").upsert(rows, { onConflict: "id" });
        await supabase.from("sync_state").upsert({ id: "main", last_synced_block: Number(toBlock), updated_at: new Date().toISOString() });

        return res.json({ status: "ok", scanned: `${fromBlock}->${toBlock}`, duration: Date.now() - startTime });
    } catch (e: any) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}

async function logActivity(supabase: SupabaseClient, { wallet, category, type, description, amount, symbol, txHash }: any) {
    await supabase.from('user_activity_logs').insert({
        wallet_address: wallet.toLowerCase(),
        category,
        activity_type: type,
        description,
        value_amount: amount || 0,
        value_symbol: symbol || 'XP',
        tx_hash: txHash
    });
}
