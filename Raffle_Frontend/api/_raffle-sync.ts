/* eslint-disable @typescript-eslint/no-explicit-any */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    rpcClient,
    isMainnet,
    RAFFLE_EVENT_ABI,
    RAFFLE_ABI,
    getEnv,
    sanitizeError,
    ZERO_ADDRESS
} from './_shared/constants.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = getEnv('CRON_SECRET', '');
const MAX_BLOCK_RANGE = 2000n;

const RAFFLE_ADDRESS = isMainnet 
    ? getEnv('VITE_RAFFLE_ADDRESS') 
    : getEnv('VITE_RAFFLE_ADDRESS_SEPOLIA');

function isOnChainTrue(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === 1n;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();
    const authHeader = req.headers['authorization'];
    if (!CRON_SECRET) return res.status(500).json({ error: "CRON_SECRET not configured" });
    if (authHeader !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: "Unauthorized" });

    if (!RAFFLE_ADDRESS || RAFFLE_ADDRESS === '[RESERVED]') return res.status(500).json({ error: "Config missing" });

    try {
        const { data: syncState, error: syncErr } = await supabase.from('raffle_sync_state').select('last_synced_block').eq('id', 'primary_sync').maybeSingle();
        if (syncErr) console.warn('[raffle-sync] sync state read error:', syncErr.message);
        // If state row doesn't exist, initialize it
        if (!syncState) {
            await supabase.from('raffle_sync_state').upsert({ id: 'primary_sync', last_synced_block: 0 });
        }
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
        const touchedRaffleIds = new Set<number>();

        if (creationLogs.length > 0) {
            creationLogs.forEach(log => touchedRaffleIds.add(Number((log.args as any).raffleId)));
        }

        if (ticketLogs.length > 0) {
            const inserts = ticketLogs.map(log => ({
                raffle_id: Number((log.args as any).raffleId),
                wallet_address: (log.args as any).user.toLowerCase(),
                ticket_count: Number((log.args as any).count),
                tx_hash: log.transactionHash
            }));
            inserts.forEach(row => touchedRaffleIds.add(row.raffle_id));
            await supabase.from('raffle_tickets').upsert(inserts, { onConflict: 'tx_hash' });
        }

        if (winnerLogs.length > 0) {
            winnerLogs.forEach(log => touchedRaffleIds.add(Number((log.args as any).raffleId)));
        }

        const { data: activeRows } = await supabase
            .from('raffles')
            .select('id')
            .eq('is_active', true)
            .limit(25);
        (activeRows || []).forEach((row: { id: number }) => touchedRaffleIds.add(Number(row.id)));

        if (touchedRaffleIds.size > 0) {
            const touchedIds = Array.from(touchedRaffleIds);
            const { data: existingRaffles } = await supabase
                .from('raffles')
                .select('id, finalized_at, claim_deadline_at')
                .in('id', touchedIds);
            const existingById = new Map(
                (existingRaffles || []).map((row: any) => [Number(row.id), row])
            );

            for (const raffleId of touchedRaffleIds) {
                try {
                    const info = await rpcClient.readContract({
                        address: RAFFLE_ADDRESS as `0x${string}`,
                        abi: RAFFLE_ABI,
                        functionName: 'getRaffleInfo',
                        args: [BigInt(raffleId)]
                    }) as any;
                    const isActive = isOnChainTrue(info.isActive ?? info[9]);
                    const isFinalized = isOnChainTrue(info.isFinalized ?? info[10]);
                    const existing = existingById.get(raffleId);
                    const finalizedAt = existing?.finalized_at || (isFinalized ? new Date().toISOString() : null);
                    const claimDeadlineAt = existing?.claim_deadline_at || (finalizedAt ? new Date(new Date(finalizedAt).getTime() + 72 * 60 * 60 * 1000).toISOString() : null);
                    const sponsor = String(info.sponsor ?? info[11] ?? ZERO_ADDRESS).toLowerCase();
                    const nowIso = new Date().toISOString();
                    const update: Record<string, unknown> = {
                        is_active: isActive,
                        is_finalized: isFinalized,
                        prize_pool: Number(info.prizePool ?? info[4] ?? 0n) / 1e18,
                        prize_per_winner: Number(info.prizePerWinner ?? info[14] ?? 0n) / 1e18,
                        max_tickets: Number(info.maxTickets ?? info[2] ?? 0n),
                        winner_count: Number(info.winnerCount ?? info[7] ?? 0n),
                        metadata_uri: String(info.metadataURI ?? info[12] ?? ''),
                        end_time: Number(info.endTime ?? info[13] ?? 0n) > 0
                            ? new Date(Number(info.endTime ?? info[13]) * 1000).toISOString()
                            : null,
                        updated_at: nowIso
                    };
                    if (isFinalized) {
                        update.finalized_at = finalizedAt;
                        update.claim_deadline_at = claimDeadlineAt;
                    }

                    const { data: updatedRows, error: updateErr } = await supabase
                        .from('raffles')
                        .update(update)
                        .eq('id', raffleId)
                        .select('id');
                    if (updateErr) throw updateErr;

                    if (!updatedRows || updatedRows.length === 0) {
                        const { error: insertErr } = await supabase
                            .from('raffles')
                            .insert({
                                id: raffleId,
                                creator_address: sponsor,
                                sponsor_address: sponsor,
                                category: 'NFT',
                                ...update,
                                created_at: nowIso
                            });
                        if (insertErr) throw insertErr;
                    }
                } catch (stateErr: any) {
                    console.warn(`[raffle-sync] state refresh failed for #${raffleId}:`, stateErr?.message || String(stateErr));
                }
            }
        }

        await supabase.from('raffle_sync_state').update({ last_synced_block: toBlock.toString(), updated_at: new Date().toISOString() }).eq('id', 'primary_sync');

        return res.json({ success: true, from: fromBlock.toString(), to: toBlock.toString(), duration: Date.now() - startTime });
    } catch (e: any) {
        return res.status(500).json({ error: sanitizeError(e) });
    }
}
