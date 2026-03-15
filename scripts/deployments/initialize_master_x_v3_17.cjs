const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const [deployer] = await ethers.getSigners();
    const MASTER_X_ADDRESS = "0xa4E3091B717DfB8532219C93A0C170f8f2D7aec3";
    const DAILY_APP = process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA || "0xfA75627c1A5516e2Bc7d1c75FA31fF05Cc2f8721";
    const RAFFLE = process.env.VITE_RAFFLE_ADDRESS_SEPOLIA || "0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08";

    console.log("🛠️  Initializing CryptoDiscoMasterX at:", MASTER_X_ADDRESS);
    
    const MasterX = await ethers.getContractAt("CryptoDiscoMasterX", MASTER_X_ADDRESS);
    let nonce = await deployer.getNonce();

    console.log("📡 Setting DailyApp:", DAILY_APP, "(Nonce:", nonce, ")");
    await (await MasterX.setDailyAppContract(DAILY_APP, { nonce: nonce++ })).wait();
    
    console.log("📡 Setting Raffle:", RAFFLE, "(Nonce:", nonce, ")");
    await (await MasterX.setRaffleContract(RAFFLE, { nonce: nonce++ })).wait();

    console.log("📡 Setting Satellite Status for dailyApp...", "(Nonce:", nonce, ")");
    await (await MasterX.setSatelliteStatus(DAILY_APP, true, { nonce: nonce++ })).wait();

    console.log("✅ Initialization complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
