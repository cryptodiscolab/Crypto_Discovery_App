const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

async function main() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dailyAppAddress = process.env.DAILY_APP_ADDRESS || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA;
    if (!dailyAppAddress) {
        console.error("❌ ERROR: Contract address not found in environment variables.");
        process.exit(1);
    }

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("Missing PRIVATE_KEY");
    const adminWallet = new ethers.Wallet(privateKey, provider);
    
    const abi = [
        "function userStats(address) view returns (uint256 points, uint256 totalTasksCompleted, uint256 referralCount, uint8 currentTier, uint256 tasksForReferralProgress, uint256 lastDailyBonusClaim, bool isBlacklisted)",
        "function batchMigrateUsers(address[] calldata _users, tuple(uint256 points, uint256 totalTasksCompleted, uint256 referralCount, uint8 currentTier, uint256 tasksForReferralProgress, uint256 lastDailyBonusClaim, bool isBlacklisted)[] calldata _stats, uint256[] calldata _maxSyncedXp) external"
    ];
    const dailyAppRead = new ethers.Contract(dailyAppAddress, abi, provider);
    const dailyAppWrite = new ethers.Contract(dailyAppAddress, abi, adminWallet);

    console.log("=== ADMIN FORCE SYNC (OPSI 2) ===");
    console.log("Fetching users from Supabase...");
    
    const { data: users, error } = await supabase
        .from('user_profiles')
        .select('wallet_address, total_xp')
        .order('total_xp', { ascending: false });

    if (error) throw error;

    const addresses = [];
    const statsArray = [];
    const maxSyncedArray = [];

    console.log("\nChecking drift...");
    for (const user of users) {
        const userWallet = user.wallet_address;
        const dbXp = Number(user.total_xp);

        try {
            const stats = await dailyAppRead.userStats(userWallet);
            const contractXp = Number(stats.points);

            // Since we cannot read maxSyncedDbXp (it is not public), we assume 
            // the users haven't spent points yet, so missingXp = dbXp - contractXp.
            const missingXp = dbXp - contractXp;

            if (missingXp > 0) {
                console.log(`⚠️ Drift for ${userWallet}`);
                console.log(`  - DB XP: ${dbXp}`);
                console.log(`  - Contract XP: ${contractXp}`);
                console.log(`  - Points To Add: ${missingXp}`);
                
                addresses.push(userWallet);
                statsArray.push({
                    points: contractXp + missingXp,
                    totalTasksCompleted: stats[1],
                    referralCount: stats[2],
                    currentTier: stats[3],
                    tasksForReferralProgress: stats[4],
                    lastDailyBonusClaim: stats[5],
                    isBlacklisted: stats[6]
                });
                maxSyncedArray.push(dbXp); // new max synced
            } else if (missingXp < 0) {
                console.log(`🔄 Reverse Drift for ${userWallet} (DB behind)`);
            }
        } catch (e) {
            console.error(`❌ Error fetching on-chain data for ${userWallet}:`, e.message);
        }
    }

    if (addresses.length === 0) {
        console.log("\n✅ No drift detected. All users are fully synced.");
        return;
    }

    console.log(`\n🚀 Preparing to force sync ${addresses.length} users...`);
    
    try {
        console.log("Executing batchMigrateUsers...");
        const tx = await dailyAppWrite.batchMigrateUsers(addresses, statsArray, maxSyncedArray);
        console.log("Tx Sent! Hash:", tx.hash);
        console.log("Waiting for confirmation...");
        await tx.wait();
        console.log("✅ Admin Force Sync Complete! Users' XP balances are now synced.");
    } catch (e) {
        console.error("❌ Failed to execute batchMigrateUsers:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
