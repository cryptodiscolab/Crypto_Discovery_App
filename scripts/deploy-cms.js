const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying ContentCMSV2 contract to Base Sepolia...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString(), "\n");

    // Deploy ContentCMSV2 contract
    const ContentCMSV2 = await hre.ethers.getContractFactory("ContentCMSV2");
    const contentCMS = await ContentCMSV2.deploy(deployer.address);

    await contentCMS.waitForDeployment();
    const contractAddress = await contentCMS.getAddress();

    console.log("✅ ContentCMSV2 deployed to:", contractAddress);
    console.log("👤 Admin set to:", deployer.address);
    console.log("🔑 Deployer has DEFAULT_ADMIN_ROLE and OPERATOR_ROLE");

    console.log("\n📋 Add this to your .env file:");
    console.log(`VITE_CMS_CONTRACT_ADDRESS=${contractAddress}`);

    // Wait for a few block confirmations before verifying
    console.log("\n⏳ Waiting for block confirmations...");
    await contentCMS.deploymentTransaction().wait(5);

    // Verify contract on BaseScan
    console.log("\n🔍 Verifying contract on BaseScan...");
    try {
        await hre.run("verify:verify", {
            address: contractAddress,
            constructorArguments: [deployer.address],
        });
        console.log("✅ Contract verified successfully!");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("✅ Contract already verified!");
        } else {
            console.log("❌ Verification failed:", error.message);
        }
    }

    console.log("\n🎉 Deployment complete!");
    console.log("🔗 View on BaseScan: https://sepolia.basescan.org/address/" + contractAddress);
    console.log("\n📌 Next steps:");
    console.log("1. Update .env with the contract address above");
    console.log("2. Run: npx hardhat run scripts/initialize-cms.js --network base-sepolia");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
