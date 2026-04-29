const { ethers } = require("hardhat");

async function main() {
    console.log("=== 🎲 RAFFLE ECOSYSTEM AUDIT ===");

    const masterAddress = "0x980770dAcE8f13E10632D3EC1410FAA4c707076c";
    const dailyAddress = "0x369aBcD44d3D510f4a20788BBa6F47C99e57d267";
    const raffleAddress = "0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB";

    const MasterX = await ethers.getContractAt("CryptoDiscoMasterX", masterAddress);
    const Raffle = await ethers.getContractAt("CryptoDiscoRaffle", raffleAddress);

    console.log("\n--- 🔗 Contract Connectivity ---");
    
    const registeredRaffle = await MasterX.raffleContract();
    console.log(`MasterX -> Raffle Contract: ${registeredRaffle}`);
    const raffleStatus = (registeredRaffle.toLowerCase() === raffleAddress.toLowerCase()) ? "✅ MATCH" : "❌ MISMATCH";
    console.log(`Status: ${raffleStatus}`);

    const isRaffleSatellite = await MasterX.isSatellite(raffleAddress);
    console.log(`MasterX -> Raffle is Satellite: ${isRaffleSatellite ? "✅ YES" : "❌ NO"}`);

    const isDailySatellite = await MasterX.isSatellite(dailyAddress);
    console.log(`MasterX -> DailyApp is Satellite: ${isDailySatellite ? "✅ YES" : "❌ NO"}`);

    console.log("\n--- 💰 Raffle Economy Settings ---");
    const pointsPerTicket = await Raffle.pointsRaffleTicket();
    const createXP = await Raffle.raffleCreateXP();
    const claimXP = await Raffle.raffleClaimXP();
    
    console.log(`XP per Ticket Purchase: ${pointsPerTicket} XP`);
    console.log(`XP for Creating Raffle: ${createXP} XP`);
    console.log(`XP for Claiming Prize: ${claimXP} XP`);

    const ticketPriceETH = await MasterX.getTicketPriceInETH();
    console.log(`Ticket Price (ETH): ${ethers.formatEther(ticketPriceETH)} ETH`);

    console.log("\n--- 🎲 Raffle State ---");
    const currentRaffleId = await Raffle.currentRaffleId();
    console.log(`Current Raffle ID: ${currentRaffleId}`);

    if (currentRaffleId > 0) {
        const raffleInfo = await Raffle.getRaffleInfo(currentRaffleId);
        console.log(`Raffle #${currentRaffleId} Status: ${raffleInfo.isActive ? "🟢 ACTIVE" : "🔴 INACTIVE"}`);
        console.log(`Participants: ${raffleInfo.participants.length}`);
        console.log(`Total Tickets: ${raffleInfo.totalTickets}`);
        console.log(`End Time: ${new Date(Number(raffleInfo.endTime) * 1000).toLocaleString()}`);
    }

    console.log("\n=== AUDIT COMPLETE ===");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
