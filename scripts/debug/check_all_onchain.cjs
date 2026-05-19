const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

function cleanEnv(value) {
    return value ? value.trim().replace(/^['"]|['"]$/g, "") : "";
}

function cleanAddress(value) {
    const cleaned = cleanEnv(value);
    if (!ethers.isAddress(cleaned)) return "";
    return ethers.getAddress(cleaned);
}

async function main() {
    const supabaseUrl = cleanEnv(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const dailyAppAddress = cleanAddress(process.env.DAILY_APP_ADDRESS || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA);
    const rpcUrl = cleanEnv(process.env.BASE_SEPOLIA_RPC_URL);

    if (!supabaseUrl || !supabaseKey || !dailyAppAddress || !rpcUrl) {
        console.error("Missing config");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const abi = [
        "function userStats(address) view returns (uint256 points, uint256 totalTasksCompleted, uint256 referralCount, uint8 currentTier, uint256 tasksForReferralProgress, uint256 lastDailyBonusClaim, bool isBlacklisted)"
    ];
    const contract = new ethers.Contract(dailyAppAddress, abi, provider);

    const { data: users, error } = await supabase.from('user_profiles').select('wallet_address, total_xp, last_onchain_xp');
    if (error) throw error;

    console.log("Wallet | DB total_xp | DB last_onchain_xp | Contract points");
    for (const u of users) {
        try {
            const stats = await contract.userStats(u.wallet_address);
            console.log(`${u.wallet_address} | ${u.total_xp} | ${u.last_onchain_xp} | ${stats.points}`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log(`${u.wallet_address} | ${u.total_xp} | ${u.last_onchain_xp} | Error: ${msg}`);
        }
    }
}

main();
