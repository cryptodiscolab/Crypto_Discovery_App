const { createWalletClient, http, createPublicClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS;

// ABI for setNFTConfigsBatch
const DAILY_APP_ABI = [
    {
        "inputs": [
            { "internalType": "enum DailyAppV12Secured.NFTTier[]", "name": "_tiers", "type": "uint8[]" },
            { "internalType": "uint256[]", "name": "_pointsRequired", "type": "uint256[]" },
            { "internalType": "uint256[]", "name": "_mintPrices", "type": "uint256[]" },
            { "internalType": "uint256[]", "name": "_dailyBonuses", "type": "uint256[]" },
            { "internalType": "uint256[]", "name": "_multiplierBPs", "type": "uint256[]" },
            { "internalType": "uint256[]", "name": "_maxSupplies", "type": "uint256[]" },
            { "internalType": "bool[]", "name": "_isOpen", "type": "bool[]" }
        ],
        "name": "setNFTConfigsBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

async function syncDailyTiers() {
    console.log("🔄 Synchronizing DailyApp Tiers with Ecosystem Economy...");
    
    const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
    });

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    // 1: Bronze, 2: Silver, 3: Gold, 4: Platinum, 5: Diamond
    const tiers = [1, 2, 3, 4, 5];
    const pointsRequired = [100n, 500n, 1500n, 4000n, 10000n]; // XP Thresholds
    const mintPrices = [0n, 0n, 0n, 0n, 0n]; // Free minting for XP-based tiers
    const dailyBonuses = [100n, 150n, 250n, 500n, 1000n]; // Scaling daily rewards
    const multiplierBPs = [10000n, 11000n, 13000n, 16000n, 20000n]; // 1.0x -> 2.0x
    const maxSupplies = [10000n, 5000n, 1000n, 500n, 100n]; // Scarcity tiers
    const isOpen = [true, true, true, true, true];

    try {
        console.log("📡 Sending transaction to Base Sepolia...");
        const { request } = await publicClient.simulateContract({
            address: DAILY_APP_ADDRESS,
            abi: DAILY_APP_ABI,
            functionName: 'setNFTConfigsBatch',
            args: [tiers, pointsRequired, mintPrices, dailyBonuses, multiplierBPs, maxSupplies, isOpen],
            account
        });

        const hash = await walletClient.writeContract(request);
        console.log(`✅ Transaction sent! Hash: ${hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("🎉 Tiers successfully synchronized! Status: SUCCESS");
        
    } catch (e) {
        console.error("❌ Failed to sync tiers:", e.shortMessage || e.message);
    }
}

syncDailyTiers();
