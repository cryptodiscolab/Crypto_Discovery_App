import { handleDailyClaim } from './src/dailyAppLogic.js';

/**
 * TEST SCRIPT: Memastikan logic daily claim jalan di terminal
 * Cara Jalanin: npx vite-node test-claim.js
 */
async function runTest() {
    const FID_GUE = 1477344;

    console.log("-----------------------------------------");
    console.log("🛠️  MEMULAI TEST DAILY CLAIM...");
    console.log(`👤 FID: ${FID_GUE}`);
    console.log("-----------------------------------------");

    try {
        const result = await handleDailyClaim(FID_GUE);

        if (result.success) {
            console.log("✅ BERHASIL!");
            console.log(`💬 Message: ${result.message}`);
            console.log("📊 Stats Baru:", JSON.stringify(result.data, null, 2));
            console.log("-----------------------------------------");
            console.log("🚀 Cek dashboard Supabase lu, XP harusnya nambah jadi 10!");
        } else {
            console.log("❌ GAGAL!");
            console.log(`Reason: ${result.message || result.error}`);
        }
    } catch (error) {
        console.error("💥 SYSTEM ERROR:", error.message);
    }
}

runTest();
