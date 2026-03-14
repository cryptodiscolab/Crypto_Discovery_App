const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const contractAddress = "0xd7f6d4589A04F51D22B3a5965860EB40fb219c78";
    console.log("==================================================");
    console.log("🎲 Testing Raffle Feature - CryptoDiscoMaster");
    console.log("📍 Contract:", contractAddress);
    console.log("==================================================\n");

    try {
        const [signer] = await ethers.getSigners();
        console.log("👤 Using account:", signer.address);

        const contract = await ethers.getContractAt("CryptoDiscoMaster", contractAddress);

        // Official Base Sepolia ETH/USD from Chainlink Docs
        // We use the lowercase version and let ethers.getAddress() handle the checksum.
        const officialPriceFeed = ethers.getAddress("0x4adc43e4f3841847bb1479f4a079cf294975267d");
        console.log("🛠️  Target Price Feed (Checksummed):", officialPriceFeed);

        // 1. Update Price Feed
        console.log("🛠️  Updating Price Feed on contract...");
        const tx = await contract.setPriceFeed(officialPriceFeed);
        console.log("   Transaction Hash (Update):", tx.hash);
        await tx.wait();
        console.log("   ✅ Price feed updated!");

        // 2. Get Ticket Price
        console.log("\n⏳ Fetching ticket price (getTicketPriceInETH)...");
        const ticketPrice = await contract.getTicketPriceInETH();
        console.log(`💰 Calculated Price: ${ethers.formatEther(ticketPrice)} ETH`);

        // 3. Buy Ticket
        console.log("\n🛒 Buying 1 ticket...");
        const buyTx = await contract.purchaseRaffleTickets(1, { value: ticketPrice });
        console.log("   Transaction Hash (Buy):", buyTx.hash);
        await buyTx.wait();
        console.log("✅ Ticket purchased successfully!");

        // 4. Request Raffle Winner
        const currentRaffleId = await contract.currentRaffleId();
        console.log(`\n🎲 Poking QRNG (requestRaffleWinner) for Raffle #${currentRaffleId}...`);

        const requestTx = await contract.requestRaffleWinner(currentRaffleId);
        console.log("   Transaction Hash (Random):", requestTx.hash);
        await requestTx.wait();
        console.log("✅ QRNG Request sent successfully!");

        console.log("\n==================================================");
        console.log("📊 FINAL SUMMARY FOR INVESTORS:");
        console.log(`- Purchase TX: [${buyTx.hash}](https://sepolia.basescan.org/tx/${buyTx.hash})`);
        console.log(`- QRNG Request TX: [${requestTx.hash}](https://sepolia.basescan.org/tx/${requestTx.hash})`);
        console.log("- Status: ON-CHAIN & FAIR (API3 QRNG)");
        console.log("==================================================");

    } catch (error) {
        console.error("\n❌ ERROR occurred during execution:");
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
