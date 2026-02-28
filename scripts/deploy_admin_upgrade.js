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
    const MASTER_X = hre.ethers.getAddress((process.env.VITE_MASTER_X_ADDRESS || "0x09b672b7b23ae226d80cd60777ce7751febdd461").toLowerCase());
    const USDC = hre.ethers.getAddress((process.env.USDC_ADDRESS || "0x036cbd53842c5426634e7929541ec2318f3dcf7e").toLowerCase());
    const CREATOR_TOKEN = hre.ethers.getAddress((process.env.CREATOR_TOKEN_ADDRESS || "0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c").toLowerCase());
    const AIRNODE_RRP = hre.ethers.getAddress((process.env.AIRNODE_RRP || "0x2ab9f26e18b6103274414940251539d0105e2add").toLowerCase());

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
        { gasLimit: 25000000, ...gasArgs }
    );
    await daily.waitForDeployment();
    const newDailyAddr = await daily.getAddress();
    console.log(`✅ DailyAppV12Secured deployed to: ${newDailyAddr}`);

    // Helper to wait
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- Post-Deployment Initialization ---
    console.log("⏳ Initializing NFT Configs...");
    const tiers = [1, 2, 3, 4, 5]; // BRONZE to DIAMOND
    const points = [1000, 5000, 20000, 100000, 500000];
    const prices = [
        hre.ethers.parseEther("0.001"),
        hre.ethers.parseEther("0.005"),
        hre.ethers.parseEther("0.02"),
        hre.ethers.parseEther("0.1"),
        hre.ethers.parseEther("0.5")
    ];
    const bonuses = [50, 100, 200, 500, 1000];
    const multipliers = [11000, 12000, 15000, 20000, 30000];
    const supplies = [10000, 5000, 2000, 1000, 100];

    const initTx = await daily.setNFTConfigsBatch(tiers, points, prices, bonuses, multipliers, supplies);
    await initTx.wait(2); // Wait for 2 confirmations
    await sleep(2000); // 2s extra buffer
    console.log("✅ NFT Configs Initialized");

    console.log("⏳ Adding initial Daily Login task...");
    const taskTx = await daily.addTask(
        100,            // baseReward
        86400,          // cooldown (24h)
        0,              // minTier (NONE)
        "Login Harian", // title
        "",             // link
        false           // requiresVerification
    );
    await taskTx.wait(2);
    await sleep(2000);
    console.log("✅ Initial Task Added");
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
    const raffleInitTx = await raffle.initializeFirstRaffle({ gasLimit: 200000, ...gasArgs });
    await raffleInitTx.wait();
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
