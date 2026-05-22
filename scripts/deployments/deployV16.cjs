/**
 * Deploy DailyAppV16 through an ERC1967 UUPS proxy on Base Sepolia.
 *
 * Run:
 *   npx hardhat run scripts/deployments/deployV16.cjs --network base-sepolia
 *
 * Required env:
 *   PRIVATE_KEY
 *   BASE_SEPOLIA_RPC_URL
 *   CREATOR_TOKEN_ADDRESS or VITE_CREATOR_TOKEN_ADDRESS
 *   VITE_USDC_ADDRESS or VITE_USDC_ADDRESS_SEPOLIA or USDC_ADDRESS
 */
'use strict';

require('dotenv').config();

const { ethers } = require('hardhat');
const ERC1967ProxyArtifact = require('@openzeppelin/contracts/build/contracts/ERC1967Proxy.json');

function cleanAddress(value, label) {
    const cleaned = String(value || '').trim().replace(/^["']|["']$/g, '');
    if (!ethers.isAddress(cleaned)) {
        throw new Error(`Invalid or missing ${label}`);
    }
    return ethers.getAddress(cleaned);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    const creatorToken = cleanAddress(
        process.env.CREATOR_TOKEN_ADDRESS || process.env.VITE_CREATOR_TOKEN_ADDRESS,
        'CREATOR_TOKEN_ADDRESS'
    );
    const usdcToken = cleanAddress(
        process.env.VITE_USDC_ADDRESS || process.env.VITE_USDC_ADDRESS_SEPOLIA || process.env.USDC_ADDRESS,
        'VITE_USDC_ADDRESS'
    );
    const initialOwner = deployer.address;

    console.log('Deploying DailyAppV16 UUPS proxy');
    console.log('  Deployer:', initialOwner);
    console.log('  Network:', `${network.name} (${network.chainId})`);
    console.log('  Balance:', ethers.formatEther(await ethers.provider.getBalance(initialOwner)), 'ETH');
    console.log('  Creator token:', creatorToken);
    console.log('  USDC token:', usdcToken);

    if (network.chainId !== 84532n) {
        throw new Error(`Refusing to deploy DailyAppV16 to non-Base-Sepolia chainId ${network.chainId}`);
    }

    console.log('  Deploying implementation...');
    const DailyAppV16 = await ethers.getContractFactory('DailyAppV16');
    const implementation = await DailyAppV16.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();
    console.log('  Implementation confirmed:', implementationAddress);

    console.log('  Deploying ERC1967 proxy...');
    const initData = DailyAppV16.interface.encodeFunctionData('initialize', [
        creatorToken,
        usdcToken,
        initialOwner,
    ]);
    const ProxyFactory = new ethers.ContractFactory(
        ERC1967ProxyArtifact.abi,
        ERC1967ProxyArtifact.bytecode,
        deployer
    );
    const proxyDeployment = await ProxyFactory.deploy(implementationAddress, initData);
    await proxyDeployment.waitForDeployment();
    const proxyAddress = await proxyDeployment.getAddress();
    console.log('  Proxy deployment confirmed:', proxyAddress);

    console.log('');
    console.log('DailyAppV16 deployed');
    console.log('  Proxy:', proxyAddress);
    console.log('  Implementation:', implementationAddress);
    console.log('  Initial owner:', initialOwner);
    console.log('');
    console.log('Next steps:');
    console.log(`  VITE_DAILY_APP_V16_ADDRESS=${proxyAddress}`);
    console.log('  setMasterX(<MASTER_X_ADDRESS>)');
    console.log('  grantRaffleRole(<RAFFLE_ADDRESS>)');
    console.log('  grantSocialRole(<verification-server-wallet>)');
    console.log('  grantUgcRole(<ugc-backend-wallet>)');
    console.log('  grantMojoRole(<mojo-cron-wallet>)');
    console.log('  grantSwapRole(<swap-bot-wallet>)');
    console.log('  grantPurchaseRole(<purchase-bot-wallet>)');
}

main().catch((error) => {
    console.error('Deploy failed:', error.shortMessage || error.message);
    process.exit(1);
});
