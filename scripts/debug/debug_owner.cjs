const { ethers } = require("hardhat");

async function main() {
    const masterXAddress = "0x980770dAcE8f13E10632D3EC1410FAA4c707076c";
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
