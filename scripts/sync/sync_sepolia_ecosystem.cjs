const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const masterXAddress = "0x980770dAcE8f13E10632D3EC1410FAA4c707076c";
    const dailyAppAddress = "0x369aBcD44d3D510f4a20788BBa6F47C99e57d267"; // New V13.2 Sepolia Fixed

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
