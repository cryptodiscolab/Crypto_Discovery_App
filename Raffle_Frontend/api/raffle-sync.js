import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { baseSepolia, base } from 'viem/chains';

// --- CONFIG ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const CHAIN_ID = (process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '84532').trim();
const isMainnet = CHAIN_ID === '8453';

const RAFFLE_ADDRESS = isMainnet
    ? (process.env.VITE_RAFFLE_ADDRESS || process.env.RAFFLE_ADDRESS)
    : process.env.VITE_RAFFLE_ADDRESS_SEPOLIA;

const RPC_URL = isMainnet
    ? (process.env.VITE_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org')
    : (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const publicClient = createPublicClient({
    chain: isMainnet ? base : baseSepolia,
    transport: http(RPC_URL)
});

// Maximum block range per sync to avoid RPC timeouts
const MAX_BLOCK_RANGE = 2000n;

// ABI Items for Events
const TicketPurchasedEvent = parseAbiItem('event TicketPurchased(address indexed user, uint256 indexed raffleId, uint256 count)');
const RaffleCreatedEvent = parseAbiItem('event RaffleCreated(uint256 indexed raffleId, uint256 timestamp)');
const RaffleWinnerEvent = parseAbiItem('event RaffleWinner(uint256 indexed raffleId, address indexed winner, uint256 prize)');

export default async function handler(req, res) {
    const startTime = Date.now();
    
    // 1. Security Check
    const authHeader = req.headers['authorization'];
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn("🔐 [Raffle Sync] Unauthorized access attempt.");
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (!RAFFLE_ADDRESS || RAFFLE_ADDRESS === '[RESERVED]') {
        return res.status(500).json({ error: "Raffle address not configured" });
    }

    console.log("🔄 [Raffle Sync] Starting event indexing pipeline...");

    try {
        // 2. Fetch Last Synced Block
        const { data: syncState, error: syncError } = await supabase
            .from('raffle_sync_state')
            .select('last_synced_block')
            .eq('id', 'primary_sync')
            .single();

        if (syncError) throw new Error(`Failed to fetch sync state: ${syncError.message}`);
        
        let fromBlock = BigInt(syncState.last_synced_block);
        const latestBlock = await publicClient.getBlockNumber();

        // If it's a completely fresh start (0), we shouldn't scan from genesis. 
        // We'll scan the last 2000 blocks as a safety measure.
        if (fromBlock === 0n) {
            fromBlock = latestBlock > MAX_BLOCK_RANGE ? latestBlock - MAX_BLOCK_RANGE : 0n;
        } else {
            // Avoid missing events that happened right at the last synced block
            fromBlock = fromBlock + 1n;
        }

        if (fromBlock > latestBlock) {
            return res.status(200).json({ message: "Already up to date", last_synced_block: latestBlock.toString() });
        }

        let toBlock = fromBlock + MAX_BLOCK_RANGE;
        if (toBlock > latestBlock) toBlock = latestBlock;

        console.log(`📡 [Raffle Sync] Scanning blocks ${fromBlock} to ${toBlock} (Latest: ${latestBlock})`);

        // 3. Fetch Events
        const [ticketLogs, creationLogs, winnerLogs] = await Promise.all([
            publicClient.getLogs({
                address: RAFFLE_ADDRESS,
                event: TicketPurchasedEvent,
                fromBlock,
                toBlock
            }),
            publicClient.getLogs({
                address: RAFFLE_ADDRESS,
                event: RaffleCreatedEvent,
                fromBlock,
                toBlock
            }),
            publicClient.getLogs({
                address: RAFFLE_ADDRESS,
                event: RaffleWinnerEvent,
                fromBlock,
                toBlock
            })
        ]);

        // 4. Process Raffle Creations
        if (creationLogs.length > 0) {
            console.log(`Found ${creationLogs.length} RaffleCreated events.`);
            const raffleInserts = creationLogs.map(log => ({
                id: Number(log.args.raffleId),
                created_at: new Date(Number(log.args.timestamp) * 1000).toISOString(),
                is_active: true,
                is_finalized: false
            }));

            // Upsert basic info. Full info will be populated via Vercel Cron reading contract state periodically,
            // or we just initialize it here so the ID exists.
            const { error: insertError } = await supabase
                .from('raffles')
                .upsert(raffleInserts, { onConflict: 'id' });
            
            if (insertError) console.error("[Raffle Sync] Error upserting raffles:", insertError.message);
        }

        // 5. Process Ticket Purchases
        if (ticketLogs.length > 0) {
            console.log(`Found ${ticketLogs.length} TicketPurchased events.`);
            const ticketInserts = ticketLogs.map(log => ({
                raffle_id: Number(log.args.raffleId),
                wallet_address: log.args.user.toLowerCase(),
                ticket_count: Number(log.args.count),
                tx_hash: log.transactionHash
            }));

            // Upsert to handle potential duplicate processing
            const { error: ticketError } = await supabase
                .from('raffle_tickets')
                .upsert(ticketInserts, { onConflict: 'tx_hash' });
            
            if (ticketError) console.error("[Raffle Sync] Error upserting tickets:", ticketError.message);
        }

        // 6. Process Winners (Finalization)
        if (winnerLogs.length > 0) {
            console.log(`Found ${winnerLogs.length} RaffleWinner events.`);
            const winnerUpdates = winnerLogs.map(log => ({
                id: Number(log.args.raffleId),
                is_active: false,
                is_finalized: true
            }));

            const { error: winnerError } = await supabase
                .from('raffles')
                .upsert(winnerUpdates, { onConflict: 'id' });
            
            if (winnerError) console.error("[Raffle Sync] Error updating winners:", winnerError.message);
        }

        // 7. Update Sync State
        const { error: stateError } = await supabase
            .from('raffle_sync_state')
            .update({ last_synced_block: toBlock.toString(), updated_at: new Date().toISOString() })
            .eq('id', 'primary_sync');

        if (stateError) throw new Error(`Failed to update sync state: ${stateError.message}`);

        const duration = Date.now() - startTime;
        console.log(`✅ [Raffle Sync] Completed successfully in ${duration}ms. Block: ${toBlock}`);

        return res.status(200).json({
            success: true,
            synced_from: fromBlock.toString(),
            synced_to: toBlock.toString(),
            events_processed: {
                tickets: ticketLogs.length,
                creations: creationLogs.length,
                winners: winnerLogs.length
            },
            duration_ms: duration
        });

    } catch (error) {
        console.error("❌ [Raffle Sync] Critical Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
