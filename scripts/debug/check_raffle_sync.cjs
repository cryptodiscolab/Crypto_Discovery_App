const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const masterXAddress = ethers.getAddress((process.env.VITE_MASTER_X_ADDRESS_SEPOLIA || process.env.MASTER_X_ADDRESS_SEPOLIA).toLowerCase());
    const raffleAddress = ethers.getAddress("0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB".toLowerCase());

    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", masterXAddress);
    const raffle = await ethers.getContractAt("CryptoDiscoRaffle", raffleAddress);

    const linkedRaffle = await masterX.raffleContract();
    const raffleId = await raffle.currentRaffleId();

    console.log("--- SYNC CHECK ---");
    console.log("MasterX's Raffle:", linkedRaffle);
    console.log("Raffle's Current ID:", raffleId.toString());
    console.log("Is linked correctly?", linkedRaffle.toLowerCase() === raffleAddress.toLowerCase() ? "✅ YES" : "❌ NO");
    console.log("Is initialized?", raffleId.toString() !== "0" ? "✅ YES" : "❌ NO");
}

main().catch(console.error);
