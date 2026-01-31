// scripts/deploy-raffle.js
const hre = require("hardhat");
const dotenv = require("dotenv");
dotenv.config();

async function main() {
    console.log("🚀 Deploying NFTRaffle contract with USDC support...\n");

    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);

    // API3 AirnodeRrpV0 addresses
    const AIRNODE_RRP_ADDRESSES = {
        "base": "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd",
        "base-sepolia": "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd",
    };

    // Default USDC Addresses
    const USDC_ADDRESSES = {
        "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    };

    const network = hre.network.name;
    const airnodeRrpAddress = AIRNODE_RRP_ADDRESSES[network];
    const usdcAddress = process.env.USDC_ADDRESS || USDC_ADDRESSES[network];

    if (!airnodeRrpAddress) {
        throw new Error(`AirnodeRrp address not found for network: ${network}`);
    }
    if (!usdcAddress) {
        throw new Error(`USDC address not found for network: ${network}`);
    }

    console.log("⚙️  Deployment Parameters:");
    console.log("   Network:", network);
    console.log("   AirnodeRrp:", airnodeRrpAddress);
    console.log("   USDC Token:", usdcAddress);

    const NFTRaffle = await ethers.getContractFactory("NFTRaffle");
    const nftRaffle = await NFTRaffle.deploy(airnodeRrpAddress, usdcAddress);

    await nftRaffle.waitForDeployment();
    const contractAddress = await nftRaffle.getAddress();

    console.log("\n✅ NFTRaffle deployed to:", contractAddress);

    // Verification
    if (network !== "hardhat" && network !== "localhost") {
        console.log("\n⏳ Waiting for confirmations...");
        await nftRaffle.deploymentTransaction().wait(5);

        console.log("🔍 Verifying on Basescan...");
        try {
            await hre.run("verify:verify", {
                address: contractAddress,
                constructorArguments: [airnodeRrpAddress, usdcAddress],
            });
            console.log("✅ Verified!");
        } catch (error) {
            console.log("⚠️  Verification failed:", error.message);
        }
    }

    console.log("\n✨ Deployment Complete!");
    console.log(`Update your Frontend .env with: VITE_CONTRACT_ADDRESS=${contractAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
