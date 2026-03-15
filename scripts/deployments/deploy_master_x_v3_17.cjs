const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying CryptoDiscoMasterX (v3.17.0) to Base Sepolia...");
    console.log("Deployer:", deployer.address);
    console.log("Balance :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // Params from .env or constants for Base Sepolia
    const OPS_WALLET = ethers.getAddress(process.env.OPERATIONS_WALLET || "0x73F76B2b436E2E50bB6F81A6e33a42875f1cDff3");
    const TREASURY_WALLET = ethers.getAddress(process.env.TREASURY_WALLET || "0xAfB7C7E711418EFD744f74B4D92c2b91B9668fAa");
    const PRICE_FEED = ethers.getAddress(process.env.PRICE_FEED_ETH_USD || "0x4aDC67696BA383f43fd60604633031D935f9584b");

    console.log("\n🔧 Params:");
    console.log("   Ops Wallet  :", OPS_WALLET);
    console.log("   Treasury    :", TREASURY_WALLET);
    console.log("   Price Feed  :", PRICE_FEED);

    const MasterX = await ethers.getContractFactory("CryptoDiscoMasterX");
    const contract = await MasterX.deploy(OPS_WALLET, TREASURY_WALLET, PRICE_FEED);

    console.log("\n⏳ Waiting for deployment confirmation...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("\n✅ CryptoDiscoMasterX deployed to:", address);
    
    console.log("\n💡 Next Steps:");
    console.log(`   1. Update .env: MASTER_X_ADDRESS=${address}`);
    console.log(`   2. Run: npx hardhat run scripts/sync/sync-sbt.cjs --network base-sepolia`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
