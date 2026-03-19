const { ethers } = require("hardhat");
require("dotenv").config();

const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

async function checkAccess(name, address, targetAdmin) {
    if (!address || address === "[RESERVED]") return { status: "SKIPPED", details: "No address" };
    
    try {
        const code = await ethers.provider.getCode(address);
        if (code === "0x") return { status: "ERROR", details: "Not a contract" };

        // 1. Try Ownable
        try {
            const ownable = await ethers.getContractAt(["function owner() view returns (address)"], address);
            const owner = await ownable.owner();
            if (owner.toLowerCase() === targetAdmin.toLowerCase()) {
                return { status: "✅ MATCHED (Ownable)", owner };
            }
        } catch (e) {}

        // 2. Try AccessControl (DEFAULT_ADMIN_ROLE)
        try {
            const ac = await ethers.getContractAt(["function hasRole(bytes32 role, address account) view returns (bool)"], address);
            const isAdmin = await ac.hasRole(DEFAULT_ADMIN_ROLE, targetAdmin);
            if (isAdmin) {
                return { status: "✅ MATCHED (AccessControl)", details: "Has DEFAULT_ADMIN_ROLE" };
            }
        } catch (e) {}

        return { status: "❌ MISMATCH", details: "Admin not found in Ownable or AccessControl" };

    } catch (err) {
        return { status: "ERROR", details: err.message };
    }
}

async function main() {
    const adminWallet = "0x52260C30697674A7C837feb2Af21BbF3606795C8";
    
    const contracts = {
        "MASTER_X": process.env.VITE_MASTER_X_ADDRESS_SEPOLIA || process.env.MASTER_X_ADDRESS_SEPOLIA,
        "RAFFLE": "0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB",
        "DAILY_APP": process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA || process.env.DAILY_APP_ADDRESS_SEPOLIA,
        "CMS": process.env.VITE_CMS_CONTRACT_ADDRESS_SEPOLIA
    };

    console.log("🕵️  Comprehensive Contract Governance Audit\n");
    console.log("🎯 Target Admin:", adminWallet);
    console.log("--------------------------------------------------");

    for (const [name, addr] of Object.entries(contracts)) {
        const result = await checkAccess(name, addr, adminWallet);
        console.log(`${name.padEnd(10)} | ${addr}`);
        console.log(`Result     | ${result.status}`);
        if (result.details) console.log(`Details    | ${result.details}`);
        if (result.owner) console.log(`Owner      | ${result.owner}`);
        console.log("--------------------------------------------------");
    }
}

main().catch(console.error);
