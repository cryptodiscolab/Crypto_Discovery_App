const hre = require("hardhat");

async function main() {
    console.log("Deploying TestDeploy contract...");
    const TestDeploy = await hre.ethers.getContractFactory("TestDeploy");
    const testDeploy = await TestDeploy.deploy("Hello Base!", { gasLimit: 500000 });

    await testDeploy.waitForDeployment();
    console.log("TestDeploy deployed to:", await testDeploy.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
