const hre = require("hardhat");
async function main() {
    const b = await hre.ethers.provider.getBalance("0x52260c30697674a7C837FEB2af21bBf3606795C8");
    console.log("BAL:" + hre.ethers.formatEther(b));
}
main().catch(console.error);
