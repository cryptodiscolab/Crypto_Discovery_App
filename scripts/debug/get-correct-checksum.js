const { ethers } = require("ethers");

// Lowercase address (no checksum)
const lowercaseAddr = "0x40ef15db2f08f322abce913ead1cf039fdc48d92";

try {
    // ethers.getAddress will return the CORRECT checksummed version
    const correctChecksum = ethers.getAddress(lowercaseAddr);
    console.log("✅ CORRECT CHECKSUMMED ADDRESS:");
    console.log(correctChecksum);
} catch (e) {
    console.error("Error:", e.message);
}
