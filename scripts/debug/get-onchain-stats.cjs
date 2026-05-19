const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

/**
 * ON-CHAIN USER STATS READER
 * 
 * Usage:
 *   node scripts/debug/get-onchain-stats.cjs <WALLET_ADDRESS>
 * 
 * Example:
 *   node scripts/debug/get-onchain-stats.cjs 0x52260c30697674a7C837FEB2af21bBf3606795C8
 */

function cleanAddr(addr) {
    if (!addr) return '';
    return addr.trim().toLowerCase();
}

async function main() {
    const args = process.argv.slice(2);
    const rawWallet = args.find(arg => arg.startsWith('0x'));

    if (!rawWallet) {
        console.error('❌ Error: Target wallet address is required.');
        console.log('\nUsage:');
        console.log('  node scripts/debug/get-onchain-stats.cjs <WALLET_ADDRESS>');
        console.log('\nExample:');
        console.log('  node scripts/debug/get-onchain-stats.cjs 0x52260c30697674a7C837FEB2af21bBf3606795C8');
        process.exit(1);
    }

    const wallet = cleanAddr(rawWallet);
    const walletRegex = /^0x[a-f0-9]{40}$/;
    if (!walletRegex.test(wallet)) {
        console.error(`❌ Error: Invalid EVM wallet address format: "${rawWallet}"`);
        process.exit(1);
    }

    // Strictly resolve contract address from environment first, using fallback placeholdered or resolved constant if not available
    const DAILY_APP_ADDRESS = process.env.VITE_DAILY_APP_V15_ADDRESS || process.env.VITE_DAILY_APP_ADDRESS_SEPOLIA;
    
    if (!DAILY_APP_ADDRESS) {
        console.error('❌ Error: Missing contract address in environment variables (VITE_DAILY_APP_V15_ADDRESS or VITE_DAILY_APP_ADDRESS_SEPOLIA).');
        process.exit(1);
    }

    const cleanContractAddress = cleanAddr(DAILY_APP_ADDRESS);
    const RPC_URL = process.env.VITE_RPC_URL_SEPOLIA || 'https://sepolia.base.org';
    
    console.log('====================================================');
    console.log('🛡️  ON-CHAIN USER STATS UTILITY');
    console.log(`📡 Target User   : ${wallet}`);
    console.log(`🏛️  Contract Addr : ${cleanContractAddress}`);
    console.log(`🌐 RPC Endpoint  : ${RPC_URL}`);
    console.log('====================================================');

    const client = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL)
    });

    const ABI = [
        {
            "inputs": [{ "name": "", "type": "address" }],
            "name": "userStats",
            "outputs": [
                { "name": "points", "type": "uint256" },
                { "name": "totalTasksCompleted", "type": "uint256" },
                { "name": "referralCount", "type": "uint256" },
                { "name": "currentTier", "type": "uint8" },
                { "name": "tasksForReferralProgress", "type": "uint256" },
                { "name": "lastDailyBonusClaim", "type": "uint256" },
                { "name": "isBlacklisted", "type": "bool" }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    try {
        const stats = await client.readContract({
            address: cleanContractAddress,
            abi: ABI,
            functionName: 'userStats',
            args: [wallet]
        });

        console.log('\n📈 On-chain Stats Fetched:');
        console.log(JSON.stringify({
            points: Number(stats[0]),
            totalTasksCompleted: Number(stats[1]),
            referralCount: Number(stats[2]),
            currentTier: Number(stats[3]),
            tasksForReferralProgress: Number(stats[4]),
            lastDailyBonusClaim: Number(stats[5]),
            isBlacklisted: stats[6]
        }, null, 2));
        console.log('\n🏁 ✅ SUCCESS: Fetching complete.');
    } catch (e) {
        console.error('\n❌ Error reading contract from on-chain RPC:', e.message || e);
    }
}

main().catch(err => {
    console.error('❌ Fatal execution error:', err);
    process.exit(1);
});
