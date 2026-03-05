const hre = require("hardhat");

async function main() {
    const DAILY_ADDR = "0x3ba0C1fA4D6F2f758B8Fb222B063b8f6969dAFB4";
    const MASTER_ADDR = "0x6136d93F57271049B85E46dfd2a09dD247daAD66";

    console.log("🛠️  Resuming Setup for:");
    console.log("   DailyApp:", DAILY_ADDR);
    console.log("   MasterX :", MASTER_ADDR);

    const dailyApp = await hre.ethers.getContractAt("DailyAppV12Secured", DAILY_ADDR);
    const masterX = await hre.ethers.getContractAt("CryptoDiscoMasterX", MASTER_ADDR);

    console.log("\n🔗 Linking Contracts...");

    console.log("   - Setting MasterX in DailyApp...");
    const tx1 = await dailyApp.setMasterX(MASTER_ADDR);
    await tx1.wait();
    console.log("     Done.");

    console.log("   - Setting DailyApp in MasterX...");
    const tx2 = await masterX.setDailyAppContract(DAILY_ADDR);
    await tx2.wait();
    console.log("     Done.");

    console.log("   - Authorizing DailyApp as Satellite in MasterX...");
    const tx3 = await masterX.setSatelliteStatus(DAILY_ADDR, true);
    await tx3.wait();
    console.log("     Done.");

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

    console.log("\n🎉 Setup Complete!");
}

main().catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exitCode = 1;
});
