/**
 * deploy_admin_upgrade.js
 * Deploy updated DailyAppV12Secured + CryptoDiscoRaffle with admin-free functions.
 * Updates .env with new addresses.
 */
require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("\n🚀 Admin Upgrade Deployment");
    console.log("📍 Deployer:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(balance), "ETH\n");

    const feeData = await hre.ethers.provider.getFeeData();
    const gasArgs = {
        maxFeePerGas: feeData.maxFeePerGas * 3n,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 3n
    };

    // --- Existing contracts from .env ---
    const MASTER_X = process.env.VITE_MASTER_X_ADDRESS || "0x09b672B7B23ae226d80cD60777Ce7751fEbdd461";
    const USDC = process.env.USDC_ADDRESS;
    const CREATOR_TOKEN = process.env.CREATOR_TOKEN_ADDRESS;
    const AIRNODE_RRP = process.env.AIRNODE_RRP || "0x2ab9f26E18b6103274414940251539D0105e2Add";

    console.log("🔗 MasterX:", MASTER_X);
    console.log("🔗 USDC:", USDC);
    console.log("🔗 Creator Token:", CREATOR_TOKEN);

    // ─── 1. Deploy DailyAppV12Secured ─────────────────────────────────────────
    // Constructor: (address _tokenAddress, address _usdcToken, address initialOwner)
    console.log("\n⏳ [1/3] Deploying DailyAppV12Secured...");
    const DailyApp = await hre.ethers.getContractFactory("DailyAppV12Secured");
    const daily = await DailyApp.deploy(
        CREATOR_TOKEN,      // _tokenAddress (creator/reward token)
        USDC,               // _usdcToken (platform fee token)
        deployer.address,   // initialOwner (gets DEFAULT_ADMIN_ROLE + ADMIN_ROLE)
        { gasLimit: 5000000, ...gasArgs }
    );
    await daily.waitForDeployment();
    const newDailyAddr = await daily.getAddress();
    console.log("✅ DailyAppV12Secured at:", newDailyAddr);
    console.log("   (deployer already has ADMIN_ROLE — granted in constructor)");

    // ─── 2. Deploy CryptoDiscoRaffle ──────────────────────────────────────────
    console.log("\n⏳ [2/3] Deploying CryptoDiscoRaffle...");
    const Raffle = await hre.ethers.getContractFactory("CryptoDiscoRaffle");
    const raffle = await Raffle.deploy(MASTER_X, AIRNODE_RRP, { gasLimit: 2000000, ...gasArgs });
    await raffle.waitForDeployment();
    const newRaffleAddr = await raffle.getAddress();
    console.log("✅ CryptoDiscoRaffle at:", newRaffleAddr);

    // Init first raffle
    console.log("⏳ [3/3] Initializing first raffle...");
    const initTx = await raffle.initializeFirstRaffle({ gasLimit: 200000, ...gasArgs });
    await initTx.wait();
    console.log("✅ First raffle initialized");

    // ─── 3. Print Summary ─────────────────────────────────────────────────────
    console.log("\n==========================================");
    console.log("📊 DEPLOYMENT SUMMARY");
    console.log("==========================================");
    console.log("VITE_V12_CONTRACT_ADDRESS =", newDailyAddr);
    console.log("VITE_RAFFLE_ADDRESS       =", newRaffleAddr);
    console.log("==========================================");
    console.log("\n⚠️  Copy these values to your .env and Raffle_Frontend/.env.local\n");
}

main().catch((error) => {
    console.error("\n❌ DEPLOYMENT FAILED:", error);
    process.exit(1);
});
