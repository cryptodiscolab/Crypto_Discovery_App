const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const masterXAddress = ethers.getAddress((process.env.VITE_MASTER_X_ADDRESS_SEPOLIA || process.env.MASTER_X_ADDRESS_SEPOLIA).toLowerCase());
    const raffleAddress = ethers.getAddress("0xE7CB85c307f1c368DCB9FFcfa5f3e02324eaf1f3".toLowerCase());

    console.log("🔗 Linking & Initializing Raffle...");
    console.log("📍 MasterX:", masterXAddress);
    console.log("📍 Raffle:", raffleAddress);

    const [signer] = await ethers.getSigners();
    console.log("👤 Using account:", signer.address);

    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", masterXAddress);
    const raffle = await ethers.getContractAt("CryptoDiscoRaffle", raffleAddress);

    // 1. Link Raffle to MasterX
    console.log("⏳ 1/2 Linking Raffle to MasterX...");
    const tx1 = await masterX.setRaffleContract(raffleAddress);
    await tx1.wait();
    console.log("✅ Linked");

    // 2. Initialize First Raffle
    console.log("⏳ 2/2 Initializing First Raffle...");
    const tx2 = await raffle.initializeFirstRaffle();
    await tx2.wait();
    console.log("✅ Initialized");

    console.log("\n🚀 ECOSYSTEM SYNC COMPLETE");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
