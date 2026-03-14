const hre = require("hardhat");

async function main() {
    console.log("Starting deployment...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Addresses - LOADED FROM .ENV
    // We use the exact keys found in your .env file
    const OPERATIONS_WALLET = process.env.OPERATIONS_WALLET || deployer.address;
    const TREASURY_WALLET = process.env.TREASURY_WALLET || deployer.address;
    const AIRNODE_RRP = process.env.AIRNODE_RRP || "0x2ab9f26E18b6103274414940251539D0105e2Add";
    const PRICE_FEED = process.env.PRICE_FEED_ETH_USD || "0x4aDC43E4F3841847BB1479f4a079CF294975267D";

    console.log("Deploying CryptoDiscoMaster...");
    console.log("Ops Wallet:", OPERATIONS_WALLET);
    console.log("Treasury Wallet:", TREASURY_WALLET);
    console.log("Airnode RRP:", AIRNODE_RRP);
    console.log("Price Feed:", PRICE_FEED);

    const CryptoDiscoMaster = await hre.ethers.getContractFactory("CryptoDiscoMaster");
    const contract = await CryptoDiscoMaster.deploy(
        OPERATIONS_WALLET,
        TREASURY_WALLET,
        AIRNODE_RRP,
        PRICE_FEED
    );

    await contract.waitForDeployment();

    console.log("CryptoDiscoMaster deployed to:", contract.target);

    // Verify instructions
    console.log("\nTo verify on Etherscan:");
    console.log(`npx hardhat verify --network <network> ${contract.target} "${OPERATIONS_WALLET}" "${TREASURY_WALLET}" "${AIRNODE_RRP}" "${PRICE_FEED}"`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
