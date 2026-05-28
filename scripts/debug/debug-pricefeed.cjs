const { ethers } = require("hardhat");

async function testAddress(priceFeedAddress) {
    console.log(`\n📍 Testing Feed Address: ${priceFeedAddress}`);
    try {
        const [signer] = await ethers.getSigners();
        const aggregator = new ethers.Contract(priceFeedAddress, [
            "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
            "function decimals() view returns (uint8)"
        ], signer);

        const decimals = await aggregator.decimals();
        console.log("   ✅ Decimals:", decimals);

        const [roundId, price, startedAt, updatedAt, answeredInRound] = await aggregator.latestRoundData();
        console.log("   ✅ Price (ETH/USD):", price.toString());
        console.log("   ✅ Updated At:", updatedAt.toString());
        return true;
    } catch (error) {
        console.log("   ❌ Failed:", error.message.split('\n')[0]);
        return false;
    }
}

async function main() {
    const addresses = [
        "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1", // From automated_ecosystem_deploy
        "0x4aDC67696bA38E090768bE20A10178496C423d24", // From web search
        "0x4aDC43E4F3841847BB1479f4a079CF294975267D", // From verify-config/debug-pricefeed
        "0x4adC67696BA383f43fd60604633031D935f9584b", // Mainnet
        "0x694AA1769357215DE4FAC081bf1f309aDC325306"  // Ethereum Sepolia
    ];

    for (const addr of addresses) {
        await testAddress(addr.toLowerCase());
    }
}

main().catch(console.error);
