const hre = require("hardhat");

async function main() {
    const deployer = "0x52260c30697674a7C837FEB2af21bBf3606795C8";
    const startBalance = 0.138711457998440048; // From previous logs

    const currentBalanceWei = await hre.ethers.provider.getBalance(deployer);
    const currentBalance = parseFloat(hre.ethers.formatEther(currentBalanceWei));

    const ethSpent = startBalance - currentBalance;

    // Get ETH price from the feed
    const PRICE_FEED = "0x4adC67696BA383f43fd60604633031D935f9584b";
    const feed = await hre.ethers.getContractAt([
        "function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)"
    ], PRICE_FEED);

    const [, price] = await feed.latestRoundData();
    const ethPriceUsd = Number(price) / 1e8;

    const costUsdc = ethSpent * ethPriceUsd;

    console.log("==========================================");
    console.log("💰 DEPLOYMENT COST ESTIMATION");
    console.log("==========================================");
    console.log(`ETH Spent    : ${ethSpent.toFixed(6)} ETH`);
    console.log(`ETH Price    : $${ethPriceUsd.toFixed(2)}`);
    console.log(`Total Cost   : $${costUsdc.toFixed(2)} USDC`);
    console.log("==========================================");
}

main().catch(console.error);
