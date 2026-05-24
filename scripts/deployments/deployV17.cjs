/**
 * Deploy DailyAppV17 (UUPS Upgrade)
 * Run: npx hardhat run scripts/deployments/deployV17.cjs --network base-sepolia
 */
require('dotenv').config();
const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('🚀 Upgrading to DailyAppV17 with:', deployer.address);
    console.log('💰 Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');

    const PROXY_ADDRESS = process.env.VITE_DAILY_APP_ADDRESS_SEPOLIA || process.env.VITE_DAILY_APP_V16_ADDRESS;
    
    if (!PROXY_ADDRESS) {
        console.error('❌ Missing PROXY_ADDRESS in .env (VITE_DAILY_APP_ADDRESS_SEPOLIA)');
        process.exit(1);
    }

    console.log('📦 Proxy address to upgrade:', PROXY_ADDRESS);

    const DailyAppV16 = await ethers.getContractFactory('DailyAppV16');
    console.log('🔄 Forcing import of previous implementation...');
    try {
        await upgrades.forceImport(PROXY_ADDRESS, DailyAppV16, { kind: 'uups' });
        console.log('✅ Force import successful');
    } catch (e) {
        console.log('⚠️ Force import note:', e.message);
    }

    const DailyAppV17 = await ethers.getContractFactory('DailyAppV17');
    console.log('🔄 Upgrading proxy...');
    
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, DailyAppV17, {
        kind: 'uups'
    });
    await upgraded.waitForDeployment();

    const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log('✅ DailyAppV17 upgrade complete!');
    console.log('🔹 Proxy Address (unchanged):', PROXY_ADDRESS);
    console.log('🔹 New Implementation Address:', implAddress);

    console.log('');
    console.log('📝 NEXT STEPS:');
    console.log('1. Verify the implementation contract on Basescan');
    console.log(`   npx hardhat verify --network base-sepolia ${implAddress}`);
}

main().catch((error) => {
    console.error('❌ Upgrade failed:', error.message);
    process.exit(1);
});
