const { createWalletClient, http, publicActions } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

if (!PRIVATE_KEY || !MASTER_X_ADDRESS) {
    console.error("❌ Missing PRIVATE_KEY or MASTER_X_ADDRESS in .env");
    process.exit(1);
}

const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL)
}).extend(publicActions);

const MASTER_X_ABI = [
    { 
        inputs: [
            { type: "uint8", name: "tier" }, 
            { type: "uint256", name: "feeWei" }, 
            { type: "uint256", name: "minXP" }
        ], 
        name: "setTierConfig", 
        outputs: [], 
        stateMutability: "nonpayable", 
        type: "function" 
    }
];

const tiers = [
    { id: 1, name: 'BRONZE', xp: 100n },
    { id: 2, name: 'SILVER', xp: 500n },
    { id: 3, name: 'GOLD', xp: 1500n },
    { id: 4, name: 'PLATINUM', xp: 4000n },
    { id: 5, name: 'DIAMOND', xp: 10000n }
];

async function setup() {
    console.log(`📡 Initializing SBT Tiers on MasterX: ${MASTER_X_ADDRESS}`);
    console.log(`👤 Account: ${account.address}`);

    for (const tier of tiers) {
        try {
            console.log(`\n⏳ Configuring ${tier.name} (ID: ${tier.id})...`);
            const hash = await client.writeContract({
                address: MASTER_X_ADDRESS,
                abi: MASTER_X_ABI,
                functionName: 'setTierConfig',
                args: [tier.id, 0n, tier.xp] // 0 fee for now
            });
            console.log(`✅ Hash: ${hash}`);
            await client.waitForTransactionReceipt({ hash });
            console.log(`⭐ ${tier.name} configured successfully.`);
        } catch (e) {
            console.error(`❌ Failed to configure ${tier.name}: ${e.message}`);
        }
    }

    console.log(`\n🎉 All tiers initialized! Monitor should turn GREEN in the next cycle.`);
}

setup().catch(console.error);
