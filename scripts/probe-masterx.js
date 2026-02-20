const { ethers } = require("hardhat");

async function main() {
    const MASTER_X = "0xf074b0457d5c092bb67e62734B13C5f4cBC69e89";

    // ABI minimal hanya fungsi yang PASTI ada di kontrak lama
    const ABI_PROBE = [
        "function totalSBTPoolBalance() view returns (uint256)",
        "function totalLockedRewards() view returns (uint256)",
        "function goldHolders() view returns (uint32)",
        "function silverHolders() view returns (uint32)",
        "function bronzeHolders() view returns (uint32)",
        "function lastDistributeTimestamp() view returns (uint256)",
        // Fungsi baru (mungkin tidak ada di deployed contract)
        "function diamondHolders() view returns (uint32)",
        "function platinumHolders() view returns (uint32)",
        "function accRewardPerShare(uint8) view returns (uint256)",
    ];

    const provider = ethers.provider;
    const contract = new ethers.Contract(MASTER_X, ABI_PROBE, provider);

    console.log("🔍 Probing deployed CryptoDiscoMasterX:", MASTER_X);
    console.log("─────────────────────────────────────────");

    const tests = [
        ["totalSBTPoolBalance()", () => contract.totalSBTPoolBalance()],
        ["totalLockedRewards()", () => contract.totalLockedRewards()],
        ["goldHolders()", () => contract.goldHolders()],
        ["silverHolders()", () => contract.silverHolders()],
        ["bronzeHolders()", () => contract.bronzeHolders()],
        ["diamondHolders()", () => contract.diamondHolders()],
        ["platinumHolders()", () => contract.platinumHolders()],
        ["lastDistributeTimestamp()", () => contract.lastDistributeTimestamp()],
        ["accRewardPerShare(1) BRONZE", () => contract.accRewardPerShare(1)],
        ["accRewardPerShare(2) SILVER/GOLD", () => contract.accRewardPerShare(2)],
        ["accRewardPerShare(3) GOLD/PLAT", () => contract.accRewardPerShare(3)],
        ["accRewardPerShare(4) DIAMOND/PLAT", () => contract.accRewardPerShare(4)],
    ];

    for (const [name, fn] of tests) {
        try {
            const result = await fn();
            console.log(`  ✅ ${name} = ${result.toString()}`);
        } catch (err) {
            console.log(`  ❌ ${name} → FAILED: ${err.message.slice(0, 80)}`);
        }
    }

    console.log("\n✅ Probe selesai.");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Fatal:", err.message);
        process.exit(1);
    });
