/**
 * deploy_daily_v2.js - Targeted deployment for DailyApp V2
 */
require("dotenv").config();
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("\n🚀 Deploying DailyApp V2 Satellite...");

    // Existing MasterX from .env
    const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS || "0xf074b0457d5c092bb67e62734B13C5f4cbc69e89";
    console.log("🔗 Linking to MasterX:", MASTER_X_ADDRESS);

    // 1. Deploy DailyApp
    const DailyApp = await hre.ethers.getContractFactory("DailyApp");
    const daily = await DailyApp.deploy(MASTER_X_ADDRESS);
    await daily.waitForDeployment();
    const dailyAddr = await daily.getAddress();
    console.log("✅ DailyApp Deployed at:", dailyAddr);

    // 2. Authorize in MasterX
    console.log("\n⏳ Authorizing DailyApp in MasterX...");
    const MasterX = await hre.ethers.getContractAt("CryptoDiscoMasterX", MASTER_X_ADDRESS);
    const authTx = await MasterX.setSatelliteStatus(dailyAddr, true);
    await authTx.wait();
    console.log("✅ Authorization Successful. TX:", authTx.hash);

    console.log("\n==========================================");
    console.log("NEW DAILY_APP_ADDRESS:", dailyAddr);
    console.log("==========================================\n");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
