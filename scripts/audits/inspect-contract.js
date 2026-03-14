const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const contractAddress = "0xd7f6d4589A04F51D22B3a5965860EB40fb219c78";
    console.log("==================================================");
    console.log("🔍 Deep Inspection - CryptoDiscoMaster");
    console.log("📍 Contract:", contractAddress);
    console.log("==================================================\n");

    try {
        const [signer] = await ethers.getSigners();
        console.log("👤 Using account:", signer.address);

        const contract = await ethers.getContractAt("CryptoDiscoMaster", contractAddress);

        // 1. Check Metadata
        const owner = await contract.owner();
        const paused = await contract.paused();
        const currentRaffleId = await contract.currentRaffleId();

        console.log("👑 Owner:", owner);
        console.log("⏸️  Paused:", paused);
        console.log("🎫 Current Raffle ID:", currentRaffleId.toString());

        // 2. Inspect Raffle Data
        if (currentRaffleId > 0) {
            console.log(`\n🕵️  Inspecting Raffle #${currentRaffleId}...`);
            const raffle = await contract.getRaffleData(currentRaffleId);
            // raffle layout from contract: (totalTickets, prizePool, winner, isActive, isFinalized)
            console.log("   Total Tickets:", raffle[0].toString());
            console.log("   Prize Pool:", ethers.formatEther(raffle[1]), "ETH");
            console.log("   Winner:", raffle[2]);
            console.log("   Is Active:", raffle[3]);
            console.log("   Is Finalized:", raffle[4]);

            if (!raffle[3]) {
                console.warn("⚠️  WARNING: Raffle is NOT active! purchaseRaffleTickets will revert.");
            }
        }

        // 3. Inspect Price Feed state one last time
        console.log("\n📈 Price Feed Check:");
        try {
            const feed = await contract.priceFeed();
            console.log("   Feed Address:", feed);
            const price = await contract.getTicketPriceInETH();
            console.log("   Successfully got price from contract:", ethers.formatEther(price), "ETH");
        } catch (e) {
            console.log("   ❌ getTicketPriceInETH still failing on-chain.");
        }

        console.log("\n==================================================");

    } catch (error) {
        console.error("\n❌ ERROR occurred during inspection:");
        console.error(error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
