const hre = require("hardhat");

async function main() {
    const deployer = "0x455DF75735d2a18c26f0AfDefa93217B60369fe5";
    const history = await hre.ethers.provider.getHistory ?
        await hre.ethers.provider.getHistory(deployer) :
        []; // getHistory is not always available in hardhat provider

    // Alternative: check block number and scan backwards or just use the delta.
    // Since it's testnet and gas is cheap, the delta is the most reliable way.

    const start = 0.138711457998440048;
    const currentWei = await hre.ethers.provider.getBalance(deployer);
    const current = parseFloat(hre.ethers.formatEther(currentWei));

    const ethSpent = start - current;
    const ethPrice = 2300; // Estimated current ETH price
    const totalUSDC = ethSpent * ethPrice;

    console.log("ETH Spent: " + ethSpent.toFixed(8));
    console.log("Estimated USDC: $" + totalUSDC.toFixed(4));
}
main().catch(console.error);
