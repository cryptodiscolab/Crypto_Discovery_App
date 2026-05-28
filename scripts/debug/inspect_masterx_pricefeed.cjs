const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x1b573DdD9a1679505ae64498564523222c758EC2";
    console.log("=========================================");
    console.log("🔍 Inspecting MasterX Price Feed");
    console.log("📍 MasterX Address:", contractAddress);

    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", contractAddress);

    try {
        const owner = await masterX.owner();
        console.log("👑 Owner:", owner);
    } catch (e) {
        console.error("❌ Failed to get owner:", e.message);
    }

    let feedAddress;
    try {
        feedAddress = await masterX.priceFeed();
        console.log("📈 Price Feed Address on Contract:", feedAddress);
    } catch (e) {
        console.error("❌ Failed to get priceFeed:", e.message);
        return;
    }

    if (feedAddress && feedAddress !== "0x0000000000000000000000000000000000000000") {
        try {
            const feed = await ethers.getContractAt([
                "function decimals() external view returns (uint8)",
                "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
            ], feedAddress);

            const decimals = await feed.decimals();
            console.log("   Decimals:", decimals);

            const round = await feed.latestRoundData();
            console.log("   Round ID:", round.roundId.toString());
            console.log("   Price:", round.answer.toString());
            console.log("   Updated At:", new Date(Number(round.updatedAt) * 1000).toISOString(), `(${round.updatedAt.toString()})`);
            console.log("   Answered In Round:", round.answeredInRound.toString());
            
            const now = Math.floor(Date.now() / 1000);
            const ageSeconds = now - Number(round.updatedAt);
            console.log(`   Age: ${ageSeconds} seconds (${(ageSeconds / 3600).toFixed(2)} hours)`);

            if (ageSeconds > 3600) {
                console.warn("⚠️ Price feed is STALE (older than 1 hour)!");
            }
        } catch (e) {
            console.error("❌ Failed to query price feed contract directly:", e.message);
        }
    }

    try {
        console.log("⏳ Calling getTicketPriceInETH()...");
        const price = await masterX.getTicketPriceInETH();
        console.log("💰 Ticket Price in ETH:", ethers.formatEther(price), "ETH");
    } catch (e) {
        console.error("❌ getTicketPriceInETH() reverted:", e.message);
    }
}

main().catch(console.error);
