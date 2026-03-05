const hre = require("hardhat");
async function main() {
    const b = await hre.ethers.provider.getBalance("0x455DF75735d2a18c26f0AfDefa93217B60369fe5");
    console.log("BAL:" + hre.ethers.formatEther(b));
}
main().catch(console.error);
