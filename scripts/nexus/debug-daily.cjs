const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS;

const client = createPublicClient({
    chain: baseSepolia,
    transport: http()
});

async function debug() {
    console.log("🔍 Debugging DailyApp @", DAILY_APP_ADDRESS);
    try {
        const userCount = await client.readContract({
            address: DAILY_APP_ADDRESS,
            abi: [{ inputs: [], name: "userCount", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
            functionName: 'userCount'
        });
        console.log("✅ User Count:", userCount.toString());
    } catch (e) {
        console.error("❌ Failed to read userCount:", e.message);
    }
}

debug();
