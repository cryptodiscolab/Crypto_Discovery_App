const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting Full Master Ecosystem Deployment...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(balance), "ETH\n");

    // 1. Load Parameters (toLowerCase to bypass strict Ethers v6 checksums)
    const USDC_ADDR = (process.env.USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e").toLowerCase();
    const CREATOR_TOKEN = (process.env.CREATOR_TOKEN_ADDRESS || "0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c").toLowerCase();
    const OPS_WALLET = (process.env.OPERATIONS_WALLET || "0x73F76B2b436E2E50bB6F81A6e33a42875f1cDff3").toLowerCase();
    const TREASURY = (process.env.TREASURY_WALLET || "0xAfB7C7E711418EFD744f74B4D92c2b91B9668fAa").toLowerCase();
    const PRICE_FEED = (process.env.PRICE_FEED_ETH_USD || "0x4adC67696BA383f43fd60604633031D935f9584b").toLowerCase();
    const AIRNODE_RRP = (process.env.AIRNODE_RRP || "0x2ab9f26E18b6103274414940251539D0105e2Add").toLowerCase();

    console.log("📋 Parameters:");
    console.log("   USDC:", USDC_ADDR);
    console.log("   Creator Token:", CREATOR_TOKEN);
    console.log("   Ops Wallet:", OPS_WALLET);
    console.log("   Treasury Wallet:", TREASURY);
    console.log("   Price Feed ETH/USD:", PRICE_FEED);
    console.log("   Airnode RRP:", AIRNODE_RRP);
    console.log("------------------------------------------\n");

    let currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending");
    console.log("🔢 Starting Nonce:", currentNonce);

    // ==========================================
    // 1. Deploy ContentCMSV2
    // ==========================================
    console.log("⏳ [1/4] Deploying ContentCMSV2...");
    const ContentCMSV2Factory = await hre.ethers.getContractFactory("ContentCMSV2");
    const cms = await ContentCMSV2Factory.deploy(deployer.address, { nonce: currentNonce++ });
    await cms.waitForDeployment();
    const cmsAddr = await cms.getAddress();
    console.log("✅ ContentCMSV2 deployed at:", cmsAddr);

    // ==========================================
    // 2. Deploy CryptoDiscoMasterX
    // ==========================================
    console.log("\n⏳ [2/4] Deploying CryptoDiscoMasterX...");
    const MasterXFactory = await hre.ethers.getContractFactory("CryptoDiscoMasterX");
    const masterX = await MasterXFactory.deploy(OPS_WALLET, TREASURY, PRICE_FEED, { nonce: currentNonce++ });
    await masterX.waitForDeployment();
    const masterXAddr = await masterX.getAddress();
    console.log("✅ CryptoDiscoMasterX deployed at:", masterXAddr);

    // ==========================================
    // 3. Deploy CryptoDiscoRaffle
    // ==========================================
    console.log("\n⏳ [3/4] Deploying CryptoDiscoRaffle...");
    const RaffleFactory = await hre.ethers.getContractFactory("CryptoDiscoRaffle");
    const raffle = await RaffleFactory.deploy(masterXAddr, AIRNODE_RRP, { nonce: currentNonce++ });
    await raffle.waitForDeployment();
    const raffleAddr = await raffle.getAddress();
    console.log("✅ CryptoDiscoRaffle deployed at:", raffleAddr);

    // ==========================================
    // 4. Deploy DailyAppV13
    // ==========================================
    console.log("\n⏳ [4/4] Deploying DailyAppV13...");
    const DailyAppFactory = await hre.ethers.getContractFactory("DailyAppV13");
    const dailyApp = await DailyAppFactory.deploy(CREATOR_TOKEN, USDC_ADDR, deployer.address, { nonce: currentNonce++ });
    await dailyApp.waitForDeployment();
    const dailyAddr = await dailyApp.getAddress();
    console.log("✅ DailyAppV13 deployed at:", dailyAddr);

    // ==========================================
    // 5. Cross-Linking Contracts
    // ==========================================
    console.log("\n🔗 Cross-Linking Ecosystem Contracts...");

    console.log("   - Setting MasterX in DailyApp...");
    const link1 = await dailyApp.setMasterX(masterXAddr, { nonce: currentNonce++ });
    await link1.wait();

    console.log("   - Setting DailyApp in MasterX...");
    const link2 = await masterX.setDailyAppContract(dailyAddr, { nonce: currentNonce++ });
    await link2.wait();

    console.log("   - Authorizing DailyApp as Satellite in MasterX...");
    const link3 = await masterX.setSatelliteStatus(dailyAddr, true, { nonce: currentNonce++ });
    await link3.wait();

    console.log("   - Setting Raffle in MasterX...");
    const link4 = await masterX.setRaffleContract(raffleAddr, { nonce: currentNonce++ });
    await link4.wait();

    console.log("   - Authorizing Raffle as Satellite in MasterX...");
    const link5 = await masterX.setSatelliteStatus(raffleAddr, true, { nonce: currentNonce++ });
    await link5.wait();

    // ==========================================
    // 6. Setup Tier Configs in DailyApp
    // ==========================================
    console.log("\n⚙️ Setting up Tier Configs in DailyApp...");
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

    const setupTiersTx = await dailyApp.setNFTConfigsBatch(tiers, points, prices, bonuses, multipliers, supplies, opens, { nonce: currentNonce++ });
    await setupTiersTx.wait();
    console.log("✅ Tier Configs Initialized.");

    console.log("\n🎉 Ecosystem Deployment & Configuration Complete!");
    console.log("=================================================");
    console.log(`VITE_CMS_CONTRACT_ADDRESS_SEPOLIA=${cmsAddr}`);
    console.log(`VITE_MASTER_X_ADDRESS_SEPOLIA=${masterXAddr}`);
    console.log(`VITE_RAFFLE_ADDRESS_SEPOLIA=${raffleAddr}`);
    console.log(`VITE_V12_CONTRACT_ADDRESS_SEPOLIA=${dailyAddr}`);
    console.log("=================================================\n");

    console.log("Next Steps:");
    console.log("1. Update .env and .cursorrules with the new addresses.");
    console.log("2. Run the initialization script for CMS: npx hardhat run scripts/initialize-cms.js --network base-sepolia");
    console.log("3. Verify the contracts on Basescan.");
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});
