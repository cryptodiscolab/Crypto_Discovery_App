/**
 * seed_tasks.js - Seed initial tasks for DailyApp
 */
require("dotenv").config();
const hre = require("hardhat");

async function main() {
    console.log("\n🌱 Seeding initial tasks to DailyApp...");

    const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS;
    if (!DAILY_APP_ADDRESS) {
        console.error("❌ ERROR: DAILY_APP_ADDRESS not found in .env");
        process.exit(1);
    }

    console.log(`📍 DailyApp Address: ${DAILY_APP_ADDRESS}`);

    let DailyApp;
    try {
        DailyApp = await hre.ethers.getContractAt("DailyApp", DAILY_APP_ADDRESS);
        console.log("✅ Contract instance retrieved.");
    } catch (e) {
        console.error(`❌ ERROR: Failed to get contract instance: ${e.message}`);
        process.exit(1);
    }

    const tasks = [
        { desc: "Follow Crypto Disco on Warpcast", points: 100 },
        { desc: "Share your Daily Gacha result", points: 250 },
        { desc: "Verify Onchain Identity", points: 500 }
    ];

    for (const task of tasks) {
        console.log(`\n🔹 Creating task: ${task.desc} (${task.points} pts)...`);
        try {
            // Check if we are the owner
            const owner = await DailyApp.owner();
            const signer = (await hre.ethers.getSigners())[0];
            console.log(`👤 Current Signer: ${signer.address}`);
            console.log(`👑 Contract Owner: ${owner}`);

            if (signer.address.toLowerCase() !== owner.toLowerCase()) {
                console.warn("⚠️ Signer is NOT the owner. This will likely fail.");
            }

            const tx = await DailyApp.createTask(task.desc, task.points);
            console.log(`⏳ Transaction sent: ${tx.hash}`);
            await tx.wait();
            console.log("✅ Task created successfully.");
        } catch (error) {
            console.error(`❌ ERROR creating task: ${error.message}`);
        }
    }

    console.log("\n🏁 Seeding complete! Refresh your frontend to see the tasks.");
}

main().catch((error) => {
    console.error("❌ UNCAUGHT ERROR:");
    console.error(error);
    process.exit(1);
});
