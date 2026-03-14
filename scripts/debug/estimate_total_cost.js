const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const DEPLOYER_ADDRESS = deployer ? deployer.address : "0x0000000000000000000000000000000000000002";
    const provider = hre.ethers.provider;

    // Addresses from .env or standard placeholders
    const OPS_WALLET = "0x73F76B2b436E2E50bB6F81A6e33a42875f1cDff3";
    const TREASURY_WALLET = "0xAfB7C7E711418EFD744f74B4D92c2b91B9668fAa";
    const AIRNODE_RRP = "0x2ab9f26E18b6103274414940251539D0105e2Add";
    const PRICE_FEED = "0x4adC67696BA383f43fd60604633031D935f9584b";
    const CREATOR_TOKEN = "0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c";
    const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

    process.stdout.write("\n=== GAS ESTIMATION REPORT ===\n");

    const contracts = [
        {
            name: "CryptoDiscoMasterX",
            factory: "CryptoDiscoMasterX",
            args: [OPS_WALLET, TREASURY_WALLET, PRICE_FEED]
        },
        {
            name: "CryptoDiscoRaffle",
            factory: "CryptoDiscoRaffle",
            args: [hre.ethers.ZeroAddress, AIRNODE_RRP] // Placeholder for MasterX
        },
        {
            name: "DailyAppV12Secured",
            factory: "DailyAppV12Secured",
            args: [CREATOR_TOKEN, USDC, DEPLOYER_ADDRESS]
        }
    ];

    let totalGas = 0n;

    for (const contract of contracts) {
        try {
            const Factory = await hre.ethers.getContractFactory(contract.factory);
            const deployTx = await Factory.getDeployTransaction(...contract.args);
            const gas = await provider.estimateGas(deployTx);
            console.log(`${contract.name}: ${gas.toString()} units`);
            totalGas += gas;
        } catch (e) {
            console.log(`${contract.name}: Estimation FAILED - ${e.message.split('\n')[0]}`);
        }
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 100000000n; // 0.1 gwei fallback

    const totalCostWei = totalGas * gasPrice;
    const totalCostEth = hre.ethers.formatEther(totalCostWei);

    console.log("\n--- Totals ---");
    console.log(`Total Gas Units: ${totalGas.toString()}`);
    console.log(`Current Gas Price: ${hre.ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`Total ETH Required: ${totalCostEth} ETH`);
}

main().catch(console.error);
