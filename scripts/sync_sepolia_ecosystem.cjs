const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const masterXAddress = "0x1ED8B135F01522505717D1E620c4EF869D7D25e7";
    const dailyAppAddress = "0x87a3d1203Bf20E7dF5659A819ED79a67b236F571"; // New V13 Sepolia

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
