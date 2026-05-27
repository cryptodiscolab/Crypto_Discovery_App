/**
 * Initialize & Link New MasterX + Raffle Contracts
 * Run ONCE after deploying new CryptoDiscoMasterX + CryptoDiscoRaffle
 *
 * Run:
 *   npx hardhat run scripts/deployments/init_new_contracts.cjs --network base-sepolia
 */
'use strict';

require('dotenv').config();
const { ethers } = require('hardhat');

const NEW_MASTER_X  = '0x1b573DdD9a1679505ae64498564523222c758EC2';
const NEW_RAFFLE    = '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7';
const V16_PROXY     = '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353';

// API3 QRNG — Base Sepolia
const AIRNODE        = '0x6238772544f029ecaBfDED4300f13A3c4FE84E1D';
const ENDPOINT_ID    = '0xfb6d017bb87991b7495f563db3c8cf59ff87b09781947bb1e417006ad7f55a78';
const SPONSOR_WALLET = process.env.SPONSOR_WALLET || '0x7186e5D35f126c3C809670F567b594582f3C7d61';

// Minimal ABIs for the calls we need
const MASTER_X_ABI = [
    'function setDailyAppContract(address) external',
    'function setRaffleContract(address) external',
    'function setSatelliteStatus(address, bool) external',
    'function owner() view returns (address)',
];

const RAFFLE_ABI = [
    'function setQRNGParameters(address, bytes32, address) external',
    'function initializeFirstRaffle() external',
    'function currentRaffleId() view returns (uint256)',
    'function setMaster(address) external',
    'function owner() view returns (address)',
];

const V16_ABI = [
    'function setMasterX(address) external',
    'function grantRaffleRole(address) external',
    'function grantSocialRole(address) external',
    'function masterXContract() view returns (address)',
    'function hasRole(bytes32, address) view returns (bool)',
];

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log(`\n=== Initialize New Contracts ===`);
    console.log(`Deployer : ${deployer.address}`);
    console.log(`Network  : ${network.name} (${network.chainId})`);
    console.log(`Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log(`MasterX  : ${NEW_MASTER_X}`);
    console.log(`Raffle   : ${NEW_RAFFLE}`);
    console.log(`V16Proxy : ${V16_PROXY}`);
    console.log('');

    const masterX = new ethers.Contract(NEW_MASTER_X, MASTER_X_ABI, deployer);
    const raffle  = new ethers.Contract(NEW_RAFFLE,   RAFFLE_ABI,   deployer);
    const v16     = new ethers.Contract(V16_PROXY,    V16_ABI,      deployer);

    // ── 1. MasterX: link DailyAppV16 proxy ───────────────────────────────────
    console.log('[1] MasterX.setDailyAppContract(V16)...');
    let tx = await masterX.setDailyAppContract(V16_PROXY);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 2. MasterX: link new Raffle ───────────────────────────────────────────
    console.log('[2] MasterX.setRaffleContract(Raffle)...');
    tx = await masterX.setRaffleContract(NEW_RAFFLE);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 3. MasterX: whitelist Raffle as satellite (for addPoints calls) ───────
    console.log('[3] MasterX.setSatelliteStatus(Raffle, true)...');
    tx = await masterX.setSatelliteStatus(NEW_RAFFLE, true);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 4. DailyAppV16: set new MasterX ──────────────────────────────────────
    console.log('[4] V16.setMasterX(MasterX)...');
    tx = await v16.setMasterX(NEW_MASTER_X);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 5. DailyAppV16: grant RAFFLE_ROLE to new Raffle ──────────────────────
    console.log('[5] V16.grantRaffleRole(Raffle)...');
    tx = await v16.grantRaffleRole(NEW_RAFFLE);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 6. Raffle: set QRNG parameters ───────────────────────────────────────
    console.log('[6] Raffle.setQRNGParameters(airnode, endpointId, sponsorWallet)...');
    tx = await raffle.setQRNGParameters(AIRNODE, ENDPOINT_ID, SPONSOR_WALLET);
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── 7. Raffle: initialize first raffle ────────────────────────────────────
    console.log('[7] Raffle.initializeFirstRaffle()...');
    tx = await raffle.initializeFirstRaffle();
    await tx.wait();
    console.log(`  ✅ tx: ${tx.hash}`);

    // ── Verify state ─────────────────────────────────────────────────────────
    console.log('\n=== Verification ===');
    const masterXLinked = await v16.masterXContract();
    console.log(`  V16.masterXContract = ${masterXLinked} ${masterXLinked.toLowerCase() === NEW_MASTER_X.toLowerCase() ? '✅' : '❌'}`);

    const raffleId = await raffle.currentRaffleId();
    console.log(`  Raffle.currentRaffleId = ${raffleId} ${raffleId > 0n ? '✅' : '❌'}`);

    console.log(`
=== Initialization Complete ===
New addresses to update:
  VITE_MASTER_X_ADDRESS_SEPOLIA = ${NEW_MASTER_X}
  VITE_RAFFLE_ADDRESS_SEPOLIA   = ${NEW_RAFFLE}
  VITE_MASTER_X_ADDRESS         = ${NEW_MASTER_X}
  VITE_RAFFLE_ADDRESS           = ${NEW_RAFFLE}
    `);
}

main().catch(err => {
    console.error('Init failed:', err.shortMessage || err.message);
    process.exit(1);
});
