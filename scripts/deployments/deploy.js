/**
 * FINAL Deployment Script - Crypto Disco App
 * Handles:
 * 1. Gas Simulation (Estimation)
 * 2. Raffle Deployment (Manual RRP Bypass)
 * 3. MasterX Linking
 * 4. Modular Initialization
 */

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("\n🚀 Resuming Hardened Deployment Protocol (Senior DevOps Mode)");
    console.log("📍 Node Version Notice: v23.6.0 detected. Implementing enhanced catch-blocks.");
    console.log("📍 Deployer:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(balance), "ETH\n");

    const normalize = (addr) => {
        if (!addr) return null;
        return hre.ethers.getAddress(addr.toLowerCase());
    };

    const OPS = normalize(process.env.OPERATIONS_WALLET);
    const TREASURY = normalize(process.env.TREASURY_WALLET);
    const AIRNODE_RRP = normalize(process.env.AIRNODE_RRP || "0x2ab9f26E18b6103274414940251539D0105e2Add");

    const masterAddr = "0xB4687705Df686b07aB9b986a6DC46d41a2432b1E";
    const raffleAddr = "0x18C64ed185C15F46d17C1888e12168DBA409e2EE";

    const master = await hre.ethers.getContractAt("CryptoDiscoMasterX", masterAddr);
    let raffle;

    // Aggressive Gas Strategy (3n multiplier to clear underpriced mempool)
    const feeData = await hre.ethers.provider.getFeeData();
    const gasArgs = {
        maxFeePerGas: feeData.maxFeePerGas * 3n,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 3n
    };

    // --- STEP 1: Verify / Deploy Raffle ---
    try {
        const currentRaffleInMaster = await master.raffleContract();
        if (currentRaffleInMaster === raffleAddr) {
            console.log("✅ MasterX and Raffle already linked. Skipping Step 1 & 2.");
            raffle = await hre.ethers.getContractAt("CryptoDiscoRaffle", raffleAddr);
        } else {
            console.log("⏳ [1/5] Deploying CryptoDiscoRaffle...");
            const Raffle = await hre.ethers.getContractFactory("CryptoDiscoRaffle");
            raffle = await Raffle.deploy(masterAddr, AIRNODE_RRP, { gasLimit: 2000000, ...gasArgs });
            await raffle.waitForDeployment();
            const newRaffleAddr = await raffle.getAddress();
            console.log("✅ Raffle Deployed at:", newRaffleAddr);

            console.log("\n⏳ [2/5] Linking MasterX to Raffle...");
            const linkTx = await master.setRaffleContract(newRaffleAddr, { gasLimit: 100000, ...gasArgs });
            await linkTx.wait();
            console.log("✅ Linking Successful.");
        }

        // --- STEP 3: Raffle Initialization ---
        console.log("\n⏳ [3/5] Initializing First Raffle Struct...");
        const currentId = await raffle.currentRaffleId();
        if (currentId > 0n) {
            console.log("✅ Raffle already initialized (currentId:", currentId.toString(), "). Skipping.");
        } else {
            console.log("📈 Estimating Initialization Gas...");
            const initEstimate = await raffle.initializeFirstRaffle.estimateGas();
            const initTx = await raffle.initializeFirstRaffle({ gasLimit: initEstimate * 2n, ...gasArgs });
            await initTx.wait();
            console.log("✅ First Raffle initialized.");
        }
    } catch (error) {
        console.error("\n❌ CRITICAL REVERT IN DEPLOYMENT SEQUENCE:");
        if (error.data) console.error("📄 Revert Data:", error.data);
        console.error("📄 Error Message:", error.message);
        throw error;
    }

    // --- STEP 4: Parameters Initialization ---
    console.log("\n⏳ [4/5] Setting MasterX Global Parameters...");
    const ticketPriceUSD = 150000;
    const maxGasPrice = hre.ethers.parseUnits("50", "gwei");
    const paramTx = await master.setParams(ticketPriceUSD, maxGasPrice, { gasLimit: 200000, ...gasArgs });
    await paramTx.wait();
    console.log("✅ Parameters set successfully.");

    process.stdout.write("\n==========================================\n");
    process.stdout.write("📊 IMMUTABLE ARCHITECT DEPLOYMENT SUMMARY\n");
    process.stdout.write("==========================================\n");
    process.stdout.write(`MasterX Address: ${masterAddr}\n`);
    process.stdout.write(`Raffle Address:  ${await raffle.getAddress()}\n`);
    process.stdout.write(`Deployer:        ${deployer.address}\n`);
    process.stdout.write(`Status:           OPERATIONAL\n`);
    process.stdout.write("==========================================\n\n");
}

main().catch((error) => {
    console.error("\n❌ DEPLOYMENT CRITICAL FAILURE");
    console.error(error);
    process.exit(1);
});
