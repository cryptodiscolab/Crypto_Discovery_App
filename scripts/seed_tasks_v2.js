/**
 * seed_tasks_v2.js - Seed Sponsorship Cards for DailyApp V2
 */
require("dotenv").config();
const hre = require("hardhat");

async function main() {
    console.log("\n🌱 Seeding Sponsorship Cards to DailyApp V2...");

    const DAILY_APP_ADDRESS = process.env.NEXT_PUBLIC_DAILY_APP_ADDRESS || "0x537c6a27b636FEB1a81cDF8fD777B1BB54653A71";
    console.log(`📍 DailyApp Address: ${DAILY_APP_ADDRESS}`);

    const DailyApp = await hre.ethers.getContractAt("DailyApp", DAILY_APP_ADDRESS);

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
