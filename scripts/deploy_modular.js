/**
 * Automated Modular Deployment Sequence - Crypto Disco App
 * Network: Base Sepolia Testnet
 * 
 * Flow: 
 * 1. Deploy MasterX (Revenue & Points)
 * 2. Deploy Raffle (API3 & Tickets)
 * 3. Link MasterX -> Raffle (Setter)
 */

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("\n🚀 Starting Immutable Architect Deployment Protocol");
    console.log("📍 Deployer:", deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Config
    const OPS = process.env.OPERATIONS_WALLET || "0x742d35cc6634c0532925a3b844bc9e7595f0beb";
    const TREASURY = process.env.TREASURY_WALLET || "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199";
    const AIRNODE_RRP = "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd";
    const PRICE_FEED = "0x4adc43e4f3841847bb1479f4a079cf294975267d";

    // --- STEP 1: Deploy MasterX ---
    console.log("⏳ [1/3] Deploying CryptoDiscoMasterX...");
    const MasterX = await hre.ethers.getContractFactory("CryptoDiscoMasterX");
    const master = await MasterX.deploy(OPS, TREASURY, PRICE_FEED);
    await master.waitForDeployment();
    const masterAddr = await master.getAddress();
    console.log("✅ MasterX Deployed at:", masterAddr);

    // --- STEP 2: Deploy Raffle ---
    console.log("\n⏳ [2/3] Deploying CryptoDiscoRaffle...");
    const Raffle = await hre.ethers.getContractFactory("CryptoDiscoRaffle");
    const raffle = await Raffle.deploy(masterAddr, AIRNODE_RRP);
    await raffle.waitForDeployment();
    const raffleAddr = await raffle.getAddress();
    console.log("✅ Raffle Deployed at:", raffleAddr);

    // --- STEP 3: Cross-Linking ---
    console.log("\n⏳ [3/3] Linking MasterX to Raffle...");
    const linkTx = await master.setRaffleContract(raffleAddr);
    await linkTx.wait();
    console.log("✅ Linking Successful. TX:", linkTx.hash);

    // Final Report Summary
    console.log("\n==========================================");
    console.log("📊 IMMUTABLE ARCHITECT DEPLOYMENT SUMMARY");
    console.log("==========================================");
    console.log("MasterX Address: ", masterAddr);
    console.log("Raffle Address:  ", raffleAddr);
    console.log("Status:           OPERATIONAL");
    console.log("==========================================\n");
}

main().catch((error) => {
    console.error("\n❌ DEPLOYMENT CRITICAL FAILURE");
    if (error.code === "INSUFFICIENT_FUNDS") {
        console.error("Reason: Wallet has insufficient gas for deployment.");
    } else if (error.message.includes("ProviderError")) {
        console.error("Reason: RPC Provider error. Check network connectivity.");
    } else {
        console.error(error);
    }
    process.exit(1);
});
