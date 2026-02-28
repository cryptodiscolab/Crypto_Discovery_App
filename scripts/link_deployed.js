const { ethers } = require("hardhat");

async function main() {
    const masterXAddress = "0x78a566a11AcDA14b2A4F776227f61097C7381C84";
    const raffleAddress = "0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08";
    const dailyAppAddress = "0xfc12f4FEFf825860c5145680bde38BF222cC669A";

    console.log("Checking contracts...");
    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", masterXAddress);
    const raffle = await ethers.getContractAt("CryptoDiscoRaffle", raffleAddress);
    const dailyApp = await ethers.getContractAt("DailyAppV12Secured", dailyAppAddress);

    try {
        console.log("1. Linking MasterX -> Raffle...");
        await (await masterX.setRaffleContract(raffleAddress)).wait();
        console.log("✅ Linked");

        console.log("2. Linking DailyApp -> MasterX...");
        await (await dailyApp.setMasterX(masterXAddress)).wait();
        console.log("✅ Linked");

        console.log("3. Setting DailyApp as Satellite in MasterX...");
        await (await masterX.setSatelliteStatus(dailyAppAddress, true)).wait();
        console.log("✅ Done");

        console.log("\n=== SUCCESS ===");
        console.log("MASTER_X=" + masterXAddress);
        console.log("RAFFLE=" + raffleAddress);
        console.log("DAILY_APP=" + dailyAppAddress);
    } catch (e) {
        console.error("Error during linking:", e.message);
    }
}

main().catch(console.error);
