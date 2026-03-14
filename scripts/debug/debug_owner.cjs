const { ethers } = require("hardhat");

async function main() {
    const masterXAddress = "0x1ED8B135F01522505717D1E620c4EF869D7D25e7";
    const [deployer] = await ethers.getSigners();
    
    const masterX = await ethers.getContractAt("CryptoDiscoMasterX", masterXAddress);
    const owner = await masterX.owner();
    
    console.log("Checking Ownership:");
    console.log("MasterX Address:", masterXAddress);
    console.log("Current Owner  :", owner);
    console.log("Deployer       :", deployer.address);
    console.log("Match          :", owner.toLowerCase() === deployer.address.toLowerCase());
}

main().catch(console.error);
