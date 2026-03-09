const { ethers } = require("hardhat");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../Raffle_Frontend/.env') });

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying DailyAppV13 with account:", deployer.address);

    const creatorToken = "0x3ba0C1fA4D6F2f758B8Fb222B063b8f6969dAFB4"; // Creator Token on Base
    const usdcToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
    const initialOwner = deployer.address;

    console.log("📍 Params:", { creatorToken, usdcToken, initialOwner });

    const DailyApp = await ethers.getContractFactory("DailyAppV13");
    const contract = await DailyApp.deploy(creatorToken, usdcToken, initialOwner);

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("✅ DailyAppV13 deployed to:", address);
    console.log("📝 Update your .env VITE_V12_CONTRACT_ADDRESS to this new address.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
