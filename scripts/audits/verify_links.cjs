const hre = require("hardhat");

async function main() {
    console.log("🔗 Verifying Ecosystem Links...");

    const masterXAddr = process.env.VITE_MASTER_X_ADDRESS_SEPOLIA;
    const raffleAddr = process.env.VITE_RAFFLE_ADDRESS_SEPOLIA;
    const dailyAppAddr = process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA;

    const MasterXFactory = await hre.ethers.getContractFactory("CryptoDiscoMasterX");
    const masterX = MasterXFactory.attach(masterXAddr);

    const DailyAppFactory = await hre.ethers.getContractFactory("DailyAppV13");
    const dailyApp = DailyAppFactory.attach(dailyAppAddr);

    console.log(`Checking Addresses:`);
    console.log(`   DailyApp: ${dailyAppAddr}`);
    console.log(`   MasterX:  ${masterXAddr}`);
    console.log(`   Raffle:   ${raffleAddr}`);

    try {
        const mxInDailyApp = await dailyApp.masterXContract();
        console.log(`DailyApp -> MasterX Link: ${mxInDailyApp === masterXAddr ? "✅ OK" : "❌ FAILED (got " + mxInDailyApp + ") "}`);
    } catch (e) {
        console.log(`DailyApp -> MasterX Link: ❌ ERROR (${e.code || e.message})`);
    }

    try {
        const dailyAppInMx = await masterX.dailyAppContract();
        console.log(`MasterX -> DailyApp Link: ${dailyAppInMx === dailyAppAddr ? "✅ OK" : "❌ FAILED (got " + dailyAppInMx + ") "}`);
    } catch (e) {
        console.log(`MasterX -> DailyApp Link: ❌ ERROR (${e.code || e.message})`);
    }

    try {
        const raffleInMx = await masterX.raffleContract();
        console.log(`MasterX -> Raffle Link: ${raffleInMx === raffleAddr ? "✅ OK" : "❌ FAILED (got " + raffleInMx + ") "}`);
    } catch (e) {
        console.log(`MasterX -> Raffle Link: ❌ ERROR (${e.code || e.message})`);
    }

    try {
        const isDailyAppSatellite = await masterX.isSatellite(dailyAppAddr);
        console.log(`DailyApp Satellite Status: ${isDailyAppSatellite ? "✅ OK" : "❌ FAILED"}`);
    } catch (e) {
        console.log(`DailyApp Satellite Status: ❌ ERROR (${e.code || e.message})`);
    }

    try {
        const isRaffleSatellite = await masterX.isSatellite(raffleAddr);
        console.log(`Raffle Satellite Status: ${isRaffleSatellite ? "✅ OK" : "❌ FAILED"}`);
    } catch (e) {
        console.log(`Raffle Satellite Status: ❌ ERROR (${e.code || e.message})`);
    }
}

main().catch(console.error);
