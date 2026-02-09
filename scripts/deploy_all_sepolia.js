const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    const opsWallet = ethers.getAddress(process.env.OPERATIONS_WALLET.toLowerCase());
    const treasuryWallet = ethers.getAddress(process.env.TREASURY_WALLET.toLowerCase());
    const airnodeRrp = ethers.getAddress(process.env.AIRNODE_RRP.toLowerCase());
    const priceFeed = ethers.getAddress(process.env.PRICE_FEED_ETH_USD.toLowerCase());

    console.log("--- Deployment Params ---");
    console.log("Ops Wallet:", opsWallet);
    console.log("Treasury Wallet:", treasuryWallet);
    console.log("Airnode RRP:", airnodeRrp);
    console.log("Price Feed:", priceFeed);

    // Pre-check Price Feed
    try {
        const feed = await ethers.getContractAt([
            "function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)"
        ], priceFeed);
        const data = await feed.latestRoundData();
        console.log("Price Feed Check: Success, Price =", data[1].toString());
    } catch (e) {
        console.log("Price Feed Check: FAILED!", e.message);
    }

    // 1. Reward Token (Already deployed)
    const creatorTokenAddress = "0xBe7860B95B8CdF96aF44a30e8c7FE844f2358826";
    console.log("Reward Token:", creatorTokenAddress);

    // 2. ContentCMSV2 (Already deployed)
    const cmsAddress = "0xf55280bba6F34C68B1459aFd70B8798A07A8A613";
    console.log("ContentCMSV2:", cmsAddress);

    // 3. Deploy CryptoDiscoMaster
    console.log("Deploying CryptoDiscoMaster...");
    const CryptoDiscoMaster = await ethers.getContractFactory("CryptoDiscoMaster");
    try {
        const master = await CryptoDiscoMaster.deploy(
            opsWallet,
            treasuryWallet,
            airnodeRrp,
            priceFeed,
            { gasLimit: 5000000 }
        );
        await master.waitForDeployment();
        const masterAddress = await master.getAddress();
        console.log("CryptoDiscoMaster deployed to:", masterAddress);

        // 4. Deploy DailyAppV12Secured
        const paymentTokenAddress = ethers.getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e".toLowerCase());
        console.log("Deploying DailyAppV12Secured...");
        const DailyAppV12Secured = await ethers.getContractFactory("DailyAppV12Secured");
        const dailyApp = await DailyAppV12Secured.deploy(
            creatorTokenAddress,
            paymentTokenAddress,
            priceFeed,
            deployer.address,
            { gasLimit: 8000000 }
        );
        await dailyApp.waitForDeployment();
        const dailyAppAddress = await dailyApp.getAddress();
        console.log("DailyAppV12Secured deployed to:", dailyAppAddress);

        console.log("\n--- Final Deployment Summary ---");
        console.log("Creator Token:", creatorTokenAddress);
        console.log("ContentCMSV2:", cmsAddress);
        console.log("CryptoDiscoMaster:", masterAddress);
        console.log("DailyAppV12Secured:", dailyAppAddress);
    } catch (e) {
        console.error("Deployment Failed:", e);
        if (e.data) {
            console.log("Error Data:", e.data);
        }
    }
}

main().catch(console.error);
