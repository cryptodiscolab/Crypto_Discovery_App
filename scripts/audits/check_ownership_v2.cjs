const { ethers } = require("hardhat");
require("dotenv").config();

async function checkOwnership(name, address) {
    if (!address || address === "[RESERVED]") {
        console.log(`⚠️  ${name}: Skipped (No address)`);
        return null;
    }
    
    try {
        const contract = await ethers.getContractAt("IOwnable", address);
        const owner = await contract.owner();
        return owner;
    } catch (e) {
        // Try direct call if interface fails
        try {
            const code = await ethers.provider.getCode(address);
            if (code === "0x") return "NOT_A_CONTRACT";
            
            const owner = await ethers.provider.call({
                to: address,
                data: "0x8da5cb5b" // owner() selector
            });
            return ethers.stripZerosLeft(owner);
        } catch (err) {
            return "UNKNOWN/NOT_OWNABLE";
        }
    }
}

async function main() {
    const adminWallet = "0x52260C30697674A7C837feb2Af21BbF3606795C8".toLowerCase();
    
    const contracts = {
        "MASTER_X": process.env.VITE_MASTER_X_ADDRESS_SEPOLIA || process.env.MASTER_X_ADDRESS_SEPOLIA,
        "RAFFLE": "0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB",
        "DAILY_APP": process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA || process.env.DAILY_APP_ADDRESS_SEPOLIA,
        "CMS": process.env.VITE_CMS_CONTRACT_ADDRESS_SEPOLIA
    };

    console.log("🕵️  Contract Ownership Audit\n");
    console.log("🎯 Target Admin:", adminWallet);
    console.log("--------------------------------------------------");

    for (const [name, addr] of Object.entries(contracts)) {
        const owner = await checkOwnership(name, addr);
        const isMatched = owner && owner.toLowerCase().includes(adminWallet.substring(2).toLowerCase());
        
        console.log(`${name.padEnd(10)} | ${addr}`);
        console.log(`Owner      | ${owner}`);
        console.log(`Status     | ${isMatched ? "✅ MATCHED" : "❌ MISMATCH / NOT OWNABLE"}`);
        console.log("--------------------------------------------------");
    }
}

main().catch(console.error);
