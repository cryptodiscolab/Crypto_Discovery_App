const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const addresses = [
        { name: "ENV:MASTER_X", addr: process.env.MASTER_X_ADDRESS },
        { name: "ENV:DAILY_APP", addr: process.env.DAILY_APP_ADDRESS },
        { name: "RULE:MASTER_X_V2", addr: "0x1ED8B135F01522505717D1E620c4EF869D7D25e7" },
        { name: "RULE:DAILY_APP_V12", addr: "0xfc12f4FEFf825860c5145680bde38BF222cC669A" }
    ];

    console.log("🕵️ Probing Contract Addresses...");
    for (const { name, addr } of addresses) {
        if (!addr) {
            console.log(`❌ ${name} has NO ADDRESS set.`);
            continue;
        }
        const code = await ethers.provider.getCode(addr);
        const hasCode = code !== "0x";
        console.log(`${hasCode ? '✅' : '❌'} ${name} (${addr}): ${hasCode ? 'CONTRACT' : 'EMPTY'}`);

        if (hasCode) {
            if (name.includes("MASTER_X")) {
                try {
                    const c = new ethers.Contract(addr, ["function owner() view returns (address)"], ethers.provider);
                    const owner = await c.owner();
                    console.log(`   - Owner: ${owner}`);
                } catch (e) {
                    console.log(`   - Could not call owner()`);
                }
            }
        }
    }
}

main().catch(console.error);
