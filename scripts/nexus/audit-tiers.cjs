const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS;
const DAILY_APP_ABI = [
    { inputs: [{ type: "uint8", name: "" }], name: "nftConfigs", outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }], stateMutability: "view", type: "function" }
];

const client = createPublicClient({
    chain: baseSepolia,
    transport: http()
});

async function checkTiers() {
    console.log("🔍 Auditing DailyApp Tier Configs...");
    for (let i = 0; i <= 5; i++) {
        try {
            const config = await client.readContract({
                address: DAILY_APP_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'nftConfigs',
                args: [i]
            });
            console.log(`Tier ${i}: Required XP = ${config[0]}, Price = ${config[1]}, Open = ${config[6]}`);
        } catch (e) {
            console.log(`Tier ${i}: ❌ Reverted (${e.shortMessage || e.message})`);
        }
    }
}

checkTiers();
