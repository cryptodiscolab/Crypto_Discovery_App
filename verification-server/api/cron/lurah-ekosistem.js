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

module.exports = async (req, res) => {
    console.log('🤖 [Lurah Ekosistem] Starting daily audit...');

    try {
        // 0. Ambil Audit Settings Dinamis (Centralized Control)
        const { data: settingsData } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'audit_settings')
            .single();

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

        let aiResponse = "AI Analysis not available (Missing API Key).";
        if (geminiApiKey) {
            try {
                // Gunakan model dinamis atau fallback stable
                const modelId = auditSettings.ai_model || "gemini-2.0-flash";
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
                const result = await response.json();
                if (result.error) {
                    console.error('❌ [Lurah Ekosistem] Gemini API Error:', result.error.message);
                    aiResponse = `Analisa AI tertunda (Quota/Limit reached).`;
                } else {
                    aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "AI Gagal memberikan respon.";
                }
            } catch (aiErr) {
                console.error('❌ [Lurah Ekosistem] AI Fetch Error:', aiErr.message);
                aiResponse = "Gagal menghubungi AI Service.";
            }
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
