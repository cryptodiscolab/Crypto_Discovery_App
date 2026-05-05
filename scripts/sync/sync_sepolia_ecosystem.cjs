const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const masterXAddress = process.env.MASTER_X_ADDRESS || process.env.VITE_MASTER_X_ADDRESS_SEPOLIA;
    const dailyAppAddress = process.env.DAILY_APP_ADDRESS || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA;
    if (!masterXAddress || !dailyAppAddress) {
        console.error("❌ ERROR: Missing MasterX or DailyApp contract address in .env");
        process.exit(1);
    }

    console.log("🚀 Syncing Ecosystem on Base Sepolia...");
    console.log("MasterX :", masterXAddress);
    console.log("DailyApp:", dailyAppAddress);

    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", masterXAddress);

    console.log("\n1. Setting DailyApp address in MasterX...");
    const tx1 = await masterX.setDailyAppContract(dailyAppAddress, { gasLimit: 200000 });
    console.log("Tx Sent:", tx1.hash);
    await tx1.wait();
    console.log("✅ DailyApp address updated in MasterX");

    console.log("Waiting 3s...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("\n2. Setting DailyApp as Satellite in MasterX...");
    const tx2 = await masterX.setSatelliteStatus(dailyAppAddress, true, { gasLimit: 200000 });
    console.log("Tx Sent:", tx2.hash);
    await tx2.wait();
    console.log("✅ Satellite status granted");

    console.log("\n=== SUCCESS ===");
    console.log("Ecosystem synced for new DailyApp V13.1 contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
