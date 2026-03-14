const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const addresses = {
        AIRNODE_RRP: process.env.AIRNODE_RRP,
        PRICE_FEED: process.env.PRICE_FEED_ETH_USD,
        USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    };

    for (let [name, addr] of Object.entries(addresses)) {
        if (!addr) {
            console.log(`WARNING: ${name} is UNDEFINED in .env!`);
            continue;
        }
        addr = ethers.getAddress(addr.toLowerCase());
        const code = await ethers.provider.getCode(addr);
        console.log(`${name} (${addr}): ${code !== "0x" ? "CONTRACT FOUND" : "EMPTY ADDRESS (EXTERNALLY OWNED OR NULL)"}`);
        if (code === "0x") {
            console.log(`WARNING: ${name} is NOT a contract! This might cause reverts.`);
        }
    }
}

main().catch(console.error);
