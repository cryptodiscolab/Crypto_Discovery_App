const { ethers } = require("hardhat");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

/**
 * Sync SBT Pool data from smart contract to Supabase
 * Usage: npx hardhat run scripts/sync-sbt.js --network base-sepolia
 */
async function main() {
    const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!MASTER_X_ADDRESS || !SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ Missing configuration in .env (MASTER_X_ADDRESS, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY)");
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get Contract Instance
    // Ensure the ABI is compiled: npx hardhat compile
    const CryptoDiscoMasterX = await ethers.getContractAt("CryptoDiscoMasterX", MASTER_X_ADDRESS);

    console.log("🔍 Fetching SBT Pool data from:", MASTER_X_ADDRESS);

    try {
        // Read Data from Contract
        // ✅ DEPLOYED CONTRACT baru: sudah ada diamond, platinum, dan lastDistributeTimestamp
        const [
            totalSBTPoolBalance,
            diamondAcc,
            platinumAcc,
            goldAcc,
            silverAcc,
            bronzeAcc,
            lastDist,
            totalLocked,
            diamondHolders,
            platinumHolders,
            goldHolders,
            silverHolders,
            bronzeHolders
        ] = await Promise.all([
            CryptoDiscoMasterX.totalSBTPoolBalance(),
            CryptoDiscoMasterX.accRewardPerShare(4), // SBTTier.DIAMOND
            CryptoDiscoMasterX.accRewardPerShare(3), // SBTTier.PLATINUM
            CryptoDiscoMasterX.accRewardPerShare(2), // SBTTier.GOLD
            CryptoDiscoMasterX.accRewardPerShare(1), // SBTTier.SILVER
            CryptoDiscoMasterX.accRewardPerShare(0), // SBTTier.BRONZE (NONE=0 skip)
            CryptoDiscoMasterX.lastDistributeTimestamp(),
            CryptoDiscoMasterX.totalLockedRewards(),
            CryptoDiscoMasterX.diamondHolders(),
            CryptoDiscoMasterX.platinumHolders(),
            CryptoDiscoMasterX.goldHolders(),
            CryptoDiscoMasterX.silverHolders(),
            CryptoDiscoMasterX.bronzeHolders(),
        ]);

        const stats = {
            id: 1,
            total_pool_balance: ethers.formatEther(totalSBTPoolBalance),
            acc_diamond: diamondAcc.toString(),
            acc_platinum: platinumAcc.toString(),
            acc_gold: goldAcc.toString(),
            acc_silver: silverAcc.toString(),
            acc_bronze: bronzeAcc.toString(),
            total_locked_rewards: ethers.formatEther(totalLocked),
            diamond_holders: Number(diamondHolders),
            platinum_holders: Number(platinumHolders),
            gold_holders: Number(goldHolders),
            silver_holders: Number(silverHolders),
            bronze_holders: Number(bronzeHolders),
            last_distribution_at: new Date(Number(lastDist) * 1000).toISOString(),
            updated_at: new Date().toISOString()
        };

        console.log("📊 Data to sync:", stats);

        // Upsert to Supabase
        const { data, error } = await supabase
            .from('sbt_pool_stats')
            .upsert(stats, { onConflict: 'id' });

        if (error) {
            console.error("❌ Supabase Sync Error:", error.message);
            console.log("💡 Suggestion: Run this SQL in your Supabase SQL Editor first:");
            console.log(`
CREATE TABLE IF NOT EXISTS sbt_pool_stats (
    id PRIMARY KEY,
    total_pool_balance NUMERIC,
    acc_gold TEXT,
    acc_silver TEXT,
    acc_bronze TEXT,
    total_locked_rewards NUMERIC,
    gold_holders INTEGER,
    silver_holders INTEGER,
    bronze_holders INTEGER,
    last_distribution_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);`);
        } else {
            console.log("✅ Successfully synced to Supabase Table 'sbt_pool_stats'");
        }
    } catch (err) {
        console.error("❌ Contract Read Error:", err.message);
    }
}

main()
    .then(() => {
        // No process.exit(0) here to allow Hardhat's internal cleanup
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
