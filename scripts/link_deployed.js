const { ethers } = require("hardhat");

async function main() {
    const masterXAddress = "0x1ED8B135F01522505717D1E620c4EF869D7D25e7";
    const raffleAddress = "0x012FAdd087540e1B51a587f420e77D007fED2a84";
    const dailyAppAddress = "0x87a3d1203Bf20E7dF5659A819ED79a67b236F571";

    console.log("Checking contracts...");
    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", masterXAddress);
    const raffle = await ethers.getContractAt("CryptoDiscoRaffle", raffleAddress);
    const dailyApp = await ethers.getContractAt("DailyAppV13", dailyAppAddress);

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
