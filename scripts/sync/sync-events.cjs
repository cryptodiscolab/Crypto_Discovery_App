/**
 * sync-events.js
 * ============================================================
 * Real-time On-Chain → Supabase Event Listener
 * Mendengarkan event TaskCompleted (DailyApp) dan PointsAwarded (MasterX)
 * lalu menyinkronkan XP ke Supabase.
 *
 * Jalankan: node scripts/sync-events.js
 * Atau jadwalkan dengan PM2: pm2 start scripts/sync-events.js --name "disco-sync"
 * ============================================================
 */

require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

// --- CONFIG ---
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
// ✅ Address baru pasca-redeploy (punya PLATINUM + DIAMOND tier)
const MASTER_X_ADDR = process.env.MASTER_X_ADDRESS || "0x980770dAcE8f13E10632D3EC1410FAA4c707076c";
const DAILY_APP_ADDR = process.env.DAILY_APP_ADDRESS || "0xfc12f4FEFf825860c5145680bde38BF222cC669A";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ABIs (minimal, hanya event yang dibutuhkan) ---
const MASTER_X_ABI = [
    "event PointsAwarded(address indexed user, uint256 points, string reason)",
];

const DAILY_APP_ABI = [
    "event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp)",
    "event NFTMinted(address indexed user, uint8 tier, uint256 tokenId)",
    "event NFTUpgraded(address indexed user, uint8 oldTier, uint8 newTier)",
    "function nftConfigs(uint256 tier) view returns (uint256, uint256, uint256, uint256, uint256, uint256, bool)",
];

// --- UUID Helper (deterministik dari tx hash + log index) ---
function generateUUID(seed) {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
    return [
        hash.slice(2, 10),
        hash.slice(10, 14),
        hash.slice(14, 18),
        hash.slice(18, 22),
        hash.slice(22, 34),
    ].join("-");
}

// --- Supabase Upsert Helper ---
async function upsertClaim({ id, wallet_address, task_id, xp_earned, claimed_at, tx_hash, source }) {
    const { error } = await supabase
        .from("user_task_claims")
        .upsert(
            { id, wallet_address, task_id, xp_earned, claimed_at, tx_hash, source },
            { onConflict: "id" }
        );

    if (error) {
        console.error(`❌ Supabase upsert gagal [${source}] wallet=${wallet_address}:`, error.message);
    } else {
        console.log(`✅ [${source}] Synced ${xp_earned} XP untuk ${wallet_address}`);
    }
}

// --- Main Listener ---
async function main() {
    // Gunakan WebSocket provider untuk real-time events
    const provider = new ethers.WebSocketProvider(
        RPC_URL.replace("https://", "wss://").replace("/v2/", "/v2/")
    );

    const masterXContract = new ethers.Contract(MASTER_X_ADDR, MASTER_X_ABI, provider);
    const dailyAppContract = new ethers.Contract(DAILY_APP_ADDR, DAILY_APP_ABI, provider);

    console.log("🎧 Event listener aktif...");
    console.log(`   MasterX   : ${MASTER_X_ADDR}`);
    console.log(`   DailyApp  : ${DAILY_APP_ADDR}`);
    console.log(`   Network   : ${RPC_URL}`);
    console.log("─────────────────────────────────────────");

    // ── Listener 1: PointsAwarded (MasterX) ──────────────────────────────────
    masterXContract.on("PointsAwarded", async (user, points, reason, event) => {
        const wallet = user.toLowerCase();
        const xp = Number(points);
        const txHash = event.log.transactionHash;
        const claimId = generateUUID(`MASTERX_${txHash}_${event.log.index}`);
        const claimedAt = new Date().toISOString();

        console.log(`\n📡 [PointsAwarded] ${reason} | ${xp} XP → ${wallet}`);
        console.log(`   TX: ${txHash}`);

        await upsertClaim({
            id: claimId,
            wallet_address: wallet,
            task_id: "12e123f5-0ded-4ca1-af04-e8b6924823e2", // Raffle / MasterX task UUID
            xp_earned: xp,
            claimed_at: claimedAt,
            tx_hash: txHash,
            source: `MasterX:${reason}`,
        });
    });

    // ── Listener 2: TaskCompleted (DailyApp) ─────────────────────────────────
    dailyAppContract.on("TaskCompleted", async (user, taskId, reward, timestamp, event) => {
        const wallet = user.toLowerCase();
        const xp = Number(reward);
        const txHash = event.log.transactionHash;
        const claimId = generateUUID(`DAILYAPP_${txHash}_${event.log.index}`);
        const claimedAt = new Date(Number(timestamp) * 1000).toISOString();

        console.log(`\n📡 [TaskCompleted] Task #${taskId} | ${xp} XP → ${wallet}`);
        console.log(`   TX: ${txHash}`);

        await upsertClaim({
            id: claimId,
            wallet_address: wallet,
            task_id: "885535d2-4c5c-4a80-9af5-36666192c244", // Daily Task UUID
            xp_earned: xp,
            claimed_at: claimedAt,
            tx_hash: txHash,
            source: `DailyApp:task_${taskId}`,
        });
    });

    // ── Listener 3: NFT Tier Events (DailyApp) ────────────────────────────────
    const handleNFTEvent = async (user, tier, event) => {
        const wallet = user.toLowerCase();
        const tierNum = Number(tier);
        const txHash = event.log.transactionHash;
        const claimId = generateUUID(`BURN_${txHash}_${event.log.index}`);
        const claimedAt = new Date().toISOString();

        console.log(`\n🔥 [NFTEvent] Detected tier action for Tier #${tierNum} for ${wallet}`);
        
        try {
            const config = await dailyAppContract.nftConfigs(tierNum);
            const xpToBeBurned = Number(config[0]);

            if (xpToBeBurned > 0) {
                console.log(`   Action: Recording burn of ${xpToBeBurned} XP`);
                await upsertClaim({
                    id: claimId,
                    wallet_address: wallet,
                    task_id: "2c1e23f5-0ded-4ca1-af04-e8b6924823e2", // System: Tier Ascension
                    xp_earned: -xpToBeBurned,
                    claimed_at: claimedAt,
                    tx_hash: txHash,
                    source: `DailyApp:nft_burn_${tierNum}`,
                });
            }
        } catch (err) {
            console.error(`❌ Gagal memproses burn untuk ${wallet}:`, err.message);
        }
    };

    dailyAppContract.on("NFTMinted", (user, tier, tokenId, event) => handleNFTEvent(user, tier, event));
    dailyAppContract.on("NFTUpgraded", (user, oldTier, newTier, event) => handleNFTEvent(user, newTier, event));

    // ── Reconnect on disconnect ───────────────────────────────────────────────
    provider.websocket.on("close", () => {
        console.error("⚠️  WebSocket terputus. Reconnect dalam 5 detik...");
        setTimeout(main, 5000);
    });

    provider.websocket.on("error", (err) => {
        console.error("⚠️  WebSocket error:", err.message);
    });
}

main().catch((err) => {
    console.error("❌ Fatal error sync-events.js:", err);
    process.exit(1);
});
