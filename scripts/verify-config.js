require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
    console.log("Checking Environment Config...");

    // Checksummed addresses
    const AIRNODE_RRP = "0xa0AD79D995DdeeB18a14eD34778C845dccfA478";
    const PRICE_FEED = "0x4aDC43E4F3841847BB1479f4a079CF294975267D";

    console.log("AIRNODE:", AIRNODE_RRP);
    console.log("PRICE_FEED:", PRICE_FEED);

    try {
        console.log("Validating AIRNODE...");
        ethers.getAddress(AIRNODE_RRP);
        console.log("OK");
    } catch (e) {
        console.error("INVALID AIRNODE:", e.message);
    }

    try {
        console.log("Validating PRICE_FEED...");
        ethers.getAddress(PRICE_FEED);
        console.log("OK");
    } catch (e) {
        console.error("INVALID PRICE_FEED:", e.message);
    }
}

main();
