/**
 * reconcile_tiers_v16.cjs
 * Fixes tier sync between MasterX (tierMinXP) and DailyAppV16 (nftConfigs).
 *
 * Root Cause (v3.64.24):
 * - MasterX redeployed (Ownable2Step) at 0x5916E4A76... — tierMinXP never set
 * - DailyAppV16 UUPS proxy at 0xb592D6819Ea310d83034cD80FDDC2e754D0a5353
 *
 * Fix: 1) Set tierMinXP in MasterX via setTierConfig
 *      2) Sync nftConfigs in DailyAppV16 proxy via setNFTConfigsBatch
 *
 * Usage: node scripts/sync/reconcile_tiers_v16.cjs
 */
require('dotenv').config();
const { createPublicClient, createWalletClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

// === CONFIG (CORRECT ADDRESSES) ===
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MASTER_X_ADDRESS = '0x1b573DdD9a1679505ae64498564523222c758EC2';
const DAILY_APP_V16_PROXY = '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353';
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const TIER_NAMES = ['NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];

// Tier config values (from previous working state before redeploy)
const TIER_CONFIG = {
  BRONZE:    { minXP: 100,  feeWei: '600000000000000',    dailyBonus: 5,   multiplierBP: 200,  maxSupply: 1000 },
  SILVER:    { minXP: 500,  feeWei: '1200000000000000',   dailyBonus: 10,  multiplierBP: 500,  maxSupply: 500  },
  GOLD:      { minXP: 1500, feeWei: '2000000000000000',   dailyBonus: 20,  multiplierBP: 1000, maxSupply: 250  },
  PLATINUM:  { minXP: 4000, feeWei: '12000000000000000',  dailyBonus: 40,  multiplierBP: 1500, maxSupply: 100  },
  DIAMOND:   { minXP: 10000,feeWei: '25000000000000000',  dailyBonus: 100, multiplierBP: 2000, maxSupply: 50   },
};

// MasterX ABI (only what we need)
const MASTER_X_ABI = [
  { inputs: [{ type: 'uint8', name: '' }], name: 'tierMinXP', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'uint8', name: 'tier' }, { type: 'uint256', name: 'feeWei' }, { type: 'uint256', name: 'minXP' }], name: 'setTierConfig', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  // Ownable
  { inputs: [], name: 'owner', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
];

// DailyAppV16 ABI (at proxy — uses UUPS storage)
const DAILY_APP_ABI = [
  { inputs: [{ type: 'uint8', name: '' }], name: 'nftConfigs', outputs: [
    { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
    { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }
  ], stateMutability: 'view', type: 'function' },
  { inputs: [
    { type: 'uint8[]', name: 'tiers' },
    { type: 'uint256[]', name: 'pointsRequired' },
    { type: 'uint256[]', name: 'mintPrices' },
    { type: 'uint256[]', name: 'dailyBonuses' },
    { type: 'uint256[]', name: 'multiplierBPs' },
    { type: 'uint256[]', name: 'maxSupplies' },
    { type: 'bool[]', name: 'isOpen' }
  ], name: 'setNFTConfigsBatch', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

async function reconcile() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  TIER RECONCILIATION: MasterX ↔ DailyAppV16            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Validate
  if (!PRIVATE_KEY) { console.error('❌ PRIVATE_KEY missing'); process.exit(1); }

  const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace('0x', '')}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });

  console.log(`🔗 Base Sepolia (84532)`);
  console.log(`🏛️  MasterX:      ${MASTER_X_ADDRESS}`);
  console.log(`🏛️  DailyAppV16:  ${DAILY_APP_V16_PROXY} (UUPS Proxy)`);
  console.log(`👤  Account:      ${account.address}\n`);

  // Verify account is owner of MasterX
  const owner = await publicClient.readContract({
    address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'owner'
  });
  const isOwner = owner.toLowerCase() === account.address.toLowerCase();
  console.log(`🔑 MasterX Owner: ${owner} ${isOwner ? '✅ IT IS YOU' : '⚠️ NOT YOU'}`);

  // === STEP 1: Read current state ===
  console.log('\n=== STEP 1: Current State ===');
  
  console.log('\n-- MasterX tierMinXP --');
  const currentMasterXP = [];
  for (let i = 1; i <= 5; i++) {
    const xp = await publicClient.readContract({
      address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'tierMinXP', args: [i]
    });
    currentMasterXP[i] = Number(xp);
    const tier = TIER_NAMES[i];
    const expected = TIER_CONFIG[tier].minXP;
    console.log(`  ${i}. ${tier}: current=${Number(xp)} expected=${expected} ${Number(xp) === expected ? '✅' : '❌'}`);
  }

  console.log('\n-- DailyAppV16 nftConfigs (proxy) --');
  const currentDaily = [];
  for (let i = 1; i <= 5; i++) {
    const cfg = await publicClient.readContract({
      address: DAILY_APP_V16_PROXY, abi: DAILY_APP_ABI, functionName: 'nftConfigs', args: [i]
    });
    currentDaily[i] = {
      pointsRequired: Number(cfg[0]),
      mintPrice: cfg[1].toString(),
      dailyBonus: Number(cfg[2]),
      multiplierBP: Number(cfg[3]),
      maxSupply: Number(cfg[4]),
      currentSupply: Number(cfg[5]),
      isOpen: cfg[6]
    };
    const tier = TIER_NAMES[i];
    const expected = TIER_CONFIG[tier];
    const match = currentDaily[i].pointsRequired === expected.minXP && currentDaily[i].isOpen === true;
    console.log(`  ${i}. ${tier}: pointsRequired=${currentDaily[i].pointsRequired} isOpen=${currentDaily[i].isOpen} ${match ? '✅' : '❌'}`);
  }

  // === STEP 2: Fix MasterX tierMinXP (only if owner) ===
  if (isOwner) {
    console.log('\n=== STEP 2: Setting MasterX tierMinXP via setTierConfig ===');
    for (let i = 1; i <= 5; i++) {
      const tier = TIER_NAMES[i];
      const cfg = TIER_CONFIG[tier];
      if (currentMasterXP[i] !== cfg.minXP) {
        console.log(`  Setting ${tier}: minXP=${cfg.minXP}, feeWei=${cfg.feeWei}...`);
        try {
          const hash = await walletClient.writeContract({
            address: MASTER_X_ADDRESS,
            abi: MASTER_X_ABI,
            functionName: 'setTierConfig',
            args: [i, BigInt(cfg.feeWei), BigInt(cfg.minXP)],
            gas: 200000n,
          });
          console.log(`  ⛽ Tx: ${hash}`);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log(`  ✅ Status: ${receipt.status === 'success' ? 'SUCCESS' : 'FAILED'}`);
          // Add delay to avoid nonce issues
          await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
          console.error(`  ❌ Failed: ${err.shortMessage || err.message}`);
        }
      } else {
        console.log(`  ✅ ${tier} already correct`);
      }
    }
  } else {
    console.log('\n⚠️  Cannot fix MasterX — not the owner. Owner must call setTierConfig manually.');
  }

  // === STEP 3: Fix DailyAppV16 nftConfigs ===
  console.log('\n=== STEP 3: Syncing DailyAppV16 nftConfigs ===');
  
  const tiersToFix = [];
  const needsOpen = [];
  for (let i = 1; i <= 5; i++) {
    const tier = TIER_NAMES[i];
    const cfg = TIER_CONFIG[tier];
    if (currentDaily[i].pointsRequired !== cfg.minXP || !currentDaily[i].isOpen) {
      tiersToFix.push(i);
      if (currentDaily[i].pointsRequired !== cfg.minXP) needsOpen.push(tier);
    }
  }

  if (tiersToFix.length > 0) {
    console.log(`  Need to fix ${tiersToFix.length} tiers: ${tiersToFix.map(i => TIER_NAMES[i]).join(', ')}`);

    const tierIndices = tiersToFix;
    const pointsRequired = tiersToFix.map(i => BigInt(TIER_CONFIG[TIER_NAMES[i]].minXP));
    const mintPrices = tiersToFix.map(i => BigInt(TIER_CONFIG[TIER_NAMES[i]].feeWei));
    const dailyBonuses = tiersToFix.map(i => BigInt(TIER_CONFIG[TIER_NAMES[i]].dailyBonus));
    const multiplierBPs = tiersToFix.map(i => BigInt(TIER_CONFIG[TIER_NAMES[i]].multiplierBP));
    const maxSupplies = tiersToFix.map(i => BigInt(TIER_CONFIG[TIER_NAMES[i]].maxSupply));
    const isOpenArr = tiersToFix.map(() => true);

    try {
      const hash = await walletClient.writeContract({
        address: DAILY_APP_V16_PROXY,
        abi: DAILY_APP_ABI,
        functionName: 'setNFTConfigsBatch',
        args: [tierIndices, pointsRequired, mintPrices, dailyBonuses, multiplierBPs, maxSupplies, isOpenArr],
        gas: 500000n,
      });
      console.log(`  ⛽ Tx: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✅ Block ${receipt.blockNumber}, status: ${receipt.status === 'success' ? 'SUCCESS' : 'FAILED'}`);
    } catch (err) {
      console.error(`  ❌ Failed: ${err.shortMessage || err.message}`);
    }
  } else {
    console.log('  ✅ All tiers already synced');
  }

  // === STEP 4: Final Verification ===
  console.log('\n=== STEP 4: Final Verification ===');
  
  console.log('\n-- MasterX tierMinXP --');
  let allGood = true;
  for (let i = 1; i <= 5; i++) {
    const xp = await publicClient.readContract({
      address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'tierMinXP', args: [i]
    });
    const expected = TIER_CONFIG[TIER_NAMES[i]].minXP;
    const ok = Number(xp) === expected;
    if (!ok) allGood = false;
    console.log(`  ${ok ? '✅' : '❌'} ${TIER_NAMES[i]}: ${Number(xp)} / ${expected}`);
  }

  console.log('\n-- DailyAppV16 nftConfigs --');
  for (let i = 1; i <= 5; i++) {
    const cfg = await publicClient.readContract({
      address: DAILY_APP_V16_PROXY, abi: DAILY_APP_ABI, functionName: 'nftConfigs', args: [i]
    });
    const expected = TIER_CONFIG[TIER_NAMES[i]].minXP;
    const ok = Number(cfg[0]) === expected && cfg[6] === true;
    if (!ok) allGood = false;
    console.log(`  ${ok ? '✅' : '❌'} ${TIER_NAMES[i]}: pointsRequired=${Number(cfg[0])} / ${expected} | isOpen=${cfg[6]}`);
  }

  console.log(`\n${allGood ? '✅ ALL TIERS RECONCILED SUCCESSFULLY' : '❌ Some tiers still out of sync'}`);
}

reconcile().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});