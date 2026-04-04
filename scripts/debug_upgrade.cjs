const hre = require("hardhat");
const { expect } = require("chai");

async function main() {
    console.log("Setting up fork...");
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
            {
                forking: {
                    jsonRpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
                },
            },
        ],
    });

    const account = "0x52260C30697674A7C837feb2Af21BbF3606795C8";
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [account],
    });

    const signer = await hre.ethers.getSigner(account);
    const masterXAddr = process.env.MASTER_X_ADDRESS;
    console.log("MasterX:", masterXAddr);

    // Call upgradeTier
    const masterX = new hre.ethers.Contract(
        masterXAddr,
        [
            "function upgradeTier() external payable",
        ],
        signer
    );

    console.log("Simulating upgradeTier...");
    try {
        await masterX.upgradeTier({ value: 0 });
        console.log("Success!");
    } catch (e) {
        console.log("Reverted! Reason:", e.message);
        console.log("Data:", e.data);
    }
}

main().catch(console.error);
