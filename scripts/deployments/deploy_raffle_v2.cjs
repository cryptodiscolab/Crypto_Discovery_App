const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    console.log("\n🚀 Starting CryptoDiscoRaffle Deployment...");

    const masterXAddress = ethers.getAddress((process.env.VITE_MASTER_X_ADDRESS_SEPOLIA || process.env.MASTER_X_ADDRESS_SEPOLIA).toLowerCase());
    const airnodeRrpAddress = ethers.getAddress((process.env.AIRNODE_RRP || "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd").toLowerCase());

    if (!masterXAddress) {
        throw new Error("MASTER_X_ADDRESS_SEPOLIA missing in .env");
    }

    console.log("📍 MasterX Address:", masterXAddress);
    console.log("📍 AirnodeRRP Address:", airnodeRrpAddress);

    const rrpCode = await ethers.provider.getCode(airnodeRrpAddress);
    if (!rrpCode || rrpCode === "0x") {
        throw new Error(`AIRNODE_RRP has no bytecode on this network: ${airnodeRrpAddress}`);
    }

    const [deployer] = await ethers.getSigners();
    console.log("👤 Deployer Wallet:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Wallet Balance:", ethers.formatEther(balance), "ETH");

    const Raffle = await ethers.getContractFactory("CryptoDiscoRaffle");
    const raffle = await Raffle.deploy(masterXAddress, airnodeRrpAddress);

    console.log("⏳ Waiting for deployment...");
    await raffle.waitForDeployment();

    const deployedAddress = await raffle.getAddress();
    console.log("\n✅ CryptoDiscoRaffle deployed to:", deployedAddress);
    
    console.log("\n--- NEXT STEPS ---");
    console.log("1. Update .env with VITE_RAFFLE_ADDRESS_SEPOLIA=" + deployedAddress);
    console.log("2. Run npx hardhat verify " + deployedAddress + " " + masterXAddress + " " + airnodeRrpAddress + " --network base-sepolia");
    console.log("3. Link the Raffle to MasterX using the setRaffleContract function.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
