/**
 * LURAH EKOSISTEM (Autonomous Agent)
 * Cron Job: Memantau kesehatan ekosistem berdasarkan .cursorrules & .agent skills.
 * 
 * Lokasi: verification-server/api/cron/lurah-ekosistem.js
 */

const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY; // Free Tier Google AI
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

const { exec } = require('child_process');
const path = require('path');

module.exports = async (req, res) => {
    console.log('🤖 [Lurah Ekosistem] Starting daily audit & tier recalculation...');

    // 0. Trigger Tier Calculation (Dynamic Tiers v3.7.0)
    try {
        console.log('📈 Recalculating Dynamic Tier Percentiles...');
        // We run it as a separate process to maintain ESM/CJS compatibility in this environment
        const scriptPath = path.join(process.cwd(), '.agents', 'scripts', 'tier-calculator.js');
        exec(`node ${scriptPath}`, (error, stdout, stderr) => {
            if (error) console.error(`❌ Tier Calculation Error: ${error.message}`);
            if (stdout) console.log(`📊 Tier Calculation Output: ${stdout}`);
        });
    } catch (tierErr) {
        console.error('❌ Failed to trigger tier calculation:', tierErr.message);
    }

    try {
        // 0. Ambil Audit Settings Dinamis (Centralized Control)
        const { data: settingsData } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'audit_settings')
            .maybeSingle(); // v3.42.2: setting row may not exist yet

        const auditSettings = settingsData?.value || {
            xp_anomaly_threshold: 5000,
            sybil_lookback_days: 7,
            sybil_wallet_threshold: 1,
            audit_interval_hours: 24,
            telegram_notifications: true,
            ai_model: "gemini-2.0-flash"
        };

        // 1. Ambil Peraturan (Knowledge) dari Vault
        const { data: vault } = await supabase
            .from('agent_vault')
            .select('file_path, content, category');

        const protocols = vault.filter(v => v.category === 'protocol').map(v => v.content).join('\n\n');
        const skills = vault.filter(v => v.category === 'skill').map(v => v.content).join('\n\n');

        // 2. Ambil Data Real-time untuk di-audit
        const intervalMs = (auditSettings.audit_interval_hours || 24) * 60 * 60 * 1000;
        const lookbackDate = new Date(Date.now() - intervalMs).toISOString();

        // A. Cek User baru
        const { data: newUsers } = await supabase
            .from('user_profiles')
            .select('wallet_address, display_name, pfp_url, total_xp, last_seen_at')
            .gt('last_seen_at', lookbackDate);

        // B. Cek Anomali XP 
        const { data: anomalies } = await supabase
            .from('user_task_claims')
            .select('wallet_address, xp_earned, task_id')
            .gt('claimed_at', lookbackDate)
            .gt('xp_earned', auditSettings.xp_anomaly_threshold || 5000);

        // C. Cek Sybil Attacks (Satu akun sosial diklaim banyak wallet)
        const sybilLookbackDate = new Date(Date.now() - (auditSettings.sybil_lookback_days || 7) * 24 * 60 * 60 * 1000).toISOString();
        const { data: claimsForSybil } = await supabase
            .from('user_task_claims')
            .select('wallet_address, target_id, platform')
            .not('target_id', 'is', 'null')
            .gt('claimed_at', sybilLookbackDate);

        const targetMap = {};
        claimsForSybil?.forEach(c => {
            if (!targetMap[c.target_id]) targetMap[c.target_id] = new Set();
            targetMap[c.target_id].add(c.wallet_address);
        });

        const sybilSuspects = Object.entries(targetMap)
            .filter(([_, wallets]) => wallets.size > (auditSettings.sybil_wallet_threshold || 1))
            .map(([target, wallets]) => ({
                target_id: target,
                wallet_count: wallets.size,
                wallets: Array.from(wallets)
            }));

        // D. Cek Multi-Account (1 Wallet klaim banyak akun sosial di platform yg sama)
        const walletPlatformMap = {};
        claimsForSybil?.forEach(c => {
            const key = `${c.wallet_address}_${c.platform}`;
            if (!walletPlatformMap[key]) walletPlatformMap[key] = new Set();
            walletPlatformMap[key].add(c.target_id);
        });

        const multiAccountSuspects = Object.entries(walletPlatformMap)
            .filter(([_, targets]) => targets.size > 1)
            .map(([key, targets]) => {
                const [wallet, platform] = key.split('_');
                return {
                    wallet_address: wallet,
                    platform: platform,
                    account_count: targets.size,
                    target_ids: Array.from(targets)
                };
            });

        // 3. Gunakan Otak AI untuk Analisa
        const prompt = `
            Kamu adalah "Lurah Ekosistem", Agen Otonom untuk Crypto Disco App.
            Tugasmu adalah mengaudit data berdasarkan protokol berikut:
            
            PROTOKOL ARSITEKTUR:
            ${protocols || 'Tidak ada protokol terdefinisi.'}
            
            KEAHLIAN SENTINEL:
            ${skills || 'Tidak ada skill terdefinisi.'}
            
            DATA AUDIT (TEMUAN TERBARU):
            - User Baru (24h): ${JSON.stringify(newUsers || [])}
            - Potensi Anomali XP (24h): ${JSON.stringify(anomalies || [])}
            - Potensi Sybil Target Mismatched (1 Akun Sosial dipakai banyak Wallet): ${JSON.stringify(sybilSuspects || [])}
            - Potensi Multi-Account (1 Wallet pakai banyak Akun Sosial): ${JSON.stringify(multiAccountSuspects || [])}
            
            ATURAN EMAS (1:1 MAPPING RULE): 1 Wallet HANYA boleh terikat pada 1 Akun Social Media per platform. Pelanggaran terhadap aturan ini adalah MUTLAK FRAUD.
            **PERHATIAN KHUSUS TIKTOK & INSTAGRAM**: Terapkan pengawasan super ketat (strict 1:1) untuk eksploitasi di platform TikTok dan Instagram karena ini adalah platform baru.
            
            Berikan laporan ringkas (Bahasa Indonesia) dengan format berikut:
            1. Ringkasan kesehatan ekosistem (dalam bentuk Tabel ASCII jika ada data statistik).
            2. Daftar potensi Pelanggaran 1:1 Mapping atau anomali (dalam bentuk Tabel ASCII). Sertakan wallet dan target_id yang mencurigakan.
            3. Rekomendasi tindakan mitigasi cerdas (misal: "Siapkan script blacklist untuk wallet X, Y, Z karena indikasi pelanggaran aturan 1:1 Mapping pada TikTok ID 12345").
            
            Gunakan blok kode (backticks) untuk tabel agar terlihat rapi di Telegram (monospaced).
        `;

        let aiResponse = "AI Analysis not available.";
        const modelId = auditSettings.ai_model || "gemini-2.0-flash";
        const geminiResult = await callGeminiWithFallback(modelId, prompt);
        
        if (geminiResult.error) {
            console.error('❌ [Lurah Ekosistem] Gemini API Error:', geminiResult.error);
            aiResponse = `Analisa AI tertunda (Error: ${geminiResult.error})`;
        } else if (geminiResult.success) {
            aiResponse = geminiResult.text;
        }

        // 4. Kirim Notifikasi Telegram (Jika diizinkan)
        if (auditSettings.telegram_notifications && telegramBotToken && telegramChatId) {
            const message = `🚨 *LAPORAN LURAH EKOSISTEM*\n\n${aiResponse}`;
            try {
                const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramChatId,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                });
                const tgResult = await tgRes.json();

                if (!tgResult.ok) {
                    // Fallback: Send as plain text if Markdown fails
                    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: telegramChatId,
                            text: `🚨 LAPORAN LURAH EKOSISTEM (Plain Text)\n\n${aiResponse}`
                        })
                    });
                }
            } catch (tgErr) {
                console.error('❌ [Lurah Ekosistem] Telegram Fetch Error:', tgErr.message);
            }
        }

        console.log('✅ [Lurah Ekosistem] Audit Complete.');
        return res.status(200).json({ success: true, report: aiResponse });

    } catch (error) {
        console.error('❌ [Lurah Ekosistem] Error:', error.message);
        return res.status(500).json({ error: error.message });
    }
};

async function callGeminiWithFallback(initialModelId, promptText) {
    const apiKeys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5,
        process.env.GEMINI_API_KEY_6,
        process.env.GEMINI_API_KEY_7,
        process.env.GEMINI_API_KEY_8,
        process.env.GEMINI_API_KEY_9
    ].filter(Boolean);

    if (apiKeys.length === 0) {
        return { error: "API Key Gemini tidak dikonfigurasi." };
    }

    // Definisi Model Fallback (2026 Edition)
    const fallbackModels = [
        "gemini-2.0-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-3.0-flash",
        "gemini-3.1-pro",
        "gemma-4"
    ];

    const modelsToTry = [initialModelId, ...fallbackModels.filter(m => m !== initialModelId)];
    let lastError = null;

    for (const model of modelsToTry) {
        for (let i = 0; i < apiKeys.length; i++) {
            const key = apiKeys[i];
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }]
                    })
                });
                const result = await response.json();
                
                if (result.error) {
                    lastError = result.error.message;
                    if (result.error.code === 404 || result.error.message.toLowerCase().includes('not found')) {
                        console.warn(`⚠️ [Model Fallback] Model ${model} tidak tersedia, ganti model...`);
                        break; // Model tidak ada, lanjut ke model berikutnya
                    }
                    if (result.error.code === 429 || result.error.message.toLowerCase().includes('quota') || result.error.message.toLowerCase().includes('exhausted')) {
                        console.warn(`⚠️ [API Key Fallback] Key ${i+1} limit pada ${model}, coba key berikutnya...`);
                        continue; 
                    }
                    continue; 
                }
                
                return {
                    text: result.candidates?.[0]?.content?.parts?.[0]?.text || "AI tidak memberikan respon.",
                    success: true,
                    usedModel: model
                };
            } catch (err) {
                // Catches Network Errors (Timeout, DNS, Connection Reset) or JSON parse failures.
                // Does NOT catch HTTP 429 (Quota) or 404 (Not Found) which are handled in the try block above.
                console.error(`❌ [Fetch Error] Key ${i+1} pada model ${model}:`, err.message);
                lastError = err.message;
            }
        }
    }

    return { error: `Semua API Key dan Model gagal. Error terakhir: ${lastError}` };
}
