const { ethers } = require("ethers");
const { Telegraf } = require("telegraf");
require("dotenv").config();

// 1. Configuration from .env
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const CONTRACT_ADDRESS = "0xd7f6d4589A04F51D22B3a5965860EB40fb219c78";
const SPONSOR_WALLET = "0x7186e5D35f126c3C809670F567b594582f3C7d61";
const BALANCE_THRESHOLD = ethers.parseEther("0.005");

// 2. Minimal ABI for the events we need
const ABI = [
    "event QRNGRequested(bytes32 indexed requestId, uint256 indexed raffleId)",
    "event QRNGFulfilled(bytes32 indexed requestId, uint256 randomNumber)"
];

async function main() {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.error("❌ MISSING CONFIG: Please set TELEGRAM_BOT_TOKEN and CHAT_ID in your .env file.");
        process.exit(1);
    }

    console.log("==================================================");
    console.log("🤖 CryptoDisco Monitor Bot Started");
    console.log(`📍 RPC: ${RPC_URL}`);
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`📊 Sponsor: ${SPONSOR_WALLET}`);
    console.log("==================================================\n");

    const bot = new Telegraf(BOT_TOKEN);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // Helper: Send Message to Telegram
    const notify = async (message) => {
        try {
            await bot.telegram.sendMessage(CHAT_ID, message, { parse_mode: "Markdown" });
            console.log(`📤 Notification Sent: ${message.replace(/\n/g, " ")}`);
        } catch (err) {
            console.error("❌ Failed to send Telegram notification:", err.message);
        }
    };

    // 3. Monitor Contract Events
    console.log("🔦 Monitoring Events...");

    contract.on("QRNGRequested", (requestId, raffleId) => {
        const msg = `🎲 *Raffle Dimulai!* (ID: ${raffleId})\nMenunggu angka acak dari API3 QRNG...\n\n🔗 [View Request](https://sepolia.basescan.org/address/${CONTRACT_ADDRESS})`;
        notify(msg);
    });

    contract.on("QRNGFulfilled", (requestId, randomNumber) => {
        const msg = "✅ *Angka Acak Diterima!*\nPemenang sudah ditentukan!\n\nCheck results on the app or Basescan.";
        notify(msg);
    });

    // 4. Monitor Sponsor Wallet Balance (Poll every 10 minutes)
    const checkBalance = async () => {
        try {
            const balance = await provider.getBalance(SPONSOR_WALLET);
            console.log(`📡 Current Sponsor Balance: ${ethers.formatEther(balance)} ETH`);

            if (balance < BALANCE_THRESHOLD) {
                const msg = `⚠️ *Saldo Sponsor Tipis!*\n\nCurrent Balance: \`${ethers.formatEther(balance)}\` ETH\nThreshold: \`0.005\` ETH\n\nSegera isi bensin agar raffle tetap jalan!`;
                notify(msg);
            }
        } catch (err) {
            console.error("❌ Error checking balance:", err.message);
        }
    };

    // Initial check and set interval (600,000 ms = 10 mins)
    checkBalance();
    setInterval(checkBalance, 10 * 60 * 1000);

    // 5. Bot Launch
    bot.launch();
    console.log("🚀 Bot is listening for events and balance...\n");

    // Enable graceful stop
    process.once("SIGINT", () => {
        bot.stop("SIGINT");
        console.log("\n👋 Bot stopped.");
        process.exit(0);
    });
    process.once("SIGTERM", () => {
        bot.stop("SIGTERM");
        process.exit(0);
    });
}

main().catch((err) => {
    console.error("🔥 Monitor Bot Error:", err);
});
