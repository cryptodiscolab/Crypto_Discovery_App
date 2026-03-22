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
    const TOTAL_RANGE = 40000000;
    const latestBlock = await ethers.provider.getBlockNumber();

    const fetchContractEvents = async (contract, eventName) => {
        let allEvents = [];
        const filter = contract.filters[eventName]();
        for (let i = 0; i < TOTAL_RANGE; i += CHUNK_SIZE) {
            const fromBlock = Math.max(0, latestBlock - i - CHUNK_SIZE);
            const toBlock = Math.max(0, latestBlock - i);
            if (toBlock === 0) break;
            console.log(`📡 Fetching ${eventName} events from block ${fromBlock} to ${toBlock}...`);
            const events = await contract.queryFilter(filter, fromBlock, toBlock);
            allEvents = allEvents.concat(events);
            if (fromBlock === 0) break;
        }
        return allEvents;
    };

    const fetchDailyAppLogs = async () => {
        let allLogs = [];
        const topic0 = '0x146b4b2e55f6b6a4a8ac8239494150cd5f96b163e2d019440f369714f4a31eb8';
        for (let i = 0; i < TOTAL_RANGE; i += CHUNK_SIZE) {
            const fromBlock = Math.max(0, latestBlock - i - CHUNK_SIZE);
            const toBlock = Math.max(0, latestBlock - i);
            if (toBlock === 0) break;
            console.log(`📡 Fetching DailyApp logs from block ${fromBlock} to ${toBlock}...`);
            const logs = await ethers.provider.getLogs({
                address: DAILY_APP_ADDRESS,
                fromBlock,
                toBlock,
                topics: [topic0]
            });
            allLogs = allLogs.concat(logs);
            if (fromBlock === 0) break;
        }
        return allLogs;
    };

    const DAILY_TASK_UUID = '885535d2-4c5c-4a80-9af5-36666192c244';
    const RAFFLE_TASK_UUID = '12e123f5-0ded-4ca1-af04-e8b6924823e2';
    const BURN_TASK_UUID = '2c1e23f5-0ded-4ca1-af04-e8b6924823e2'; // System: Tier Ascension

    const generateUUID = (seed) => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
        return `${hash.slice(2, 10)}-${hash.slice(10, 14)}-${hash.slice(14, 18)}-${hash.slice(18, 22)}-${hash.slice(22, 34)}`;
    };

    const logActivity = async ({ wallet, category, type, description, amount, symbol, txHash, eventIndex }) => {
        const activityId = generateUUID(`ACTIVITY_${txHash}_${eventIndex}`);
        const { error } = await supabase.from('user_activity_logs').upsert({
            id: activityId,
            wallet_address: wallet.toLowerCase(),
            category,
            activity_type: type,
            description,
            value_amount: amount || 0,
            value_symbol: symbol || 'XP',
            tx_hash: txHash,
            metadata: { event_index: eventIndex },
            created_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (error) console.error(`❌ Activity log failed for ${wallet}:`, error.message);
    };

    console.log("📡 Syncing MasterX PointsAwarded events from:", MASTER_X_ADDRESS);
    const masterEvents = await fetchContractEvents(masterContract, "PointsAwarded");
    console.log(`🔍 Found ${masterEvents.length} PointsAwarded events.`);

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

        if (error) {
            console.error(`❌ MasterX sync failed for ${cleanAddress}:`, error.message);
        } else {
            // New: Log Activity for HypeFeed
            const isReferral = reason.toLowerCase().includes('referral');
            await logActivity({
                wallet: cleanAddress,
                category: 'XP',
                type: isReferral ? 'Referral Reward' : 'Staking Reward',
                description: `Received ${xp} XP ${isReferral ? 'for inviting a user' : `for ${reason}`}`,
                amount: xp,
                symbol: 'XP',
                txHash: event.transactionHash,
                eventIndex: event.logIndex
            });
        }
    }

    console.log("\n🔥 Syncing DailyApp NFT Tier events (XP Burns) from:", DAILY_APP_ADDRESS);
    const mintedEvents = await fetchContractEvents(dailyAppContract, "NFTMinted");
    const upgradedEvents = await fetchContractEvents(dailyAppContract, "NFTUpgraded");
    const tierEvents = [...mintedEvents, ...upgradedEvents];
    console.log(`🔍 Found ${tierEvents.length} NFT Tier events.`);

    // Cache for NFT configs to avoid repeated calls
    const nftConfigsCache = {};

    for (const event of tierEvents) {
        // Handle both NFTMinted and NFTUpgraded event args
        let tier;
        if (event.fragment.name === "NFTMinted") {
            tier = Number(event.args.tier); // Use named args for clarity if available
        } else {
            tier = Number(event.args.newTier);
        }
        
        const cleanAddress = event.args.user.toLowerCase();

        if (!nftConfigsCache[tier]) {
            const config = await dailyAppContract.nftConfigs(tier);
            nftConfigsCache[tier] = Number(config.pointsRequired);
        }

        const xpToBurn = nftConfigsCache[tier];
        if (xpToBurn === 0) continue;

        const eventId = `BURN_${event.transactionHash}_${event.logIndex}`;
        const claimId = generateUUID(eventId);

        console.log(`🔥 Syncing Burn: -${xpToBurn} XP for ${cleanAddress} (Tier ${tier})`);

        const { error } = await supabase.from('user_task_claims').upsert({
            id: claimId,
            wallet_address: cleanAddress,
            task_id: BURN_TASK_UUID,
            xp_earned: -xpToBurn,
            claimed_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (error) {
            console.error(`❌ Burn sync failed for ${cleanAddress}:`, error.message);
        } else {
            // New: Log Activity for HypeFeed (PURCHASE category)
            await logActivity({
                wallet: cleanAddress,
                category: 'PURCHASE',
                type: 'Tier Ascension',
                description: `Upgraded to NFT Tier ${tier} (Burned ${xpToBurn} XP)`,
                amount: -xpToBurn,
                symbol: 'XP',
                txHash: event.transactionHash,
                eventIndex: event.logIndex
            });
        }
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

            if (error) {
                console.error(`❌ DailyApp sync failed for ${user}:`, error.message);
            } else {
                // New: Log Activity for HypeFeed
                await logActivity({
                    wallet: user,
                    category: 'XP',
                    type: 'On-Chain Task',
                    description: `Completed task #${taskId} on-chain`,
                    amount: xp,
                    symbol: 'XP',
                    txHash: log.transactionHash,
                    eventIndex: log.index
                });
            }
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
