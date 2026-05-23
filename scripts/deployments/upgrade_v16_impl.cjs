/**
 * Upgrade DailyAppV16 UUPS Implementation
 * Deploys new implementation and upgrades existing proxy
 *
 * Run:
 *   npx hardhat run scripts/deployments/upgrade_v16_impl.cjs --network base-sepolia
 *
 * Required env:
 *   PRIVATE_KEY
 *   BASE_SEPOLIA_RPC_URL
 *   VITE_DAILY_APP_V16_ADDRESS (the existing proxy address)
 */
'use strict';

require('dotenv').config();

const { ethers } = require('hardhat');

function cleanAddress(value, label) {
    const cleaned = String(value || '').trim().replace(/^["']|["']$/g, '');
    if (!ethers.isAddress(cleaned)) {
        throw new Error(`Invalid or missing ${label}: "${value}"`);
    }
    return ethers.getAddress(cleaned);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    if (network.chainId !== 84532n) {
        throw new Error(`Refusing to upgrade on non-Base-Sepolia chainId ${network.chainId}`);
    }

    const proxyAddress = cleanAddress(
        process.env.VITE_DAILY_APP_V16_ADDRESS,
        'VITE_DAILY_APP_V16_ADDRESS'
    );

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('=== DailyAppV16 UUPS Upgrade ===');
    console.log('  Deployer:', deployer.address);
    console.log('  Network:', `${network.name} (${network.chainId})`);
    console.log('  Balance:', ethers.formatEther(balance), 'ETH');
    console.log('  Proxy:', proxyAddress);

    if (balance < ethers.parseEther('0.001')) {
        throw new Error('Insufficient ETH balance (need > 0.001 ETH for gas)');
    }

    // 1. Deploy new implementation
    console.log('\n[1] Deploying new DailyAppV16 implementation...');
    const DailyAppV16 = await ethers.getContractFactory('DailyAppV16');
    const newImpl = await DailyAppV16.deploy();
    await newImpl.waitForDeployment();
    const newImplAddress = await newImpl.getAddress();
    console.log('  New implementation:', newImplAddress);

    // 2. Connect to proxy with ADMIN_ROLE ABI
    const proxyAbi = [
        'function upgradeToAndCall(address newImplementation, bytes calldata data) external payable',
        'function hasRole(bytes32 role, address account) external view returns (bool)',
        'function ADMIN_ROLE() external view returns (bytes32)',
    ];
    const proxy = new ethers.Contract(proxyAddress, proxyAbi, deployer);

    // 3. Verify caller has ADMIN_ROLE
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
    const hasAdmin = await proxy.hasRole(ADMIN_ROLE, deployer.address);
    if (!hasAdmin) {
        throw new Error(`Deployer ${deployer.address} does not have ADMIN_ROLE on proxy`);
    }
    console.log('  ✅ ADMIN_ROLE confirmed');

    // 4. Perform the upgrade (empty calldata — no re-initialization needed)
    console.log('\n[2] Calling upgradeToAndCall on proxy...');
    const upgradeTx = await proxy.upgradeToAndCall(newImplAddress, '0x');
    const receipt = await upgradeTx.wait();
    console.log('  ✅ Upgrade tx:', receipt.hash);
    console.log('  Gas used:', receipt.gasUsed.toString());

    console.log('\n=== Upgrade Complete ===');
    console.log('  Proxy (unchanged):', proxyAddress);
    console.log('  New implementation:', newImplAddress);
    console.log('');
    console.log('What changed in this upgrade:');
    console.log('  + pause() / unpause() — emergency circuit breaker (ADMIN_ROLE gated)');
    console.log('  + whenNotPaused on doTask, claimDailyBonus, mintNFT, upgradeNFT');
    console.log('  + nonReentrant on withdrawTreasury');
    console.log('');
    console.log('Next: Update daily_app_abi.json and run rebuild_abis_data.cjs');
}

main().catch((error) => {
    console.error('Upgrade failed:', error.shortMessage || error.message);
    process.exit(1);
});
