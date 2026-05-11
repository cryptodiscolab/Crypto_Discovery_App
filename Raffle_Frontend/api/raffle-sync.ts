import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    rpcClient,
    isMainnet,
    RAFFLE_EVENT_ABI,
    getEnv,
    sanitizeError
} from './constants';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = getEnv('CRON_SECRET', '');
const MAX_BLOCK_RANGE = 2000n;

const RAFFLE_ADDRESS = isMainnet 
    ? getEnv('VITE_RAFFLE_ADDRESS') 
    : getEnv('VITE_RAFFLE_ADDRESS_SEPOLIA');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();
    const authHeader = req.headers['authorization'];
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: "Unauthorized" });

    if (!RAFFLE_ADDRESS || RAFFLE_ADDRESS === '[RESERVED]') return res.status(500).json({ error: "Config missing" });

    try {
        const { data: syncState } = await supabase.from('raffle_sync_state').select('last_synced_block').eq('id', 'primary_sync').single();
        let fromBlock = BigInt(syncState?.last_synced_block || 0);
        const latestBlock = await rpcClient.getBlockNumber();

        if (fromBlock === 0n) {
            fromBlock = latestBlock > MAX_BLOCK_RANGE ? latestBlock - MAX_BLOCK_RANGE : 0n;
        } else {
            fromBlock = fromBlock + 1n;
        }

        if (fromBlock > latestBlock) return res.status(200).json({ message: "Up to date" });

        const toBlock = fromBlock + MAX_BLOCK_RANGE > latestBlock ? latestBlock : fromBlock + MAX_BLOCK_RANGE;

        const [ticketLogs, creationLogs, winnerLogs] = await Promise.all([
            rpcClient.getLogs({ address: RAFFLE_ADDRESS as `0x${string}`, event: RAFFLE_EVENT_ABI[0], fromBlock, toBlock }),
            rpcClient.getLogs({ address: RAFFLE_ADDRESS as `0x${string}`, event: RAFFLE_EVENT_ABI[1], fromBlock, toBlock }),
            rpcClient.getLogs({ address: RAFFLE_ADDRESS as `0x${string}`, event: RAFFLE_EVENT_ABI[2], fromBlock, toBlock }),
        ]);

        if (creationLogs.length > 0) {
            const inserts = creationLogs.map(log => ({
                id: Number((log.args as any).raffleId),
                created_at: new Date(Number((log.args as any).timestamp) * 1000).toISOString(),
                is_active: true,
                is_finalized: false
            }));
            await supabase.from('raffles').upsert(inserts, { onConflict: 'id' });
        }

        if (ticketLogs.length > 0) {
            const inserts = ticketLogs.map(log => ({
                raffle_id: Number((log.args as any).raffleId),
                wallet_address: (log.args as any).user.toLowerCase(),
                ticket_count: Number((log.args as any).count),
                tx_hash: log.transactionHash
            }));
            await supabase.from('raffle_tickets').upsert(inserts, { onConflict: 'tx_hash' });
        }

        if (winnerLogs.length > 0) {
            const updates = winnerLogs.map(log => ({
                id: Number((log.args as any).raffleId),
                is_active: false,
                is_finalized: true
            }));
            await supabase.from('raffles').upsert(updates, { onConflict: 'id' });
        }

        await supabase.from('raffle_sync_state').update({ last_synced_block: toBlock.toString(), updated_at: new Date().toISOString() }).eq('id', 'primary_sync');

        return res.json({ success: true, from: fromBlock.toString(), to: toBlock.toString(), duration: Date.now() - startTime });
    } catch (e: any) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}
