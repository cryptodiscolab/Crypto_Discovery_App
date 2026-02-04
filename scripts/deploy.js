/**
 * Hardhat Deployment Script for CryptoDiscoMaster.sol
 * Network: Base Sepolia Testnet
 * 
 * Environment Variables Required:
 * - PRIVATE_KEY: Deployer wallet private key
 * - BASE_SEPOLIA_RPC_URL: Base Sepolia RPC endpoint
 */

const hre = require("hardhat");

async function main() {
    console.log("========================================");
    console.log("🚀 Starting CryptoDiscoMaster Deployment");
    console.log("========================================\n");

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("📍 Deploying from address:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    // Constructor arguments
    const OPERATIONS_WALLET = process.env.OPERATIONS_WALLET || "0x742d35cc6634c0532925a3b844bc9e7595f0beb";
    const TREASURY_WALLET = process.env.TREASURY_WALLET || "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199";
    const AIRNODE_RRP = "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd"; // Base Sepolia AirnodeRrp
    const PRICE_FEED = "0x4adc43e4f3841847bb1479f4a079cf294975267d"; // Base Sepolia ETH/USD Feed

    console.log("📋 Constructor Arguments:");
    console.log("   Operations Wallet:", OPERATIONS_WALLET);
    console.log("   Treasury Wallet:", TREASURY_WALLET);
    console.log("   Airnode RRP:", AIRNODE_RRP);
    console.log("   Price Feed (ETH/USD):", PRICE_FEED);
    console.log("");

    // Deploy contract
    console.log("⏳ Deploying CryptoDiscoMaster contract...");

    const CryptoDiscoMaster = await hre.ethers.getContractFactory("CryptoDiscoMaster");
    const cryptoDiscoMaster = await CryptoDiscoMaster.deploy(
        OPERATIONS_WALLET,
        TREASURY_WALLET,
        AIRNODE_RRP,
        PRICE_FEED
    );

    console.log("⏳ Waiting for deployment transaction to be mined...");
    await cryptoDiscoMaster.waitForDeployment();

    const contractAddress = await cryptoDiscoMaster.getAddress();
    console.log("✅ CryptoDiscoMaster deployed to:", contractAddress);
    console.log("");

    // Wait for a few block confirmations
    console.log("⏳ Waiting for 3 block confirmations...");
    await cryptoDiscoMaster.deploymentTransaction().wait(3);
    console.log("✅ Confirmed!\n");

    // ============ Post-Deployment Setup ============
    console.log("========================================");
    console.log("⚙️  Post-Deployment Configuration");
    console.log("========================================\n");

    // 1. Set Max Gas Price to 50 gwei
    console.log("1️⃣  Setting Max Gas Price to 50 gwei...");
    const maxGasPrice = hre.ethers.parseUnits("50", "gwei");
    const setGasPriceTx = await cryptoDiscoMaster.setMaxGasPrice(maxGasPrice);
    console.log("   Transaction hash:", setGasPriceTx.hash);
    await setGasPriceTx.wait();
    console.log("   ✅ Max Gas Price set to 50 gwei\n");

    // Add delay to prevent nonce issues
    console.log("⏳ Waiting 5 seconds before next transaction...");
    await new Promise(r => setTimeout(r, 5000));

    // 2. Set Ticket Price to $0.15 (150000 with 6 decimals)
    console.log("2️⃣  Setting Ticket Price to $0.15 USD...");
    const ticketPriceUSD = 150000; // $0.15 with 6 decimals
    const setTicketPriceTx = await cryptoDiscoMaster.setTicketPrice(ticketPriceUSD);
    console.log("   Transaction hash:", setTicketPriceTx.hash);
    await setTicketPriceTx.wait();
    console.log("   ✅ Ticket Price set to $0.15 USD\n");

    // ============ Verification Info ============
    console.log("========================================");
    console.log("📝 Contract Verification");
    console.log("========================================\n");
    console.log("To verify on BaseScan, run:");
    console.log(`npx hardhat verify --network baseSepolia ${contractAddress} "${OPERATIONS_WALLET}" "${TREASURY_WALLET}" "${AIRNODE_RRP}" "${PRICE_FEED}"`);
    console.log("");

    // ============ Deployment Summary ============
    console.log("========================================");
    console.log("📊 Deployment Summary");
    console.log("========================================");
    console.log("Contract Address:", contractAddress);
    console.log("Network: Base Sepolia");
    console.log("Deployer:", deployer.address);
    console.log("Max Gas Price: 50 gwei");
    console.log("Ticket Price: $0.15 USD");
    console.log("Operations Wallet:", OPERATIONS_WALLET);
    console.log("Treasury Wallet:", TREASURY_WALLET);
    console.log("========================================\n");

    // ============ Save Deployment Info ============
    const deploymentInfo = {
        network: "baseSepolia",
        contractAddress: contractAddress,
        deployer: deployer.address,
        operationsWallet: OPERATIONS_WALLET,
        treasuryWallet: TREASURY_WALLET,
        airnodeRrp: AIRNODE_RRP,
        priceFeed: PRICE_FEED,
        maxGasPrice: "50 gwei",
        ticketPriceUSD: "$0.15",
        deployedAt: new Date().toISOString(),
        transactionHash: cryptoDiscoMaster.deploymentTransaction().hash
    };

    console.log("💾 Deployment info saved:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    console.log("\n✨ Deployment completed successfully! ✨\n");
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
