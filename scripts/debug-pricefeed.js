const { ethers } = require("hardhat");

async function main() {
    // Official Base Sepolia ETH/USD from Chainlink Docs
    const priceFeedAddress = "0x4aDC43E4F3841847BB1479F4a079CF294975267D";

    console.log("==================================================");
    console.log("🔍 Chainlink Price Feed Inspection - Base Sepolia");
    console.log("📍 Feed Address:", priceFeedAddress);
    console.log("==================================================\n");

    try {
        const [signer] = await ethers.getSigners();
        const aggregator = new ethers.Contract(priceFeedAddress, [
            "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
            "function decimals() view returns (uint8)"
        ], signer);

        console.log("⏳ Fetching decimals...");
        const decimals = await aggregator.decimals();
        console.log("   Decimals:", decimals);

        console.log("\n⏳ Fetching latestRoundData...");
        const [roundId, price, startedAt, updatedAt, answeredInRound] = await aggregator.latestRoundData();

        console.log("   Round ID:", roundId.toString());
        console.log("   Price (ETH/USD):", price.toString());
        console.log("   Updated At:", updatedAt.toString());

        const now = Math.floor(Date.now() / 1000);
        console.log("   Current Time:", now);
        console.log(`   Age: ${now - Number(updatedAt)} seconds`);

        if (now - Number(updatedAt) > 3600) {
            console.warn("⚠️  WARNING: Data is older than 1 hour!");
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
