/**
 * Link Correct MasterX with existing Raffle & DailyAppV16
 *
 * Run:
 *   npx hardhat run scripts/deployments/link_correct_masterx.cjs --network base-sepolia
 */
'use strict';

require('dotenv').config();
const { ethers } = require('hardhat');

const NEW_MASTER_X  = '0x1b573DdD9a1679505ae64498564523222c758EC2';
const RAFFLE        = '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7';
const V16_PROXY     = '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353';

// Minimal ABIs
const MASTER_X_ABI = [
    'function setDailyAppContract(address) external',
    'function setRaffleContract(address) external',
    'function setSatelliteStatus(address, bool) external',
    'function setTierConfig(uint8 tier, uint256 feeWei, uint256 minXP) external',
    'function owner() view returns (address)'
];

const RAFFLE_ABI = [
    'function setMaster(address) external',
    'function owner() view returns (address)'
];

const V16_ABI = [
    'function setMasterX(address) external',
    'function masterXContract() view returns (address)'
];

const tiers = [
    { id: 1, name: 'BRONZE', xp: 100n },
    { id: 2, name: 'SILVER', xp: 500n },
    { id: 3, name: 'GOLD', xp: 1500n },
    { id: 4, name: 'PLATINUM', xp: 4000n },
    { id: 5, name: 'DIAMOND', xp: 10000n }
];

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log(`\n=== Link Correct MasterX ===`);
    console.log(`Deployer : ${deployer.address}`);
    console.log(`Network  : ${network.name} (${network.chainId})`);
    console.log(`Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log(`New MasterX: ${NEW_MASTER_X}`);
    console.log(`Raffle     : ${RAFFLE}`);
    console.log(`V16 Proxy  : ${V16_PROXY}`);
    console.log('');

    const masterX = new ethers.Contract(NEW_MASTER_X, MASTER_X_ABI, deployer);
    const raffle  = new ethers.Contract(RAFFLE,        RAFFLE_ABI,   deployer);
    const v16     = new ethers.Contract(V16_PROXY,     V16_ABI,      deployer);

    // ── 1. MasterX: link DailyAppV16 proxy ───────────────────────────────────
    console.log('[1] MasterX.setDailyAppContract(V16)...');
    let tx = await masterX.setDailyAppContract(V16_PROXY);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 2. MasterX: link Raffle ──────────────────────────────────────────────
    console.log('[2] MasterX.setRaffleContract(Raffle)...');
    tx = await masterX.setRaffleContract(RAFFLE);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 3. MasterX: whitelist Raffle as satellite ────────────────────────────
    console.log('[3] MasterX.setSatelliteStatus(Raffle, true)...');
    tx = await masterX.setSatelliteStatus(RAFFLE, true);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 4. MasterX: whitelist DailyAppV16 as satellite ───────────────────────
    console.log('[4] MasterX.setSatelliteStatus(V16, true)...');
    tx = await masterX.setSatelliteStatus(V16_PROXY, true);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 5. Raffle: set new MasterX ───────────────────────────────────────────
    console.log('[5] Raffle.setMaster(MasterX)...');
    tx = await raffle.setMaster(NEW_MASTER_X);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 6. DailyAppV16: set new MasterX ──────────────────────────────────────
    console.log('[6] V16.setMasterX(MasterX)...');
    tx = await v16.setMasterX(NEW_MASTER_X);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 7. MasterX: Configure Tiers ──────────────────────────────────────────
    console.log('[7] Configuring MasterX Tiers...');
    for (const tier of tiers) {
        console.log(`  - Configuring ${tier.name} (ID: ${tier.id})...`);
        tx = await masterX.setTierConfig(tier.id, 0n, tier.xp);
        await tx.wait();
        console.log(`    ✅ tx: ${tx.hash}`);
    }

    console.log('\n=== Verification ===');
    const masterXLinked = await v16.masterXContract();
    console.log(`  V16.masterXContract = ${masterXLinked} ${masterXLinked.toLowerCase() === NEW_MASTER_X.toLowerCase() ? '✅' : '❌'}`);

    console.log('\n🎉 Linking & Configuration Complete successfully!');
}

main().catch(err => {
    console.error('Link failed:', err.shortMessage || err.message);
    process.exit(1);
});
