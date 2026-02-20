/**
 * deploy_masterX.js
 * =================
 * Deploy ulang CryptoDiscoMasterX.sol dengan fix:
 * - V-05: totalLockedRewards keluar dari unchecked block
 * - V-07: emergencyWithdraw guard
 * - V-11: PLATINUM tier ditambahkan (6 tier total)
 *
 * Jalankan:
 *   npx hardhat run scripts/deploy_masterX.js --network base-sepolia
 */

const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying CryptoDiscoMasterX (patched)...\n");

    const [deployer] = await hre.ethers.getSigners();
    const bal = await hre.ethers.provider.getBalance(deployer.address);

    console.log("📋 Deployer       :", deployer.address);
    console.log("💰 Balance        :", hre.ethers.formatEther(bal), "ETH");

    // ── Constructor args (dari .env) ──────────────────────────────────────────
    const OPS_WALLET = process.env.OPERATIONS_WALLET || deployer.address;
    const TREASURY = process.env.TREASURY_WALLET || deployer.address;
    const PRICE_FEED = process.env.PRICE_FEED_ETH_USD || "0x4aDC67696bA383F43fD60604633031d935f9584b";

    console.log("\n🔧 Constructor args:");
    console.log("   Ops Wallet :", OPS_WALLET);
    console.log("   Treasury   :", TREASURY);
    console.log("   Price Feed :", PRICE_FEED);
    console.log("─────────────────────────────────────────");

    const Factory = await hre.ethers.getContractFactory("CryptoDiscoMasterX");
    const contract = await Factory.deploy(OPS_WALLET, TREASURY, PRICE_FEED);

    console.log("\n⏳ Menunggu deployment confirmation...");
    await contract.waitForDeployment();

    const newAddress = await contract.getAddress();
    console.log("\n✅ CryptoDiscoMasterX deployed to:", newAddress);
    console.log("\n📝 Update ini di file berikut:");
    console.log("   .env                      → MASTER_X_ADDRESS=" + newAddress);
    console.log("   daily-frontend/.env.local → NEXT_PUBLIC_MASTER_X_ADDRESS=" + newAddress);

    console.log("\n🔍 Verify on Basescan:");
    console.log(`   npx hardhat verify --network base-sepolia ${newAddress} "${OPS_WALLET}" "${TREASURY}" "${PRICE_FEED}"`);
}

main().catch((err) => {
    console.error("❌ Deploy failed:", err.message);
    process.exitCode = 1;
});
