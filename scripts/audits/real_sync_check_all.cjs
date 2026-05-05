const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
require('dotenv').config();

async function checkRealStatus() {
    console.log("=== FULL REAL SYNC STATUS REPORT ===");

    // 1. Supabase Connection
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // 2. Provider for Base Sepolia
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Dynamic Contract Address to prevent Drift
    const contractAddress = process.env.DAILY_APP_ADDRESS || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA;
    if (!contractAddress) {
        console.error("❌ ERROR: Contract address not found in environment variables.");
        process.exit(1);
    }

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
            let stats;
            // Auto-Retry Logic (Maksimal 3 percobaan) untuk menangani RPC Timeout
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    stats = await contract.userStats(wallet);
                    break; // Sukses, keluar dari loop retry
                } catch (err) {
                    if (attempt === 3) throw err; // Gagal total di percobaan ke-3
                    console.log(`  - ⚠️ RPC lambat/error untuk ${wallet}. Mencoba ulang (${attempt}/3)...`);
                    await new Promise(res => setTimeout(res, 1500)); // Tunggu 1.5 detik sebelum retry
                }
            }

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
