const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const masterXAddress = "0x78a566a11AcDA14b2A4F776227f61097C7381C84";
    const dailyAppAddress = "0xDe613DE5e6C0fB61012af83343f2b3c5F5461219"; // New V13 Sepolia

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
