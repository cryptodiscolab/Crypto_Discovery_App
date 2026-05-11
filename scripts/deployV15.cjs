/**
 * Deploy DailyAppV15 to Base Sepolia
 * Run: node scripts/deployV15.cjs
 * 
 * Prerequisites:
 * - .env has PRIVATE_KEY and VITE_BASE_SEPOLIA_RPC_URL
 * - npx hardhat compile (already done)
 */
require('dotenv').config();
const hre = require('hardhat');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log('🚀 Deploying DailyAppV15 with:', deployer.address);
    console.log('💰 Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH');

    // Constructor args (same as V14)
    const CREATOR_TOKEN = process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA || process.env.VITE_MASTER_X_ADDRESS_SEPOLIA;
    const USDC_TOKEN = process.env.VITE_USDC_ADDRESS;
    const ADMIN = deployer.address;

    if (!CREATOR_TOKEN || !USDC_TOKEN) {
        console.error('❌ Missing CREATOR_TOKEN or USDC_TOKEN in .env');
        process.exit(1);
    }

    console.log('📋 Constructor args:');
    console.log('  - creatorToken:', CREATOR_TOKEN);
    console.log('  - usdcToken:', USDC_TOKEN);
    console.log('  - initialOwner:', ADMIN);

    const DailyAppV15 = await hre.ethers.getContractFactory('DailyAppV15');
    const contract = await DailyAppV15.deploy(CREATOR_TOKEN, USDC_TOKEN, ADMIN);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log('✅ DailyAppV15 deployed to:', address);
    console.log('');
    console.log('📝 NEXT STEPS:');
    console.log('1. Update .env: VITE_DAILY_APP_V15_ADDRESS=' + address);
    console.log('2. Run: node scripts/sync/sync-all-envs.cjs');
    console.log('3. Configure: setMasterX, setVerifierWallet, setNFTConfigsBatch');
    console.log('4. Grant VERIFIER_ROLE to backend wallet');
}

main().catch((error) => {
    console.error('❌ Deploy failed:', error.message);
    process.exit(1);
});
