const { ethers } = require("ethers");

// Lowercase address (no checksum)
const lowercaseAddr = "0x7186e5d35f126c3c809670f567b594582f3c7d61";

try {
    // ethers.getAddress will return the CORRECT checksummed version
    const correctChecksum = ethers.getAddress(lowercaseAddr);
    console.log("✅ CORRECT CHECKSUMMED ADDRESS:");
    console.log(correctChecksum);
} catch (e) {
    console.error("Error:", e.message);
}
