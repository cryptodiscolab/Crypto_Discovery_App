const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const raffleAddress = ethers.getAddress("0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB".toLowerCase());

    console.log("⏳ Initializing Raffle #1...");
    console.log("📍 Raffle:", raffleAddress);

    const raffle = await ethers.getContractAt("CryptoDiscoRaffle", raffleAddress);

    // Manual gas override to bypass "underpriced" issues
    const tx = await raffle.initializeFirstRaffle({
        gasPrice: ethers.parseUnits("5", "gwei") // Force a reasonable price for Sepolia
    });
    
    console.log("   Transaction Hash:", tx.hash);
    await tx.wait();
    console.log("✅ Initialized SUCCESSFULLY!");
}

main().catch(console.error);
