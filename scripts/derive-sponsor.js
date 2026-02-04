const { ethers } = require("ethers");

// Configuration
const xpub = "xpub6CuDdF9zdWTRuGybJPuZUGnU4suZowMmgu15bjFZT2o6PUtk4Lo78KGJUGBobz3pPKRaN9sLxzj21CMe6StP3zUsd8tWEJPgZBesYBMY7Wo";
const airnodeAddress = "0x6238772544f029ecaBfDED4300f13A3c4FE84E1D";
const sponsorAddress = "0x393B57dC5f73D06f12b18CF305a8e50FC8EdFF7de";

console.log("========================================");
console.log("🔑 Deriving Sponsor Wallet");
console.log("========================================\n");

console.log("Inputs:");
console.log("  Airnode:", airnodeAddress);
console.log("  Sponsor:", sponsorAddress);
console.log("  Xpub:", xpub.substring(0, 20) + "...");

// API3's derivation algorithm:
// 1. Hash the sponsor address to get a deterministic index
// 2. Use that index to derive a child wallet from the xpub

// Create HD node from xpub
const hdNode = ethers.HDNodeWallet.fromExtendedKey(xpub);

// Compute derivation index from sponsor address
// This matches API3's algorithm: keccak256(abi.encodePacked(sponsorAddress))
const sponsorBytes = ethers.getBytes(sponsorAddress.toLowerCase());
const hash = ethers.keccak256(sponsorBytes);
const hashBigInt = BigInt(hash);
const derivationIndex = hashBigInt % (BigInt(2) ** BigInt(31)); // Use 2^31 as max index

console.log("\nDerivation:");
console.log("  Index:", derivationIndex.toString());
console.log("  Path: m/44'/60'/0'/0/" + derivationIndex);

// Derive the sponsor wallet
const sponsorWallet = hdNode.derivePath(`0/0/${derivationIndex}`);

console.log("\n========================================");
console.log("✅ SPONSOR WALLET DERIVED");
console.log("========================================\n");
console.log("📍 ADDRESS TO FUND:");
console.log("\n   " + sponsorWallet.address);
console.log("\n⚠️  Send 0.01 ETH (Base Sepolia) to this address!");
console.log("========================================\n");
