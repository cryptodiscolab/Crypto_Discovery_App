require("dotenv").config();
const { ethers } = require("hardhat");

/**
 * Manual QRNG Setup Script
 * This script configures the QRNG parameters on the deployed contract.
 * 
 * IMPORTANT: You must manually derive and fund the sponsor wallet first.
 * Follow these steps:
 * 
 * 1. Install API3 Admin CLI globally:
 *    npm install -g @api3/airnode-admin
 * 
 * 2. Derive the sponsor wallet address:
 *    airnode-admin derive-sponsor-wallet-address \
 *      --airnode-xpub xpub6CuDdF9zdWTRuGybJPuZUGnU4suZowMmgu15bjFZT2o6PUtk4Lo78KGJUGBobz3pPKRaN9sLxzj21CMe6StP3zUsd8tWEJPgZBesYBMY7Wo \
 *      --airnode-address 0x6238772544f029ecaBfDED4300f13A3c4FE84E1D \
 *      --sponsor-address YOUR_CONTRACT_ADDRESS
 * 
 * 3. Fund the sponsor wallet with at least 0.01 ETH on Base Sepolia
 * 
 * 4. Update SPONSOR_WALLET in .env with the derived address
 * 
 * 5. Run this script: npx hardhat run scripts/setup-qrng-manual.js --network baseSepolia
 */

async function main() {
    console.log("========================================");
    console.log("🎲 Configuring API3 QRNG on Contract");
    console.log("========================================\n");

    const airnodeAddress = process.env.AIRNODE_ADDRESS;
    const endpointId = process.env.ENDPOINT_ID_UINT256;
    const sponsorWallet = process.env.SPONSOR_WALLET;
    const contractAddress = process.env.VITE_CONTRACT_ADDRESS || "0x393B57dC5f73D06f12b18CF305a8e50FC8EdFF7de";

    if (!airnodeAddress || !endpointId) {
        throw new Error("Missing AIRNODE_ADDRESS or ENDPOINT_ID_UINT256 in .env");
    }

    if (!sponsorWallet) {
        console.error("\n❌ ERROR: SPONSOR_WALLET not set in .env");
        console.log("\nPlease follow these steps:");
        console.log("1. Install: npm install -g @api3/airnode-admin");
        console.log("2. Run: airnode-admin derive-sponsor-wallet-address \\");
        console.log(`     --airnode-xpub xpub6CuDdF9zdWTRuGybJPuZUGnU4suZowMmgu15bjFZT2o6PUtk4Lo78KGJUGBobz3pPKRaN9sLxzj21CMe6StP3zUsd8tWEJPgZBesYBMY7Wo \\`);
        console.log(`     --airnode-address ${airnodeAddress} \\`);
        console.log(`     --sponsor-address ${contractAddress}`);
        console.log("3. Fund the wallet with 0.01 ETH");
        console.log("4. Add SPONSOR_WALLET=<address> to .env\n");
        process.exit(1);
    }

    console.log("📍 Configuration:");
    console.log("   Contract:", contractAddress);
    console.log("   Airnode:", airnodeAddress);
    console.log("   Endpoint ID:", endpointId);
    console.log("   Sponsor Wallet:", sponsorWallet);
    console.log();

    // Set Parameters on Contract
    const [deployer] = await ethers.getSigners();
    console.log("⏳ Setting QRNG parameters on contract...");
    console.log("   From:", deployer.address);

    const CryptoDiscoMaster = await ethers.getContractFactory("CryptoDiscoMaster");
    const contract = CryptoDiscoMaster.attach(contractAddress);

    // Normalize all addresses to prevent ENS resolution errors
    const normalizedAirnodeAddress = ethers.getAddress(airnodeAddress);
    const normalizedSponsorWallet = ethers.getAddress(sponsorWallet);

    // Use populateTransaction to bypass ENS resolution issues
    const populatedTx = await contract.setQRNGParameters.populateTransaction(
        normalizedAirnodeAddress,
        endpointId,
        normalizedSponsorWallet
    );

    const tx = await deployer.sendTransaction(populatedTx);

    console.log("   Transaction Hash:", tx.hash);
    await tx.wait();
    console.log("✅ QRNG Parameters configured!\n");

    console.log("========================================");
    console.log("🎉 Setup Complete!");
    console.log("========================================");
    console.log(`\n⚠️  REMINDER: Ensure ${sponsorWallet} has ETH for gas.`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
