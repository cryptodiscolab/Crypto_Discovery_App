/**
 * verify_all.js - Hardened Verification Script
 * Adheres to Immutable Architect Protocol
 * Handles verification for MasterX V2, Raffle, and DailyApp
 */

const hre = require("hardhat");

async function main() {
    console.log("\n🔍 Initiating Phase 2 Verification Sequence...");

    const MASTER_X_V2_ADDRESS = process.env.MASTER_X_V2_ADDRESS;
    const RAFFLE_ADDRESS = process.env.RAFFLE_ADDRESS;
    const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS;

    const OPS_WALLET = process.env.OPERATIONS_WALLET;
    const TREASURY_WALLET = process.env.TREASURY_WALLET;
    const PRICE_FEED = process.env.PRICE_FEED_ETH_USD || "0x4aDC67696bA383F43fD60604633031d935f9584b";
    const AIRNODE_RRP = process.env.AIRNODE_RRP || "0x2ab9f26E18b6103274414940251539D0105e2Add";

    if (!MASTER_X_V2_ADDRESS || !RAFFLE_ADDRESS || !DAILY_APP_ADDRESS) {
        console.error("❌ Missing required addresses in .env (MASTER_X_V2_ADDRESS, RAFFLE_ADDRESS, DAILY_APP_ADDRESS)");
        process.exit(1);
    }

    // 1. Verify MasterX V2
    console.log("\n⏳ [1/3] Verifying MasterX V2...");
    try {
        await hre.run("verify:verify", {
            address: MASTER_X_V2_ADDRESS,
            constructorArguments: [OPS_WALLET, TREASURY_WALLET, PRICE_FEED],
        });
        console.log("✅ MasterX V2 Verified");
    } catch (e) {
        console.log("⚠️ MasterX V2 Verification Error (might already be verified):", e.message);
    }

    // 2. Verify Raffle
    console.log("\n⏳ [2/3] Verifying Raffle...");
    try {
        await hre.run("verify:verify", {
            address: RAFFLE_ADDRESS,
            constructorArguments: [MASTER_X_V2_ADDRESS, AIRNODE_RRP],
        });
        console.log("✅ Raffle Verified");
    } catch (e) {
        console.log("⚠️ Raffle Verification Error:", e.message);
    }

    // 3. Verify DailyApp
    console.log("\n⏳ [3/3] Verifying DailyApp...");
    try {
        await hre.run("verify:verify", {
            address: DAILY_APP_ADDRESS,
            constructorArguments: [MASTER_X_V2_ADDRESS],
        });
        console.log("✅ DailyApp Verified");
    } catch (e) {
        console.log("⚠️ DailyApp Verification Error:", e.message);
    }

    console.log("\n✅ Verification Sequence Complete.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
