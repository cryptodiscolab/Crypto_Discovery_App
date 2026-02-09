/**
 * seed_tasks_v3.js - Seed Pinned Daily Tasks & Sponsorship Cards for DailyApp V3
 */
require("dotenv").config();
const hre = require("hardhat");

async function main() {
    console.log("\n🌱 Seeding Pinned Daily Tasks & Sponsorship Cards to DailyApp V3...");

    const DAILY_APP_ADDRESS = process.env.NEXT_PUBLIC_DAILY_APP_ADDRESS || "0x9BdE662649A9C080E96086f70Ed2e5BDa091E653";
    console.log(`📍 DailyApp Address: ${DAILY_APP_ADDRESS}`);

    const DailyApp = await hre.ethers.getContractAt("DailyApp", DAILY_APP_ADDRESS);

    // 1. Seed Pinned Daily Tasks (Admin-only list)
    console.log("\n📌 Seeding Pinned Daily Tasks...");
    const dailyTasks = [
        { desc: "Complete Daily Check-in", points: 50 },
        { desc: "Explore Featured Gacha", points: 100 }
    ];

    for (const task of dailyTasks) {
        console.log(`Creating daily task: ${task.desc}...`);
        try {
            const tx = await DailyApp.createDailyTask(task.desc, task.points);
            await tx.wait();
            console.log("✅ Daily task created.");
        } catch (error) {
            console.error(`❌ ERROR: ${error.message}`);
        }
    }

    // 2. Seed Sponsorship Cards (Grouped list)
    console.log("\n🏢 Seeding Sponsorship Cards...");
    const sponsorships = [
        {
            name: "Warpcast Mini",
            tasks: [
                { desc: "Follow @cryptodisco", points: 100 },
                { desc: "Recast Daily Announcement", points: 150 },
                { desc: "Link Wallet to FID", points: 250 }
            ]
        },
        {
            name: "Base Ecosystem",
            tasks: [
                { desc: "Bridge to Base Sepolia", points: 500 },
                { desc: "Mint Discovery NFT", points: 1000 }
            ]
        }
    ];

    for (const sponsor of sponsorships) {
        console.log(`\n🔹 Creating Sponsor: ${sponsor.name}...`);
        const descs = sponsor.tasks.map(t => t.desc);
        const points = sponsor.tasks.map(t => t.points);

        try {
            const tx = await DailyApp.createSponsorship(sponsor.name, descs, points);
            console.log(`⏳ TX: ${tx.hash}`);
            await tx.wait();
            console.log("✅ Sponsorship created.");
        } catch (error) {
            console.error(`❌ ERROR: ${error.message}`);
        }
    }

    console.log("\n🏁 Seeding complete! Verify on http://localhost:3000");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
