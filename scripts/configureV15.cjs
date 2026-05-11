/**
 * Post-Deploy Configuration for DailyAppV15
 * Run: npx hardhat run scripts/configureV15.cjs --network base-sepolia
 */
require('dotenv').config();
const hre = require('hardhat');

const V15_ADDRESS = '0x0D6f339795EeA5129461388F25dE4f87e92b8DA2';
const MASTER_X = process.env.VITE_MASTER_X_ADDRESS_SEPOLIA;
const VERIFIER = (process.env.VITE_ADMIN_ADDRESS || '').split(',')[0].trim();

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log('⚙️  Configuring DailyAppV15 at:', V15_ADDRESS);
    console.log('   Deployer:', deployer.address);

    const v15 = await hre.ethers.getContractAt('DailyAppV15', V15_ADDRESS);

    // 1. Set MasterX — ALREADY DONE
    console.log('1. setMasterX → ALREADY CONFIGURED');

    // 2. Set Verifier Wallet
    if (VERIFIER) {
        console.log('2. setVerifierWallet →', VERIFIER);
        const tx2 = await v15.setVerifierWallet(VERIFIER);
        await tx2.wait();
        console.log('   ✅ Done');
    }

    // 3. Grant VERIFIER_ROLE to deployer (for backend signing)
    const VERIFIER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VERIFIER_ROLE"));
    console.log('3. grantRole(VERIFIER_ROLE) →', VERIFIER);
    const tx3 = await v15.grantRole(VERIFIER_ROLE, VERIFIER);
    await tx3.wait();
    console.log('   ✅ Done');

    // 4. Set NFT Configs (same as V14)
    console.log('4. setNFTConfigsBatch...');
    const tiers = [1, 2, 3, 4, 5]; // BRONZE, SILVER, GOLD, PLATINUM, DIAMOND
    const pointsRequired = [500, 2000, 5000, 10000, 25000];
    const mintPrices = [
        hre.ethers.parseEther('0.001'),
        hre.ethers.parseEther('0.002'),
        hre.ethers.parseEther('0.005'),
        hre.ethers.parseEther('0.01'),
        hre.ethers.parseEther('0.025')
    ];
    const dailyBonuses = [110, 125, 150, 200, 300];
    const multiplierBPs = [11000, 12500, 15000, 20000, 30000];
    const maxSupplies = [1000, 500, 200, 50, 10];
    const isOpen = [true, true, true, true, true];

    const tx4 = await v15.setNFTConfigsBatch(tiers, pointsRequired, mintPrices, dailyBonuses, multiplierBPs, maxSupplies, isOpen);
    await tx4.wait();
    console.log('   ✅ Done');

    // 5. Set USDC token config
    const USDC = process.env.VITE_USDC_ADDRESS;
    if (USDC) {
        console.log('5. setAllowedToken(USDC)...');
        const tx5 = await v15.setAllowedToken(USDC, true, 6, "USDC");
        await tx5.wait();
        console.log('   ✅ Done');
    }

    console.log('\n🎉 Configuration complete!');
    console.log('   Contract: ', V15_ADDRESS);
    console.log('   MasterX:  ', MASTER_X);
    console.log('   Verifier: ', VERIFIER);
}

main().catch((error) => {
    console.error('❌ Config failed:', error.message);
    process.exit(1);
});
