const { createPublicClient, http, formatEther } = require('viem');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

async function debug() {
    console.log(`🔍 Debugging DailyApp at ${DAILY_APP_ADDRESS}`);
    const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

    try {
        // Try reading userStats for a known address or 0x0
        const stats = await client.readContract({
            address: DAILY_APP_ADDRESS,
            abi: [{ name: 'userStats', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }] }],
            functionName: 'userStats',
            args: ['0x0000000000000000000000000000000000000000']
        });
        console.log("✅ userStats read successful:", stats);
    } catch (e) {
        console.error("❌ userStats read failed:", e.message);
    }

    try {
        // Try reading nftConfigs(1)
        const config = await client.readContract({
            address: DAILY_APP_ADDRESS,
            abi: [{ name: 'nftConfigs', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint8' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }] }],
            functionName: 'nftConfigs',
            args: [1]
        });
        console.log("✅ nftConfigs(1) read successful:", config);
    } catch (e) {
        console.error("❌ nftConfigs(1) read failed:", e.message);
    }
}

debug();
