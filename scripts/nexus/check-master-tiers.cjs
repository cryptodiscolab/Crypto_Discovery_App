const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS;
const MASTER_X_ABI = [
    { inputs: [{ type: "uint8", name: "" }], name: "tierMinXP", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }
];

const client = createPublicClient({
    chain: baseSepolia,
    transport: http()
});

async function checkMasterTiers() {
    console.log("🔍 Checking MasterX Tier Configs...");
    for (let i = 1; i <= 5; i++) {
        const xp = await client.readContract({
            address: MASTER_X_ADDRESS,
            abi: MASTER_X_ABI,
            functionName: 'tierMinXP',
            args: [i]
        });
        console.log(`Tier ${i}: Required XP = ${xp}`);
    }
}

checkMasterTiers();
