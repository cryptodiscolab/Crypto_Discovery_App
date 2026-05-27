/**
 * fix_v16_tiers_hardhat.cjs
 * Fix DailyAppV16 nftConfigs via hardhat.
 *
 * BUG FIX: DailyAppV16.sol L601 requires multiplierBP >= 10_000
 *   if (pointsRequired == 0 || multiplierBP < 10_000 || multiplierBP > MAX_MULTIPLIER_BP) revert InvalidParameters();
 *
 * Using updateNFTConfig per tier (setNFTConfigsBatch may not exist in on-chain ABI if using old ABI file).
 *
 * Run: npx hardhat run scripts/deployments/fix_v16_tiers_hardhat.cjs --network baseSepolia
 */
const hre = require("hardhat");

const TIER_NAMES = ["NONE", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
const PROXY = "0xb592D6819Ea310d83034cD80FDDC2e754D0a5353";

// Contract constraint: multiplierBP >= 10_000 (100%) and <= 15_000 (150%)
// pointsRequired == 0 is NOT allowed
const TIER_CONFIGS = [
  { tierNum: 1, pointsRequired: 100,  mintPrice: "0.0006",  multiplierBP: 10000, dailyBonus: 5,   maxSupply: 1000, isOpen: true },
  { tierNum: 2, pointsRequired: 500,  mintPrice: "0.0012",  multiplierBP: 10000, dailyBonus: 10,  maxSupply: 500,  isOpen: true },
  { tierNum: 3, pointsRequired: 1500, mintPrice: "0.002",   multiplierBP: 10000, dailyBonus: 20,  maxSupply: 250,  isOpen: true },
  { tierNum: 4, pointsRequired: 4000, mintPrice: "0.012",   multiplierBP: 10000, dailyBonus: 40,  maxSupply: 100,  isOpen: true },
  { tierNum: 5, pointsRequired: 10000,mintPrice: "0.025",   multiplierBP: 10000, dailyBonus: 100, maxSupply: 50,   isOpen: true },
];

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  FIX V16 TIERS via Hardhat                              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 Account:", deployer.address);
  console.log("🏛️  Proxy:", PROXY, "\n");

  const dailyApp = await hre.ethers.getContractAt("DailyAppV16", PROXY, deployer);

  // Check current state
  console.log("=== Current State ===");
  for (let i = 1; i <= 5; i++) {
    const cfg = await dailyApp.nftConfigs(i);
    console.log(`  ${TIER_NAMES[i]}: pointsRequired=${cfg.pointsRequired}, isOpen=${cfg.isOpen}, multiplier=${cfg.multiplierBP}`);
  }

  // Check roles
  const adminRole = await dailyApp.ADMIN_ROLE();
  const hasAdmin = await dailyApp.hasRole(adminRole, deployer.address);
  console.log(`\n  has ADMIN_ROLE: ${hasAdmin}`);
  if (!hasAdmin) {
    const isDefault = await dailyApp.hasRole(await dailyApp.DEFAULT_ADMIN_ROLE(), deployer.address);
    console.log(`  has DEFAULT_ADMIN_ROLE: ${isDefault}`);
    if (isDefault) {
      console.log("  → Granting ADMIN_ROLE first...");
      const tx = await dailyApp.grantRole(adminRole, deployer.address);
      await tx.wait();
      console.log("  ✅ ADMIN_ROLE granted");
    } else {
      console.log("  ❌ No admin roles! Grant via Admin Dashboard first.");
      process.exit(1);
    }
  }

  // Fix tiers - use updateNFTConfig per tier
  console.log("\n=== Fixing Tiers ===");
  for (const cfg of TIER_CONFIGS) {
    const tierName = TIER_NAMES[cfg.tierNum];
    console.log(`\n  Setting ${tierName}...`);
    console.log(`    pointsRequired=${cfg.pointsRequired}, mintPrice=${cfg.mintPrice} ETH`);
    console.log(`    multiplierBP=${cfg.multiplierBP}, dailyBonus=${cfg.dailyBonus}, maxSupply=${cfg.maxSupply}`);

    const mintPriceWei = hre.ethers.parseEther(cfg.mintPrice);

    // Try setNFTConfigsBatch first (if available)
    try {
      const tx = await dailyApp.setNFTConfigsBatch(
        [cfg.tierNum],
        [cfg.pointsRequired],
        [mintPriceWei],
        [cfg.dailyBonus],
        [cfg.multiplierBP],
        [cfg.maxSupply],
        [cfg.isOpen]
      );
      const r = await tx.wait();
      console.log(`  ✅ Done (block ${r.blockNumber}, gasUsed: ${r.gasUsed})`);
    } catch (batchErr) {
      // Fallback to updateNFTConfig per tier
      console.log(`  setNFTConfigsBatch failed, trying updateNFTConfig...`);
      try {
        const tx = await dailyApp.updateNFTConfig(
          cfg.tierNum,
          cfg.pointsRequired,
          mintPriceWei,
          cfg.multiplierBP,
          cfg.dailyBonus,
          cfg.maxSupply,
          cfg.isOpen
        );
        const r = await tx.wait();
        console.log(`  ✅ Done (block ${r.blockNumber}, gasUsed: ${r.gasUsed})`);
      } catch (updateErr) {
        console.error(`  ❌ updateNFTConfig also failed:`, updateErr.message?.substring(0, 200));
      }
    }
  }

  // Final Verification
  console.log("\n=== Final Verification ===");
  let allGood = true;
  for (let i = 1; i <= 5; i++) {
    const cfg = await dailyApp.nftConfigs(i);
    const expected = TIER_CONFIGS[i-1];
    const ok = Number(cfg.pointsRequired) === expected.pointsRequired && cfg.isOpen === true;
    if (!ok) allGood = false;
    console.log(`  ${ok ? "✅" : "❌"} ${TIER_NAMES[i]}: ${cfg.pointsRequired}/${expected.pointsRequired} | isOpen=${cfg.isOpen}`);
  }
  console.log(`\n${allGood ? "✅ ALL TIERS FIXED SUCCESSFULLY!" : "❌ Some tiers still broken"}`);
}

main().catch((error) => {
  console.error("FATAL:", error.message || error);
  process.exitCode = 1;
});