'use strict';

require('dotenv').config();
const { ethers } = require('hardhat');

const MASTER_X = process.env.VITE_MASTER_X_ADDRESS_SEPOLIA || process.env.MASTER_X_ADDRESS_SEPOLIA;
const DAILY_APP = process.env.VITE_DAILY_APP_ADDRESS_SEPOLIA
    || process.env.DAILY_APP_ADDRESS_SEPOLIA
    || process.env.VITE_DAILY_APP_V16_ADDRESS
    || '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353';
const AIRNODE_RRP = process.env.AIRNODE_RRP || '0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd';
const AIRNODE = process.env.AIRNODE_ADDRESS || '0x6238772544f029ecaBfDED4300f13A3c4FE84E1D';
const ENDPOINT_ID = process.env.ENDPOINT_ID_UINT256 || '0xfb6d017bb87991b7495f563db3c8cf59ff87b09781947bb1e417006ad7f55a78';
const SPONSOR_WALLET = process.env.SPONSOR_WALLET || '0x40eF15db2F08F322abCE913ead1cF039FDC48d92';

const MASTER_X_ABI = [
    'function setRaffleContract(address) external',
    'function setSatelliteStatus(address,bool) external',
    'function raffleContract() view returns (address)',
    'function isSatellite(address) view returns (bool)',
    'function owner() view returns (address)'
];

const DAILY_APP_ABI = [
    'function grantRaffleRole(address) external',
    'function hasRole(bytes32,address) view returns (bool)'
];

const RAFFLE_ABI = [
    'function airnodeRrp() view returns (address)',
    'function airnode() view returns (address)',
    'function endpointIdUint256() view returns (bytes32)',
    'function sponsorWallet() view returns (address)',
    'function setQRNGParameters(address,bytes32,address) external',
    'function setRrpSponsorshipStatus(bool) external',
    'function initializeFirstRaffle() external',
    'function currentRaffleId() view returns (uint256)',
    'function owner() view returns (address)'
];

async function wait(tx, label) {
    console.log(`${label}: ${tx.hash}`);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error(`${label} failed`);
    return receipt;
}

function requireAddress(name, value) {
    const cleaned = String(value || '').trim().toLowerCase();
    if (!cleaned || !ethers.isAddress(cleaned)) throw new Error(`${name} is missing or invalid`);
    return ethers.getAddress(cleaned);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const masterXAddress = requireAddress('MASTER_X', MASTER_X);
    const dailyAppAddress = requireAddress('DAILY_APP', DAILY_APP);
    const airnodeRrpAddress = requireAddress('AIRNODE_RRP', AIRNODE_RRP);
    const airnodeAddress = requireAddress('AIRNODE_ADDRESS', AIRNODE);
    const sponsorWalletAddress = requireAddress('SPONSOR_WALLET', SPONSOR_WALLET);

    const rrpCode = await ethers.provider.getCode(airnodeRrpAddress);
    if (!rrpCode || rrpCode === '0x') {
        throw new Error(`AIRNODE_RRP has no bytecode on chain ${network.chainId}: ${airnodeRrpAddress}`);
    }

    console.log('=== Raffle QRNG Cutover ===');
    console.log(`Network       : ${network.name} (${network.chainId})`);
    console.log(`Deployer      : ${deployer.address}`);
    console.log(`Balance       : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log(`MasterX       : ${masterXAddress}`);
    console.log(`DailyApp      : ${dailyAppAddress}`);
    console.log(`AirnodeRRP    : ${airnodeRrpAddress}`);
    console.log(`Airnode       : ${airnodeAddress}`);
    console.log(`SponsorWallet : ${sponsorWalletAddress}`);

    const Raffle = await ethers.getContractFactory('CryptoDiscoRaffle');
    const raffle = await Raffle.deploy(masterXAddress, airnodeRrpAddress);
    await raffle.waitForDeployment();
    const raffleAddress = await raffle.getAddress();
    console.log(`Raffle deployed: ${raffleAddress}`);

    await wait(await raffle.setQRNGParameters(airnodeAddress, ENDPOINT_ID, sponsorWalletAddress), 'setQRNGParameters');
    await wait(await raffle.setRrpSponsorshipStatus(true), 'setRrpSponsorshipStatus');
    await wait(await raffle.initializeFirstRaffle(), 'initializeFirstRaffle');

    const masterX = new ethers.Contract(masterXAddress, MASTER_X_ABI, deployer);
    await wait(await masterX.setRaffleContract(raffleAddress), 'MasterX.setRaffleContract');
    await wait(await masterX.setSatelliteStatus(raffleAddress, true), 'MasterX.setSatelliteStatus');

    const dailyApp = new ethers.Contract(dailyAppAddress, DAILY_APP_ABI, deployer);
    const raffleRole = ethers.keccak256(ethers.toUtf8Bytes('RAFFLE_ROLE'));
    const hasRoleBefore = await dailyApp.hasRole(raffleRole, raffleAddress);
    if (!hasRoleBefore) {
        await wait(await dailyApp.grantRaffleRole(raffleAddress), 'DailyApp.grantRaffleRole');
    } else {
        console.log('DailyApp.grantRaffleRole: already granted');
    }

    const readRaffle = new ethers.Contract(raffleAddress, RAFFLE_ABI, deployer);
    const [linkedRaffle, isSatellite, currentRaffleId, configuredAirnode, configuredRrp, configuredSponsor, hasRoleAfter] = await Promise.all([
        masterX.raffleContract(),
        masterX.isSatellite(raffleAddress),
        readRaffle.currentRaffleId(),
        readRaffle.airnode(),
        readRaffle.airnodeRrp(),
        readRaffle.sponsorWallet(),
        dailyApp.hasRole(raffleRole, raffleAddress)
    ]);

    const result = {
        raffleAddress,
        masterX: masterXAddress,
        dailyApp: dailyAppAddress,
        airnodeRrp: configuredRrp,
        airnode: configuredAirnode,
        sponsorWallet: configuredSponsor,
        currentRaffleId: currentRaffleId.toString(),
        masterXLinked: linkedRaffle.toLowerCase() === raffleAddress.toLowerCase(),
        masterXSatellite: isSatellite,
        dailyAppRaffleRole: hasRoleAfter
    };
    console.log(JSON.stringify(result, null, 2));

    if (!result.masterXLinked || !result.masterXSatellite || !result.dailyAppRaffleRole || currentRaffleId === 0n) {
        throw new Error('Raffle cutover verification failed');
    }
}

main().catch((error) => {
    console.error(error.shortMessage || error.message);
    process.exit(1);
});
