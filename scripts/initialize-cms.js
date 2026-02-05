const hre = require("hardhat");

/**
 * Initialize ContentCMSV2 contract with default data
 * Run this after deploying the CMS contract
 */
async function main() {
    const CMS_CONTRACT_ADDRESS = process.env.VITE_CMS_CONTRACT_ADDRESS;

    if (!CMS_CONTRACT_ADDRESS) {
        console.error("❌ VITE_CMS_CONTRACT_ADDRESS not set in .env file");
        process.exit(1);
    }

    console.log("🚀 Initializing ContentCMSV2 with default data...\n");
    console.log("📝 Contract Address:", CMS_CONTRACT_ADDRESS);

    const [deployer] = await hre.ethers.getSigners();
    console.log("👤 Using account:", deployer.address, "\n");

    // Get contract instance
    const ContentCMS = await hre.ethers.getContractAt("ContentCMSV2", CMS_CONTRACT_ADDRESS);

    // Verify deployer has admin role
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const hasAdminRole = await ContentCMS.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    console.log("🔑 Deployer has admin role:", hasAdminRole);

    // Default feature cards data
    const defaultFeatureCards = [
        {
            title: "Daily Tasks",
            description: "Complete simple social tasks to earn points. Follow us on X, join our Farcaster channel, and more.",
            icon: "Sparkles",
            color: "indigo",
            link: "/tasks",
            linkText: "Start Earning →",
            visible: true
        },
        {
            title: "NFT Raffles",
            description: "Get your premium NFTs, Cash reward & many more. Powered by API3 QRNG true quantum randomness.",
            icon: "Ticket",
            color: "purple",
            link: "/raffles",
            linkText: "Browse Raffles →",
            badge: "Verified",
            visible: true
        },
        {
            title: "Your Profile",
            description: "Track your points, view your raffle history, and claim your winnings.",
            icon: "User",
            color: "green",
            link: "/profile",
            linkText: "View Profile →",
            visible: true
        },
        {
            title: "Leaderboard",
            description: "See who's winning the most raffles and earning the most points in our community.",
            icon: "Trophy",
            color: "yellow",
            link: "/leaderboard",
            linkText: "View Rankings →",
            visible: true
        },
        {
            title: "How It Works",
            description: "Connect wallet → Complete tasks → Enter raffles → Win prizes!",
            icon: "TrendingUp",
            color: "indigo",
            link: "#",
            visible: true
        },
        {
            title: "Community Stats",
            description: "Join thousands of users earning rewards daily through our platform.",
            icon: "Shield",
            color: "blue",
            link: "#",
            visible: true
        }
    ];

    // Default news items
    const defaultNews = [
        {
            id: 1,
            title: "Welcome to Disco Gacha!",
            message: "Start earning points by completing daily tasks and entering NFT raffles.",
            date: new Date().toISOString(),
            type: "info"
        },
        {
            id: 2,
            title: "Quantum Randomness Powered",
            message: "All raffles use API3 QRNG for true quantum randomness - completely fair and transparent!",
            date: new Date().toISOString(),
            type: "success"
        },
        {
            id: 3,
            title: "No-Riba Principle",
            message: "Our SBT Community Pool operates on Islamic finance principles - locked and distributed on-chain.",
            date: new Date().toISOString(),
            type: "info"
        }
    ];

    // Default announcement
    const defaultAnnouncement = {
        visible: false,
        title: "Welcome to Disco Gacha!",
        message: "Complete daily tasks, earn points, and win premium NFTs through our quantum-powered raffle system.",
        type: "info"
    };

    // Use batch update to save gas!
    console.log("📦 Batch updating all content (saves ~60% gas)...");
    const batchTx = await ContentCMS.batchUpdate(
        JSON.stringify(defaultAnnouncement),
        JSON.stringify(defaultNews),
        JSON.stringify(defaultFeatureCards)
    );
    await batchTx.wait();
    console.log("✅ All content updated! TX:", batchTx.hash);

    console.log("\n🎉 Initialization complete!");
    console.log("🔗 View contract on BaseScan: https://sepolia.basescan.org/address/" + CMS_CONTRACT_ADDRESS);
    console.log("\n📌 Next steps:");
    console.log("1. Restart your frontend: cd Raffle_Frontend && npm run dev");
    console.log("2. Visit /admin to manage content and roles");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
