const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const V12_ADDRESS = "0x369aBcD44d3D510f4a20788BBa6F47C99e57d267"; // DailyAppV12Secured (legacy)
    const V13_ADDRESS = process.env.VITE_DAILY_APP_V13_ADDRESS || process.env.DAILY_APP_ADDRESS; // New contract

    if (!V12_ADDRESS || !V13_ADDRESS) {
        throw new Error("Missing V12 or V13 addresses in environment variables");
    }

    console.log(`Starting migration from V12 (${V12_ADDRESS}) to V13 (${V13_ADDRESS})...`);

    const v12Contract = await ethers.getContractAt("contracts/DailyAppV12Secured.sol:DailyAppV12Secured", V12_ADDRESS);
    const v13Contract = await ethers.getContractAt("contracts/DailyAppV13.sol:DailyAppV13", V13_ADDRESS);

    // 1. Fetch all users from V12 events using chunked block scanning
    // Base Sepolia public RPC limits eth_getLogs to 10,000 blocks per call
    console.log("Scanning V12 contract events for active users (chunked)...");
    
    const BLOCK_CHUNK = 9000;
    const latestBlock = await ethers.provider.getBlockNumber();
    // DailyAppV12Secured was deployed at block 39766005 on Base Sepolia
    const fromBlock = 39766005;
    
    const uniqueUsers = new Set();

    for (let start = fromBlock; start <= latestBlock; start += BLOCK_CHUNK) {
        const end = Math.min(start + BLOCK_CHUNK - 1, latestBlock);
        process.stdout.write(`\r  Scanning blocks ${start} – ${end} of ${latestBlock}...`);

        try {
            const pointsEvents = await v12Contract.queryFilter(
                v12Contract.filters.PointsSynced(), start, end
            );
            pointsEvents.forEach(e => uniqueUsers.add(e.args[0]));

            const transferEvents = await v12Contract.queryFilter(
                v12Contract.filters.Transfer(ethers.ZeroAddress, null, null), start, end
            );
            transferEvents.forEach(e => uniqueUsers.add(e.args[1]));
        } catch (err) {
            // Skip ranges that fail silently (e.g. empty range)
            if (!err.message.includes('range')) throw err;
        }
    }
    console.log(`\nFound ${uniqueUsers.size} unique users.`);

    const usersToMigrate = Array.from(uniqueUsers);

    if (usersToMigrate.length === 0) {
        console.log("No users found to migrate.");
        return;
    }

    console.log(`Found ${usersToMigrate.length} unique users to migrate. Fetching states...`);

    const statsArray = [];
    const maxSyncedXp = [];

    for (let i = 0; i < usersToMigrate.length; i++) {
        const user = usersToMigrate[i];
        const stats = await v12Contract.userStats(user);
        
        // stats object natively returned by ethers v6 from a struct mapping
        // We construct it exactly as expected by the Solidity UserStats struct
        statsArray.push({
            points: stats.points,
            totalTasksCompleted: stats.totalTasksCompleted,
            referralCount: stats.referralCount,
            currentTier: stats.currentTier,
            tasksForReferralProgress: stats.tasksForReferralProgress,
            lastDailyBonusClaim: stats.lastDailyBonusClaim,
            isBlacklisted: stats.isBlacklisted
        });
        
        // All existing points on V12 are considered "synced"
        maxSyncedXp.push(stats.points); 
    }

    // 2. Execute migration in batches to prevent out-of-gas errors
    const BATCH_SIZE = 50;
    console.log(`Executing batchMigrateUsers on V13 in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < usersToMigrate.length; i += BATCH_SIZE) {
        const batchUsers = usersToMigrate.slice(i, i + BATCH_SIZE);
        const batchStats = statsArray.slice(i, i + BATCH_SIZE);
        const batchMaxSyncedXp = maxSyncedXp.slice(i, i + BATCH_SIZE);

        console.log(`Migrating batch ${Math.floor(i/BATCH_SIZE) + 1} (${batchUsers.length} users)...`);
        const tx = await v13Contract.batchMigrateUsers(batchUsers, batchStats, batchMaxSyncedXp);
        await tx.wait();
    }

    console.log("✅ Migration completed successfully!");
}

main().catch(console.error);
