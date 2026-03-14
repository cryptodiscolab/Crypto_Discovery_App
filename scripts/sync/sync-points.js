const { ethers } = require("hardhat");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

/**
 * Sync XP points from On-chain Events (PointsAwarded) to Supabase
 * Ensures Raffle Ticket purchases are credited to user leaderboard.
 */
async function main() {
    const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS;
    const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!MASTER_X_ADDRESS || !DAILY_APP_ADDRESS || !SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ Missing config (MASTER_X_ADDRESS, DAILY_APP_ADDRESS, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY)");
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const masterContract = await ethers.getContractAt("CryptoDiscoMasterX", MASTER_X_ADDRESS);
    const dailyAppContract = await ethers.getContractAt("DailyAppV12Secured", DAILY_APP_ADDRESS);

    const CHUNK_SIZE = 10000;
    const TOTAL_RANGE = 500000;
    const latestBlock = await ethers.provider.getBlockNumber();

    const fetchMasterXEvents = async () => {
        let allEvents = [];
        const filter = masterContract.filters.PointsAwarded();
        for (let i = 0; i < TOTAL_RANGE; i += CHUNK_SIZE) {
            const fromBlock = latestBlock - i - CHUNK_SIZE;
            const toBlock = latestBlock - i;
            console.log(`📡 Fetching MasterX events from block ${fromBlock} to ${toBlock}...`);
            const events = await masterContract.queryFilter(filter, fromBlock, toBlock);
            allEvents = allEvents.concat(events);
        }
        return allEvents;
    };

    const fetchDailyAppLogs = async () => {
        let allLogs = [];
        const topic0 = '0x146b4b2e55f6b6a4a8ac8239494150cd5f96b163e2d019440f369714f4a31eb8';
        for (let i = 0; i < TOTAL_RANGE; i += CHUNK_SIZE) {
            const fromBlock = latestBlock - i - CHUNK_SIZE;
            const toBlock = latestBlock - i;
            console.log(`📡 Fetching DailyApp logs from block ${fromBlock} to ${toBlock}...`);
            const logs = await ethers.provider.getLogs({
                address: DAILY_APP_ADDRESS,
                fromBlock,
                toBlock,
                topics: [topic0]
            });
            allLogs = allLogs.concat(logs);
        }
        return allLogs;
    };

    const DAILY_TASK_UUID = '885535d2-4c5c-4a80-9af5-36666192c244';
    const RAFFLE_TASK_UUID = '12e123f5-0ded-4ca1-af04-e8b6924823e2';

    const generateUUID = (seed) => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
        return `${hash.slice(2, 10)}-${hash.slice(10, 14)}-${hash.slice(14, 18)}-${hash.slice(18, 22)}-${hash.slice(22, 34)}`;
    };

    console.log("📡 Syncing MasterX events from:", MASTER_X_ADDRESS);
    const masterEvents = await fetchMasterXEvents();
    console.log(`🔍 Found ${masterEvents.length} MasterX events.`);

    for (const event of masterEvents) {
        const [user, points, reason] = event.args;
        const cleanAddress = user.toLowerCase();
        const xp = Number(points);
        const eventId = `MASTERX_${event.transactionHash}_${event.logIndex}`;
        const claimId = generateUUID(eventId);

        console.log(`✨ Syncing ${reason}: ${xp} XP for ${cleanAddress}`);

        const { error } = await supabase.from('user_task_claims').upsert({
            id: claimId,
            wallet_address: cleanAddress,
            task_id: RAFFLE_TASK_UUID,
            xp_earned: xp,
            claimed_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (error) console.error(`❌ MasterX sync failed for ${cleanAddress}:`, error.message);
    }

    console.log("\n📡 Syncing DailyApp logs (Manual Decode) from:", DAILY_APP_ADDRESS);
    const dailyLogs = await fetchDailyAppLogs();
    console.log(`🔍 Found ${dailyLogs.length} DailyApp logs.`);

    for (const log of dailyLogs) {
        try {
            const tx = await ethers.provider.getTransaction(log.transactionHash);
            const user = tx.from.toLowerCase();
            const taskId = parseInt(log.topics[1], 16);

            const dataBytes = ethers.getBytes?.(log.data) || ethers.utils.arrayify(log.data);
            const rewardRaw = dataBytes.slice(32, 64);
            const xp = Number(ethers.toBigInt?.(rewardRaw) || BigInt('0x' + Buffer.from(rewardRaw).toString('hex')));

            const eventId = `DAILYAPP_${log.transactionHash}_${log.index}`;
            const claimId = generateUUID(eventId);

            console.log(`✨ Syncing Daily Task #${taskId}: ${xp} XP for ${user}`);

            const { error } = await supabase.from('user_task_claims').upsert({
                id: claimId,
                wallet_address: user,
                task_id: DAILY_TASK_UUID,
                xp_earned: xp,
                claimed_at: new Date().toISOString()
            }, { onConflict: 'id' });

            if (error) console.error(`❌ DailyApp sync failed for ${user}:`, error.message);
        } catch (e) {
            console.error(`❌ Failed to decode log in TX ${log.transactionHash}:`, e.message);
        }
    }

    console.log("\n✅ Sync completed.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
