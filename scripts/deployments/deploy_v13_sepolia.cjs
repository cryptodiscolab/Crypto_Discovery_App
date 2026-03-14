const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying DailyAppV13 to Base Sepolia...");
    console.log("Deployer:", deployer.address);
    console.log("Balance :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    const CREATOR_TOKEN = process.env.CREATOR_TOKEN_ADDRESS || "0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c";
    const USDC_TOKEN = process.env.USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const INITIAL_OWNER = deployer.address;

    console.log("\n🔧 Params:");
    console.log("   Creator Token:", CREATOR_TOKEN);
    console.log("   USDC Token   :", USDC_TOKEN);
    console.log("   Owner        :", INITIAL_OWNER);

    const DailyAppV13 = await ethers.getContractFactory("DailyAppV13");
    const contract = await DailyAppV13.deploy(CREATOR_TOKEN, USDC_TOKEN, INITIAL_OWNER);

    console.log("\n⏳ Waiting for deployment confirmation...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("\n✅ DailyAppV13 deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
