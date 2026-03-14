const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    // 1. Deploy Mock Airnode RRP first (to satisfy constructor check)
    const MockAirnodeRrpFactory = await hre.ethers.getContractFactory("MockAirnodeRrp");
    const mockAirnodeRrp = await MockAirnodeRrpFactory.deploy();
    await mockAirnodeRrp.waitForDeployment();
    const AIRNODE_RRP = mockAirnodeRrp.target;

    const OPERATIONS_WALLET = deployer.address;
    const TREASURY_WALLET = deployer.address;
    const PRICE_FEED = "0x0000000000000000000000000000000000000001"; // Price feed doesn't have constructor check

    const CryptoDiscoMaster = await hre.ethers.getContractFactory("CryptoDiscoMaster");

    // Create deployment transaction
    const deploymentTx = await CryptoDiscoMaster.getDeployTransaction(
        OPERATIONS_WALLET,
        TREASURY_WALLET,
        AIRNODE_RRP,
        PRICE_FEED
    );

    const estimatedGas = await hre.ethers.provider.estimateGas(deploymentTx);
    const bytecodeLength = (deploymentTx.data.length - 2) / 2;

    console.log("Estimated Gas Limit:", estimatedGas.toString());
    console.log("Bytecode Size (bytes):", bytecodeLength);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
