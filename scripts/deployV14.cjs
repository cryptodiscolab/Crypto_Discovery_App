require("dotenv").config();
const hre = require("hardhat");

async function main() {
    const CREATOR_TOKEN = process.env.CREATOR_TOKEN_ADDRESS;
    const USDC = process.env.USDC_ADDRESS;
    const DEPLOYER = (await hre.ethers.getSigners())[0].address;

    console.log("🚀 Deploying DailyAppV14...");
    console.log("  Creator Token:", CREATOR_TOKEN);
    console.log("  USDC:", USDC);
    console.log("  Deployer/Admin:", DEPLOYER);

    const Factory = await hre.ethers.getContractFactory("DailyAppV14");
    const contract = await Factory.deploy(CREATOR_TOKEN, USDC, DEPLOYER);
    await contract.waitForDeployment();

    const addr = await contract.getAddress();
    console.log("✅ DailyAppV14 deployed to:", addr);

    // Post-deploy config
    console.log("⚙️  Setting sponsorship params (all in 6-dec USDC base)...");
    const tx = await contract.setSponsorshipParams(
        200000,   // rewardPerClaim = $0.20 (6-dec)
        3,        // tasksForReward = 3
        2000000,  // minRewardPoolValue = $2.00 (6-dec)
        2000000   // sponsorshipPlatformFee = $2.00 (6-dec)
    );
    await tx.wait();
    console.log("✅ Sponsorship params set");

    console.log("\n📋 Summary:");
    console.log("  VITE_DAILY_APP_V14_ADDRESS=" + addr);
    console.log("  DAILY_APP_ADDRESS=" + addr);
    console.log("  DAILY_APP_ADDRESS_SEPOLIA=" + addr);
    console.log("\n⚠️  Update .env files with the address above!");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌ Deploy failed:", err);
        process.exit(1);
    });
