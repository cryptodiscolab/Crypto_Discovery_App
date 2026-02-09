/**
 * deploy_v2.js - Phase 2 Deployment Script
 * Handles:
 * 1. MasterX V2 Deployment
 * 2. DailyApp Satellite Deployment
 * 3. Linkage & Authorization Sequence
 */

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("\n🚀 Initiating Phase 2 Deployment (Satellite Integration)...");
    console.log("📍 Deployer:", deployer.address);

    // 1. Environment Parsing & Normalization
    const normalize = (val) => val ? hre.ethers.getAddress(val.toLowerCase()) : null;

    const OPS = normalize(process.env.OPERATIONS_WALLET);
    const TREASURY = normalize(process.env.TREASURY_WALLET);
    const PRICE_FEED = normalize(process.env.PRICE_FEED_ETH_USD);
    const AIRNODE_RRP = normalize(process.env.AIRNODE_RRP || "0x2ab9f26E18b6103274414940251539D0105e2Add");
    const RAFFLE_ADDRESS = normalize(process.env.RAFFLE_ADDRESS);

    if (!OPS || !TREASURY || !PRICE_FEED) {
        console.error("❌ Missing required .env variables (OPS, TREASURY, PRICE_FEED)");
        process.exit(1);
    }

    // Aggressive Gas Strategy for Base Sepolia
    const feeData = await hre.ethers.provider.getFeeData();
    const gasArgs = {
        maxFeePerGas: feeData.maxFeePerGas * 2n,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n
    };

    // --- STEP 1: Deploy MasterX V2 ---
    console.log("\n⏳ [1/5] Deploying CryptoDiscoMasterX (V2)...");
    const MasterX = await hre.ethers.getContractFactory("CryptoDiscoMasterX");
    const masterX = await MasterX.deploy(OPS, TREASURY, PRICE_FEED, { ...gasArgs });
    await masterX.waitForDeployment();
    const masterXAddr = await masterX.getAddress();
    console.log("✅ MasterX V2 Deployed at:", masterXAddr);

    // --- STEP 2: Deploy DailyApp Satellite ---
    console.log("\n⏳ [2/5] Deploying DailyApp Satellite...");
    const DailyApp = await hre.ethers.getContractFactory("DailyApp");
    const dailyApp = await DailyApp.deploy(masterXAddr, { ...gasArgs });
    await dailyApp.waitForDeployment();
    const dailyAppAddr = await dailyApp.getAddress();
    console.log("✅ DailyApp Deployed at:", dailyAppAddr);

    // --- STEP 3: Deploy or Link Raffle ---
    let raffleAddr = RAFFLE_ADDRESS;
    if (!raffleAddr) {
        console.log("\n⏳ [3/5] No RAFFLE_ADDRESS found. Deploying new CryptoDiscoRaffle...");
        const Raffle = await hre.ethers.getContractFactory("CryptoDiscoRaffle");
        const raffle = await Raffle.deploy(masterXAddr, AIRNODE_RRP, { ...gasArgs });
        await raffle.waitForDeployment();
        raffleAddr = await raffle.getAddress();
        console.log("✅ Raffle Deployed at:", raffleAddr);
    } else {
        console.log("\n⏳ [3/5] Using existing Raffle at:", raffleAddr);
        const raffle = await hre.ethers.getContractAt("CryptoDiscoRaffle", raffleAddr);
        console.log("Wait: Raffle needs to be updated to point to NEW MasterX V2.");
        const updateMasterTx = await raffle.setMaster(masterXAddr, { ...gasArgs });
        await updateMasterTx.wait();
        console.log("✅ Raffle synchronized with MasterX V2.");
    }

    // --- STEP 4: Authorize Satellites in MasterX ---
    console.log("\n⏳ [4/5] Authorizing Satellites in MasterX...");

    console.log("Linkage: Setting Raffle Contract in MasterX...");
    const setRaffleTx = await masterX.setRaffleContract(raffleAddr, { ...gasArgs });
    await setRaffleTx.wait();

    console.log("Linkage: Authorizing DailyApp as Satellite...");
    const setSatTx = await masterX.setSatelliteStatus(dailyAppAddr, true, { ...gasArgs });
    await setSatTx.wait();
    console.log("✅ Authorizations complete.");

    // --- STEP 5: Initialize Raffle (if new) ---
    const raffle = await hre.ethers.getContractAt("CryptoDiscoRaffle", raffleAddr);
    const currentId = await raffle.currentRaffleId();
    if (currentId === 0n) {
        console.log("\n⏳ [5/5] Initializing First Raffle...");
        const initTx = await raffle.initializeFirstRaffle({ ...gasArgs });
        await initTx.wait();
        console.log("✅ Raffle Initialized.");
    } else {
        console.log("\n⏳ [5/5] Raffle already initialized. Skipping.");
    }

    console.log("\n==========================================");
    console.log("📊 PHASE 2 DEPLOYMENT SUMMARY");
    console.log("==========================================");
    console.log(`MASTER_X_ADDRESS=${masterXAddr}`);
    console.log(`RAFFLE_ADDRESS=${raffleAddr}`);
    console.log(`DAILY_APP_ADDRESS=${dailyAppAddr}`);
    console.log("==========================================\n");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
