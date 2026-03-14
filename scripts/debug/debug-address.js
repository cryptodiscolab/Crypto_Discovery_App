require("dotenv").config();
const { ethers } = require("ethers");

const nodaryXpub = "xpub6CuDdF9zdWTRuGybJPuZUGnU4suZowMmgu15bjFZT2o6PUtk4Lo78KGJUGBobz3pPKRaN9sLxzj21CMe6StP3zUsd8tWEJPgZBesYBMY7Wo";
const airnodeAddress = "0x6238772544f029ecaBfDED4300f13A3c4FE84E1D";
const contractAddress = "0x393B57dC5f73D06f12b18CF305a8e50FC8EdFF7de";

console.log("--- Debug Info ---");
console.log(`Nodary Xpub Length: ${nodaryXpub.length}`);
console.log(`Airnode Address Length: ${airnodeAddress.length}`);
console.log(`Contract Address Length: ${contractAddress.length}`);

// Check for non-hex chars in addresses
const isHex = (str) => /^0x[0-9a-fA-F]*$/.test(str);
console.log(`Airnode valid hex format? ${isHex(airnodeAddress)}`);
console.log(`Contract valid hex format? ${isHex(contractAddress)}`);

try {
    console.log("Validating Airnode Address with ethers...");
    console.log(ethers.getAddress(airnodeAddress));
    console.log("OK");
} catch (e) {
    console.error("Airnode Invalid:", e.message);
}

try {
    console.log("Validating Contract Address with ethers...");
    console.log(ethers.getAddress(contractAddress));
    console.log("OK");
} catch (e) {
    console.error("Contract Invalid:", e.message);
}
