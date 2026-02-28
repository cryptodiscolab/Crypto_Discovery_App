const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // Load Params from .env and ensure correct checksum for ethers v6
    const opsWallet = ethers.getAddress(process.env.OPERATIONS_WALLET.toLowerCase());
    const treasuryWallet = ethers.getAddress(process.env.TREASURY_WALLET.toLowerCase());
    const airnodeRrp = ethers.getAddress(process.env.AIRNODE_RRP.toLowerCase());
    const priceFeed = ethers.getAddress(process.env.PRICE_FEED_ETH_USD.toLowerCase());
    const usdcAddress = ethers.getAddress(process.env.USDC_ADDRESS.toLowerCase());
    const creatorTokenAddress = ethers.getAddress(process.env.CREATOR_TOKEN_ADDRESS.toLowerCase());

    if (!opsWallet || !treasuryWallet || !airnodeRrp || !priceFeed || !usdcAddress || !creatorTokenAddress) {
        console.error("Missing environment variables in .env!");
        process.exit(1);
    }

    console.log("\n--- Starting Deployment Sequence ---");

    // 1. Deploy CryptoDiscoMasterX
    console.log("1. Deploying CryptoDiscoMasterX...");
    const MasterX = await ethers.getContractFactory("CryptoDiscoMasterX");
    const masterX = await MasterX.deploy(opsWallet, treasuryWallet, priceFeed);
    await masterX.waitForDeployment();
    const masterXAddress = await masterX.getAddress();
    console.log("✅ CryptoDiscoMasterX deployed to:", masterXAddress);

    // 2. Deploy CryptoDiscoRaffle
    console.log("2. Deploying CryptoDiscoRaffle...");
    const Raffle = await ethers.getContractFactory("CryptoDiscoRaffle");
    const raffle = await Raffle.deploy(masterXAddress, airnodeRrp);
    await raffle.waitForDeployment();
    const raffleAddress = await raffle.getAddress();
    console.log("✅ CryptoDiscoRaffle deployed to:", raffleAddress);

    // 3. Deploy DailyAppV12Secured
    console.log("3. Deploying DailyAppV12Secured...");
    const DailyApp = await ethers.getContractFactory("DailyAppV12Secured");
    const dailyApp = await DailyApp.deploy(creatorTokenAddress, usdcAddress, deployer.address);
    await dailyApp.waitForDeployment();
    const dailyAppAddress = await dailyApp.getAddress();
    console.log("✅ DailyAppV12Secured deployed to:", dailyAppAddress);

    console.log("\n--- Finalizing Integration ---");

    // 4. Link MasterX and Raffle
    console.log("Linking MasterX and Raffle...");
    await (await masterX.setRaffleContract(raffleAddress)).wait();
    console.log("✅ MasterX -> Raffle Linked");

    // 5. Link DailyApp and MasterX
    console.log("Linking DailyApp and MasterX...");
    await (await dailyApp.setMasterX(masterXAddress)).wait();
    console.log("✅ DailyApp -> MasterX Linked");

    // 6. Set DailyApp as Satellite in MasterX
    console.log("Setting DailyApp as Satellite...");
    await (await masterX.setSatelliteStatus(dailyAppAddress, true)).wait();
    console.log("✅ DailyApp set as Satellite in MasterX");

    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log("MASTER_X_ADDRESS=" + masterXAddress);
    console.log("RAFFLE_ADDRESS=" + raffleAddress);
    console.log("DAILY_APP_ADDRESS=" + dailyAppAddress);
    console.log("\nUpdate your .env and Raffle_Frontend/src/lib/contracts.js with these values.");
}

main().catch(console.error);
