/**
 * verify_contracts.js - DevOps Verification Script
 * Part of the Crypto Disco Infrastructure Phase 2
 */

const hre = require("hardhat");

async function main() {
    console.log("\n🚀 Starting Contract Verification Protocol...");

    // Pulling and normalizing addresses from .env
    const normalize = (val) => val ? hre.ethers.getAddress(val.toLowerCase()) : null;

    const MASTER_X_ADDRESS = normalize(process.env.MASTER_X_ADDRESS);
    const RAFFLE_ADDRESS = normalize(process.env.RAFFLE_ADDRESS);
    const DAILY_APP_ADDRESS = normalize(process.env.DAILY_APP_ADDRESS);

    const OPS_WALLET = normalize(process.env.OPERATIONS_WALLET);
    const TREASURY_WALLET = normalize(process.env.TREASURY_WALLET);
    const PRICE_FEED = normalize(process.env.PRICE_FEED_ETH_USD);
    const AIRNODE_RRP = normalize(process.env.AIRNODE_RRP || "0x2ab9f26E18b6103274414940251539D0105e2Add");

    console.log("📍 MasterX:", MASTER_X_ADDRESS);
    console.log("📍 Raffle: ", RAFFLE_ADDRESS);
    console.log("📍 DailyApp:", DAILY_APP_ADDRESS);

    // --- STEP 1: Verify MasterX ---
    console.log("\n⏳ Verifying MasterX...");
    try {
        await hre.run("verify:verify", {
            address: MASTER_X_ADDRESS,
            constructorArguments: [OPS_WALLET, TREASURY_WALLET, PRICE_FEED],
        });
        console.log("✅ MasterX Verified");
    } catch (error) {
        console.log("⚠️ MasterX Verification Error:", error.message);
    }

    // --- STEP 2: Verify Raffle ---
    console.log("\n⏳ Verifying Raffle...");
    try {
        await hre.run("verify:verify", {
            address: RAFFLE_ADDRESS,
            constructorArguments: [MASTER_X_ADDRESS, AIRNODE_RRP],
        });
        console.log("✅ Raffle Verified");
    } catch (error) {
        console.log("⚠️ Raffle Verification Error:", error.message);
    }

    // --- STEP 3: Verify DailyApp ---
    if (DAILY_APP_ADDRESS && DAILY_APP_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        console.log("\n⏳ Verifying DailyApp...");
        try {
            await hre.run("verify:verify", {
                address: DAILY_APP_ADDRESS,
                constructorArguments: [MASTER_X_ADDRESS],
            });
            console.log("✅ DailyApp Verified");
        } catch (error) {
            console.log("⚠️ DailyApp Verification Error:", error.message);
        }
    } else {
        console.log("\n⏭️ Skipping DailyApp verification (no address found).");
    }

    console.log("\n🏁 Verification Protocol Complete.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
