const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

// 1. CONFIGURATION
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const PRIVATE_KEY = process.env.WALLET_BOT_SIGNER || process.env.ADMIN_PRIVATE_KEY;
const DAILY_APP_ADDRESS = process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA || process.env.DAILY_APP_ADDRESS;
const MASTER_X_ADDRESS = process.env.VITE_MASTER_X_ADDRESS_SEPOLIA || process.env.MASTER_X_ADDRESS;

if (!PRIVATE_KEY || !DAILY_APP_ADDRESS || !MASTER_X_ADDRESS) {
    console.error("❌ Missing required environment variables (WALLET_BOT_SIGNER, DAILY_APP_ADDRESS, MASTER_X_ADDRESS)");
    process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL)
});

const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL)
});

// 2. ABIs
const DAILY_APP_ABI = [
    { inputs: [{ type: "uint8[]", name: "_tiers" }, { type: "uint256[]", name: "_pointsRequired" }, { type: "uint256[]", name: "_mintPrices" }, { type: "uint256[]", name: "_dailyBonuses" }, { type: "uint256[]", name: "_multiplierBPs" }, { type: "uint256[]", name: "_maxSupplies" }, { type: "bool[]", name: "_isOpen" }], name: "setNFTConfigsBatch", outputs: [], stateMutability: "nonpayable", type: "function" },
    { inputs: [{ type: "uint8", name: "" }], name: "nftConfigs", outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }], stateMutability: "view", type: "function" }
];

const MASTER_X_ABI = [
    { inputs: [{ type: "uint8", name: "" }], name: "tierMinXP", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }
];

async function reconcile() {
    console.log(`🚀 [Tier Sync] Starting reconciliation...`);
    console.log(`📍 DailyApp: ${DAILY_APP_ADDRESS}`);
    console.log(`📍 MasterX:  ${MASTER_X_ADDRESS}`);
    console.log(`👤 Admin:    ${account.address}`);

    const tierIndexes = [1, 2, 3, 4, 5];
    const tierNames = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];

    const masterXP = [];
    const dailyConfigs = [];
    const driftDetected = [];

    // 1. Audit
    for (const index of tierIndexes) {
        const mxp = await publicClient.readContract({
            address: MASTER_X_ADDRESS,
            abi: MASTER_X_ABI,
            functionName: 'tierMinXP',
            args: [index]
        });
        masterXP.push(mxp);

        const dcfg = await publicClient.readContract({
            address: DAILY_APP_ADDRESS,
            abi: DAILY_APP_ABI,
            functionName: 'nftConfigs',
            args: [index]
        });
        dailyConfigs.push(dcfg);

        if (dcfg[0] !== mxp || !dcfg[6]) {
            driftDetected.push({
                tier: tierNames[index - 1],
                master: mxp.toString(),
                daily: dcfg[0].toString(),
                isOpen: dcfg[6]
            });
        }
    }

    if (driftDetected.length === 0) {
        console.log("✅ [Tier Sync] No drift detected. All tiers are healthy and synced.");
        return;
    }

    console.warn(`⚠️ [Tier Sync] Drift detected in ${driftDetected.length} tiers:`);
    console.table(driftDetected);

    // 2. Fix
    console.log("🛠️ [Tier Sync] Pushing corrective batch update...");

    // Correct parameters for DailyAppV14.setNFTConfigsBatch:
    // (NFTTier[] _tiers, uint256[] _pointsRequired, uint256[] _mintPrices, uint256[] _dailyBonuses, uint256[] _multiplierBPs, uint256[] _maxSupplies, bool[] _isOpen)
    const mintPrices = [0n, 0n, 0n, 0n, 0n];
    const dailyBonuses = [0n, 0n, 0n, 0n, 0n];
    const multiplierBPs = [10000n, 12000n, 15000n, 20000n, 30000n]; // 1x, 1.2x, 1.5x, 2x, 3x
    const maxSupplies = [0n, 0n, 0n, 0n, 0n]; // 0 = unlimited
    const isOpens = [true, true, true, true, true];

    try {
        const { request } = await publicClient.simulateContract({
            address: DAILY_APP_ADDRESS,
            abi: DAILY_APP_ABI,
            functionName: 'setNFTConfigsBatch',
            args: [
                tierIndexes,
                masterXP,
                mintPrices,
                dailyBonuses,
                multiplierBPs,
                maxSupplies,
                isOpens
            ],
            account
        });

        const hash = await walletClient.writeContract(request);
        console.log(`✅ [Tier Sync] Transaction sent: ${hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("🎉 [Tier Sync] Parity Restored! Tiers are now open and synced.");
    } catch (err) {
        console.error("❌ [Tier Sync] Failed to update configs:", err.message);
    }
}


reconcile().catch(console.error);
