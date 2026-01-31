const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer address:", deployer.address);
    console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");

    const airnodeRrpAddress = "0xa0ad79d995ddeeb18a14ed70915976d439324d21";
    const NFTRaffle = await hre.ethers.getContractFactory("NFTRaffle");

    try {
        console.log("Estimating gas for deployment...");
        const deploymentData = NFTRaffle.getDeployTransaction(airnodeRrpAddress);
        const gasEstimate = await hre.ethers.provider.estimateGas(deploymentData);
        console.log("Gas estimate:", gasEstimate.toString());
    } catch (error) {
        console.error("Gas estimation failed!");
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
