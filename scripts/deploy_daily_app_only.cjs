const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const usdcAddress = ethers.getAddress(process.env.USDC_ADDRESS.toLowerCase());
    const creatorTokenAddress = ethers.getAddress(process.env.CREATOR_TOKEN_ADDRESS.toLowerCase());
    const MASTER_X = process.env.MASTER_X_ADDRESS;

    if (!usdcAddress || !creatorTokenAddress || !MASTER_X) {
        throw new Error("Missing env vars (USDC, Creator Token, MasterX)");
    }

    console.log("Deploying DailyAppV12Secured...");
    const DailyApp = await ethers.getContractFactory("DailyAppV12Secured");
    const dailyApp = await DailyApp.deploy(creatorTokenAddress, usdcAddress, deployer.address);
    await dailyApp.waitForDeployment();
    
    const dailyAppAddress = await dailyApp.getAddress();
    console.log("✅ DailyAppV12Secured deployed to:", dailyAppAddress);

    console.log("Linking DailyApp to MasterX...");
    await (await dailyApp.setMasterX(MASTER_X)).wait();
    console.log("✅ DailyApp -> MasterX Link Set!");

    console.log("Setting Satellite Role and linking MasterX -> DailyApp...");
    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", MASTER_X);
    
    await (await masterX.setSatelliteStatus(dailyAppAddress, true)).wait();
    console.log("✅ MasterX Satellite status set.");

    await (await masterX.setDailyAppContract(dailyAppAddress)).wait();
    console.log("✅ MasterX -> DailyApp contract linked!");

    // Set initial tier configs for testing
    // Bronze: Tier 1
    await (await masterX.setTierConfig(1, 0, 0)).wait();
    console.log("✅ MasterX Tier Configs Set for Simulation");

    console.log(`\nNew DAILY_APP_ADDRESS=${dailyAppAddress}`);
}

main().catch(console.error);
