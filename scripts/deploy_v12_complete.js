const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting Complete V12 System Deployment...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(balance), "ETH\n");

    // 1. Load Parameters
    const USDC_ADDR = process.env.USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const CREATOR_TOKEN = process.env.CREATOR_TOKEN_ADDRESS || "0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c";
    const OPS_WALLET = process.env.OPERATIONS_WALLET || "0x73F76B2b436E2E50bB6F81A6e33a42875f1cDff3";
    const TREASURY = process.env.TREASURY_WALLET || "0xAfB7C7E711418EFD744f74B4D92c2b91B9668fAa";
    const PRICE_FEED = process.env.PRICE_FEED_ETH_USD || "0x4adC67696BA383f43fd60604633031D935f9584b";

    console.log("📋 Parameters:");
    console.log("   USDC:", USDC_ADDR);
    console.log("   Creator Token:", CREATOR_TOKEN);
    console.log("   Ops Wallet:", OPS_WALLET);
    console.log("   Treasury:", TREASURY);
    console.log("   Price Feed:", PRICE_FEED);
    console.log("------------------------------------------\n");

    // 2. Deploy DailyAppV12Secured
    console.log("⏳ Deploying DailyAppV12Secured...");
    const DailyAppFactory = await hre.ethers.getContractFactory("DailyAppV12Secured");
    const dailyApp = await DailyAppFactory.deploy(CREATOR_TOKEN, USDC_ADDR, deployer.address);
    await dailyApp.waitForDeployment();
    const dailyAddr = await dailyApp.getAddress();
    console.log("✅ DailyAppV12Secured deployed at:", dailyAddr);

    // 3. Deploy CryptoDiscoMasterX
    console.log("⏳ Deploying CryptoDiscoMasterX...");
    const MasterXFactory = await hre.ethers.getContractFactory("CryptoDiscoMasterX");
    const masterX = await MasterXFactory.deploy(OPS_WALLET, TREASURY, PRICE_FEED);
    await masterX.waitForDeployment();
    const masterXAddr = await masterX.getAddress();
    console.log("✅ CryptoDiscoMasterX deployed at:", masterXAddr);

    // 4. Link Contracts
    console.log("\n🔗 Linking Contracts...");

    console.log("   - Setting MasterX in DailyApp...");
    const tx1 = await dailyApp.setMasterX(masterXAddr);
    await tx1.wait();

    console.log("   - Setting DailyApp in MasterX...");
    const tx2 = await masterX.setDailyAppContract(dailyAddr);
    await tx2.wait();

    console.log("   - Authorizing DailyApp as Satellite in MasterX...");
    const tx3 = await masterX.setSatelliteStatus(dailyAddr, true);
    await tx3.wait();

    // 5. Setup Tier Configs (Initial Batch)
    console.log("\n⚙️ Setting up Tier Configs...");
    const tiers = [1, 2, 3, 4, 5]; // Bronze, Silver, Gold, Platinum, Diamond
    const points = [1000, 5000, 15000, 50000, 150000];
    const prices = [
        hre.ethers.parseEther("0.001"), // Bronze
        hre.ethers.parseEther("0.005"), // Silver
        hre.ethers.parseEther("0.015"), // Gold
        hre.ethers.parseEther("0.05"),  // Platinum
        hre.ethers.parseEther("0.15")   // Diamond
    ];
    const bonuses = [10, 25, 75, 200, 500];
    const multipliers = [11000, 12500, 15000, 20000, 30000]; // 1.1x to 3.0x
    const supplies = [10000, 5000, 1000, 500, 100];
    const opens = [true, true, true, true, true];

    const tx4 = await dailyApp.setNFTConfigsBatch(tiers, points, prices, bonuses, multipliers, supplies, opens);
    await tx4.wait();
    console.log("✅ Tier Configs Initialized.");

    console.log("\n🎉 Deployment & Configuration Complete!");
    console.log("==========================================");
    console.log("DAILY_APP_ADDRESS:", dailyAddr);
    console.log("MASTER_X_ADDRESS:", masterXAddr);
    console.log("==========================================\n");

    console.log("Next Steps:");
    console.log("1. Update .env with new addresses.");
    console.log("2. Update .cursorrules with new addresses.");
    console.log("3. Verify contracts on Basescan:");
    console.log(`   npx hardhat verify --network base-sepolia ${dailyAddr} "${CREATOR_TOKEN}" "${USDC_ADDR}" "${deployer.address}"`);
    console.log(`   npx hardhat verify --network base-sepolia ${masterXAddr} "${OPS_WALLET}" "${TREASURY}" "${PRICE_FEED}"`);
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});
