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
        // Read Data from Contract with Auto-Retry
        let contractData;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                contractData = await Promise.all([
                    CryptoDiscoMasterX.totalSBTPoolBalance(),
                    CryptoDiscoMasterX.accRewardPerShare(0),
                    CryptoDiscoMasterX.accRewardPerShare(1),
                    CryptoDiscoMasterX.accRewardPerShare(2),
                    CryptoDiscoMasterX.accRewardPerShare(3),
                    CryptoDiscoMasterX.accRewardPerShare(4),
                    CryptoDiscoMasterX.accRewardPerShare(5),
                    CryptoDiscoMasterX.lastDistributeTimestamp(),
                    CryptoDiscoMasterX.totalLockedRewards(),
                    CryptoDiscoMasterX.diamondHolders(),
                    CryptoDiscoMasterX.platinumHolders(),
                    CryptoDiscoMasterX.goldHolders(),
                    CryptoDiscoMasterX.silverHolders(),
                    CryptoDiscoMasterX.bronzeHolders(),
                ]);
                break;
            } catch (err) {
                if (attempt === 3) throw err;
                console.log(`⚠️  [SBT Sync] Contract call failed. Retrying (${attempt}/3)...`);
                await new Promise(res => setTimeout(res, 2000));
            }
        }

        const [
            totalSBTPoolBalance,
            noneAcc, bronzeAcc, silverAcc, goldAcc, platinumAcc, diamondAcc,
            lastDist, totalLocked,
            diamondHolders, platinumHolders, goldHolders, silverHolders, bronzeHolders
        ] = contractData;

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

        // 2. Recovery & Auto-Healing Check (v3.22.0)
        const { data: healthRecord } = await supabase
            .from('system_health')
            .select('*')
            .eq('service_key', 'sync-sbt')
            .maybeSingle();

        let consecutiveSuccess = healthRecord?.metadata?.consecutive_success || 0;
        let isRecovering = healthRecord?.status === 'failed' || healthRecord?.status === 'recovering';

        if (isRecovering) {
            consecutiveSuccess++;
            console.log(`🩹 [Auto-Healing] Recovery run ${consecutiveSuccess}/3 in progress...`);
        } else {
            consecutiveSuccess = 0; // Reset if already healthy (or first run)
        }

        // 3. Upsert to Supabase sbt_pool_stats
        const { error: syncErr } = await supabase
            .from('sbt_pool_stats')
            .upsert(stats, { onConflict: 'id' });

        if (syncErr) throw syncErr;

        console.log("✅ Successfully synced to Supabase Table 'sbt_pool_stats'");

        // 4. Update Health State (Auto-Reset Logic)
        let finalStatus = 'healthy';
        let finalError = null;

        if (isRecovering && consecutiveSuccess < 3) {
            finalStatus = 'recovering';
            finalError = healthRecord.last_error; // Keep error until fully healed
        } else if (isRecovering && consecutiveSuccess >= 3) {
            console.log("🎊 [Auto-Healing] Service fully recovered! Circuit Breaker closing.");
            finalStatus = 'healthy';
            finalError = null;
            consecutiveSuccess = 0;
        }

        await supabase.from('system_health').upsert({
            service_key: 'sync-sbt',
            status: finalStatus,
            last_heartbeat: new Date().toISOString(),
            last_error: finalError,
            metadata: { 
                consecutive_success: consecutiveSuccess,
                last_recovery_step: isRecovering ? new Date().toISOString() : null
            },
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });

    } catch (err) {
        console.error("❌ Sync Error:", err.message);
        // v3.22.0: Reset healing counter on failure
        await supabase.from('system_health').upsert({
            service_key: 'sync-sbt',
            status: 'failed',
            last_error: err.message,
            metadata: { consecutive_success: 0 },
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });
    } finally {
        console.log("📡 [Sync Health] Process finished at:", new Date().toISOString());
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
