const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
require('dotenv').config();

async function checkRealStatus() {
    console.log("=== FULL REAL SYNC STATUS REPORT ===");

    // 1. Supabase Connection
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // 2. Provider for Base Sepolia
    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
    const contractAddress = "0x369aBcD44d3D510f4a20788BBa6F47C99e57d267";
    const abi = [
        "function userStats(address) view returns (uint256 points, uint256 totalTasksCompleted, uint256 referralCount, uint8 currentTier, uint256 tasksForReferralProgress, uint256 lastDailyBonusClaim, bool isBlacklisted)"
    ];
    const contract = new ethers.Contract(contractAddress, abi, provider);

    // 3. Get All Users from DB
    const { data: users, error } = await supabase
        .from('user_profiles')
        .select('wallet_address, total_xp')
        .order('total_xp', { ascending: false });

    if (error) {
        console.error("DB Error:", error.message);
        return;
    }

    console.log(`\nChecking all ${users.length} users for parity:`);
    console.log("--------------------------------------------------");

    let synced = 0;
    let dbBehind = 0;
    let contractBehind = 0;
    let errorCount = 0;

    for (const user of users) {
        const wallet = user.wallet_address;
        const dbXp = user.total_xp;
        
        try {
            const stats = await contract.userStats(wallet);
            const contractXp = Number(stats.points);
            const gap = dbXp - contractXp;

            console.log(`User: ${wallet}`);
            console.log(`  - DB XP:       ${dbXp}`);
            console.log(`  - Contract XP: ${contractXp}`);
            
            if (gap > 0) {
                console.log(`  - status: ⚠️  DRIFT DETECTED (${gap} XP missing on-chain)`);
                contractBehind++;
            } else if (gap < 0) {
                console.log(`  - status: 🔄 DB BEHIND CONTRACT (${Math.abs(gap)} XP diff)`);
                dbBehind++;
            } else {
                console.log(`  - status: ✅ FULLY SYNCED`);
                synced++;
            }
            console.log("");
        } catch (e) {
            console.error(`  - Error checking ${wallet}:`, e.message);
            errorCount++;
        }
    }
    
    console.log("=== SUMMARY ===");
    console.log(`Total Users: ${users.length}`);
    console.log(`Fully Synced: ${synced}`);
    console.log(`Contract Behind (Drift Detected): ${contractBehind}`);
    console.log(`DB Behind: ${dbBehind}`);
    console.log(`Errors: ${errorCount}`);
}

checkRealStatus();
