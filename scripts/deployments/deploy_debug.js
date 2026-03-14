/**
 * DEBUG Deployment Script - Step 4 (RRP Address Swap)
 */

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("\n🔍 Starting Debug Deployment - Step 4 (RRP Address Swap)");

    const normalize = (addr) => {
        if (!addr) return null;
        return hre.ethers.getAddress(addr.toLowerCase());
    };

    const masterAddr = normalize("0xB4687705Df686b07aB9b986a6DC46d41a2432b1E");

    // Testing the alternative V1/V2 address common for Base Sepolia
    const AIRNODE_RRP_ALT = normalize("0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd");

    const RaffleDebug = await hre.ethers.getContractFactory("CryptoDiscoRaffleDebug");

    console.log(`\n📊 Simulating Deployment with ${AIRNODE_RRP_ALT}...`);
    try {
        const deployTx = await RaffleDebug.getDeployTransaction(masterAddr, AIRNODE_RRP_ALT);
        const gasEstimate = await hre.ethers.provider.estimateGas(deployTx);
        console.log("✅ Simulation Successful with Alternative Address!");
        console.log("📈 Estimated Gas:", gasEstimate.toString());
    } catch (error) {
        console.error("❌ Simulation Failed (Even with Alternative Address)");
        console.error(error.message);
        process.exit(1);
    }
}

main().catch((error) => {
    process.exit(1);
});
