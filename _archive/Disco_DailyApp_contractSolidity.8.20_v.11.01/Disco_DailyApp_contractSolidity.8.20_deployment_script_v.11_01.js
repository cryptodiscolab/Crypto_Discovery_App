// scripts/deploy.js
const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting DailyAppV11Secured deployment...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // Configuration
    const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const INITIAL_OWNER = process.env.INITIAL_OWNER || deployer.address;

    console.log("\n⚙️  Deployment Configuration:");
    console.log("   Token Address:", TOKEN_ADDRESS);
    console.log("   Initial Owner:", INITIAL_OWNER);

    // Validate addresses
    if (TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") {
        console.error("\n❌ ERROR: TOKEN_ADDRESS not set in environment variables!");
        console.log("Please set TOKEN_ADDRESS in your .env file");
        process.exit(1);
    }

    // Deploy DailyAppV11Secured
    console.log("\n📦 Deploying DailyAppV11Secured contract...");
    const DailyApp = await ethers.getContractFactory("DailyAppV11Secured");
    const dailyApp = await DailyApp.deploy(TOKEN_ADDRESS, INITIAL_OWNER);

    await dailyApp.waitForDeployment();
    const contractAddress = await dailyApp.getAddress();

    console.log("✅ DailyAppV11Secured deployed to:", contractAddress);

    // Wait for block confirmations
    console.log("\n⏳ Waiting for block confirmations...");
    await dailyApp.deploymentTransaction().wait(5);
    console.log("✅ Confirmed!");

    // Verify contract on Etherscan (if not localhost)
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("\n🔍 Verifying contract on Etherscan...");
        try {
            await hre.run("verify:verify", {
                address: contractAddress,
                constructorArguments: [TOKEN_ADDRESS, INITIAL_OWNER],
            });
            console.log("✅ Contract verified on Etherscan!");
        } catch (error) {
            console.log("⚠️  Verification failed:", error.message);
            console.log("You can verify manually later with:");
            console.log(`npx hardhat verify --network ${hre.network.name} ${contractAddress} ${TOKEN_ADDRESS} ${INITIAL_OWNER}`);
        }
    }

    // Get initial contract state
    console.log("\n📊 Initial Contract State:");
    const stats = await dailyApp.getContractStats();
    console.log("   Total Users:", stats[0].toString());
    console.log("   Total Transactions:", stats[1].toString());
    console.log("   Total Sponsor Requests:", stats[2].toString());

    // Display tier configurations
    console.log("\n🎯 NFT Tier Configurations:");
    const tiers = ["NONE", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
    for (let i = 1; i <= 5; i++) {
        const config = await dailyApp.nftConfigs(i);
        console.log(`\n   ${tiers[i]} Tier:`);
        console.log(`   - Points Required: ${config.pointsRequired.toString()}`);
        console.log(`   - Mint Price: ${ethers.formatEther(config.mintPrice)} ETH`);
        console.log(`   - Daily Bonus: ${config.dailyBonus.toString()}`);
        console.log(`   - Multiplier: ${(config.multiplierBP / 100).toFixed(2)}%`);
        console.log(`   - Max Supply: ${config.maxSupply.toString()}`);
        console.log(`   - Current Supply: ${config.currentSupply.toString()}`);
    }

    // Display pricing configuration
    console.log("\n💵 Pricing Configuration:");
    const tokenPriceUSD = await dailyApp.tokenPriceUSD();
    console.log(`   Token Price: $${ethers.formatEther(tokenPriceUSD)}`);
    
    const packagePrices = await Promise.all([
        dailyApp.packagePricesUSD(0),
        dailyApp.packagePricesUSD(1),
        dailyApp.packagePricesUSD(2)
    ]);
    console.log(`   Bronze Package: $${ethers.formatEther(packagePrices[0])}`);
    console.log(`   Silver Package: $${ethers.formatEther(packagePrices[1])}`);
    console.log(`   Gold Package: $${ethers.formatEther(packagePrices[2])}`);

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        contractAddress: contractAddress,
        tokenAddress: TOKEN_ADDRESS,
        initialOwner: INITIAL_OWNER,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber(),
    };

    const fs = require('fs');
    const deploymentPath = `./deployments/${hre.network.name}_deployment.json`;
    
    // Create deployments directory if it doesn't exist
    if (!fs.existsSync('./deployments')) {
        fs.mkdirSync('./deployments');
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

    // Post-deployment checklist
    console.log("\n" + "=".repeat(60));
    console.log("✅ DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(60));
    console.log("\n📋 POST-DEPLOYMENT CHECKLIST:\n");
    console.log("1. ⚠️  Transfer ownership to multisig:");
    console.log(`   await dailyApp.transferOwnership("${INITIAL_OWNER}")`);
    console.log("\n2. 🎨 Set tier URIs:");
    console.log("   await dailyApp.setTierURI(1, 'ipfs://QmBronze...')");
    console.log("   await dailyApp.setTierURI(2, 'ipfs://QmSilver...')");
    console.log("   await dailyApp.setTierURI(3, 'ipfs://QmGold...')");
    console.log("   await dailyApp.setTierURI(4, 'ipfs://QmPlatinum...')");
    console.log("   await dailyApp.setTierURI(5, 'ipfs://QmDiamond...')");
    console.log("\n3. 📝 Add additional tasks:");
    console.log("   await dailyApp.addTask(...)");
    console.log("\n4. 📊 Set up monitoring (Tenderly/Defender)");
    console.log("\n5. 🐛 Launch bug bounty program");
    console.log("\n6. 📢 Announce deployment to community");
    console.log("\n" + "=".repeat(60));

    console.log("\n🔗 Important Links:");
    console.log(`   Contract: https://etherscan.io/address/${contractAddress}`);
    console.log(`   Network: ${hre.network.name}`);
    console.log(`   Block Explorer: ${getBlockExplorerUrl(hre.network.name)}/address/${contractAddress}`);
    
    console.log("\n✨ Deployment complete!\n");
}

function getBlockExplorerUrl(network) {
    const explorers = {
        mainnet: "https://etherscan.io",
        sepolia: "https://sepolia.etherscan.io",
        goerli: "https://goerli.etherscan.io",
        polygon: "https://polygonscan.com",
        mumbai: "https://mumbai.polygonscan.com",
        bsc: "https://bscscan.com",
        bscTestnet: "https://testnet.bscscan.com"
    };
    return explorers[network] || "https://etherscan.io";
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
