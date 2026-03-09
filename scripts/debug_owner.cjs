const { ethers } = require("hardhat");

async function main() {
    const masterXAddress = "0x78a566a11AcDA14b2A4F776227f61097C7381C84";
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
