require('dotenv').config();
const hre = require('hardhat');

async function main() {
    const MASTER_X = process.env.VITE_MASTER_X_ADDRESS_SEPOLIA;
    const V15 = '0x0D6f339795EeA5129461388F25dE4f87e92b8DA2';

    const masterX = await hre.ethers.getContractAt('CryptoDiscoMasterX', MASTER_X);
    
    console.log('📡 Registering V15 as satellite in MasterX...');
    const tx1 = await masterX.setSatelliteStatus(V15, true);
    await tx1.wait();
    console.log('✅ V15 registered as satellite');

    // Also set DailyApp contract reference
    console.log('📡 Setting dailyAppContract to V15...');
    const tx2 = await masterX.setDailyAppContract(V15);
    await tx2.wait();
    console.log('✅ dailyAppContract updated to V15');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
