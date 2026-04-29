const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS;
const DAILY_APP_ABI = [
    { inputs: [{ type: "uint256", name: "" }], name: "nftConfigs", outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }], stateMutability: "view", type: "function" }
];

const client = createPublicClient({
    chain: baseSepolia,
    transport: http()
});

async function checkTiers() {
    console.log("🔍 Checking DailyApp Tier Configs...");
    for (let i = 1; i <= 5; i++) {
        const config = await client.readContract({
            address: DAILY_APP_ADDRESS,
            abi: DAILY_APP_ABI,
            functionName: 'nftConfigs',
            args: [i]
        });
        console.log(`Tier ${i}: Required XP = ${config[0]}`);
    }
}

checkTiers();
