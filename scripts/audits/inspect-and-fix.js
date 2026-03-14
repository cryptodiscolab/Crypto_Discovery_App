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

        // 1. Check Fundamental State
        const owner = await contract.owner();
        const paused = await contract.paused();
        const maxGasPrice = await contract.maxGasPrice();
        const ticketPriceUSD = await contract.ticketPriceUSD();

        console.log("👑 Owner:", owner);
        console.log("⏸️  Paused:", paused);
        console.log("⛽ Max Gas Price:", ethers.formatUnits(maxGasPrice, "gwei"), "gwei");
        console.log("💵 Ticket Price (USD):", (Number(ticketPriceUSD) / 10 ** 6).toFixed(2));

        // 2. Check Gas Price
        const feeData = await ethers.provider.getFeeData();
        const currentGasPrice = feeData.gasPrice;
        console.log("📡 Network Gas Price:", ethers.formatUnits(currentGasPrice, "gwei"), "gwei");

        if (currentGasPrice > maxGasPrice) {
            console.warn("❌ CRITICAL: Current gas price is HIGHER than contract's maxGasPrice limit!");
            console.log("🛠️  ACTION: Should update maxGasPrice on contract.");
        }

        // 3. Check current Raffle
        const currentRaffleId = await contract.currentRaffleId();
        console.log("\n🎫 Current Raffle ID:", currentRaffleId.toString());

        const raffle = await contract.getRaffleData(currentRaffleId);
        console.log("   Is Active:", raffle[3]);
        console.log("   Is Finalized:", raffle[4]);

        // 4. Try manual price update if owner
        if (signer.address.toLowerCase() === owner.toLowerCase()) {
            console.log("\n🛠️  Attempting to update maxGasPrice to 200 gwei for safety...");
            const tx = await contract.setMaxGasPrice(ethers.parseUnits("200", "gwei"));
            await tx.wait();
            console.log("   ✅ maxGasPrice updated!");
        }

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
