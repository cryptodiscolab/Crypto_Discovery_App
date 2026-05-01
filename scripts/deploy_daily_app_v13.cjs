const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const usdcAddress = ethers.getAddress((process.env.USDC_ADDRESS || "").toLowerCase());
    const creatorTokenAddress = ethers.getAddress((process.env.CREATOR_TOKEN_ADDRESS || "").toLowerCase());
    const MASTER_X = process.env.MASTER_X_ADDRESS;
    // We will use the same wallet as the verifier initially (or another defined env)
    const verifierWallet = deployer.address; 

    if (!usdcAddress || !creatorTokenAddress || !MASTER_X) {
        throw new Error("Missing env vars (USDC, Creator Token, MasterX)");
    }

    console.log("Deploying DailyAppV13...");
    const DailyApp = await ethers.getContractFactory("contracts/DailyAppV13.sol:DailyAppV13");
    const dailyApp = await DailyApp.deploy(creatorTokenAddress, usdcAddress, deployer.address);
    await dailyApp.waitForDeployment();
    
    const dailyAppAddress = await dailyApp.getAddress();
    console.log("✅ DailyAppV13 deployed to:", dailyAppAddress);

    console.log("Linking DailyAppV13 to MasterX...");
    await (await dailyApp.setMasterX(MASTER_X)).wait();
    console.log("✅ DailyAppV13 -> MasterX Link Set!");

    console.log(`Setting Verifier Wallet to: ${verifierWallet}`);
    await (await dailyApp.setVerifierWallet(verifierWallet)).wait();
    console.log("✅ Verifier Wallet Set!");

    console.log("Setting Satellite Role and linking MasterX -> DailyAppV13...");
    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", MASTER_X);
    
    await (await masterX.setSatelliteStatus(dailyAppAddress, true)).wait();
    console.log("✅ MasterX Satellite status set.");

    await (await masterX.setDailyAppContract(dailyAppAddress)).wait();
    console.log("✅ MasterX -> DailyAppV13 contract linked!");

    console.log(`\nDeployment Complete!`);
    console.log(`New VITE_DAILY_APP_V13_ADDRESS=${dailyAppAddress}`);
    console.log(`Remember to run the migration script next to migrate state from V12 to V13.`);
}

main().catch(console.error);
