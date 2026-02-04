const { ethers } = require("ethers");

const address = "0x7186E5d35F126C3c809670f567B594582f3c7D61";

try {
    const checksummed = ethers.getAddress(address);
    console.log("Checksummed Address:", checksummed);
} catch (e) {
    console.error("Error:", e.message);
}
