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
    console.log('🤖 [Lurah Ekosistem] Memulai audit harian...');

    try {
        // 1. Ambil Peraturan (Knowledge) dari Vault
        const { data: vault } = await supabase
            .from('agent_vault')
            .select('file_path, content, category');

        const protocols = vault.filter(v => v.category === 'protocol').map(v => v.content).join('\n\n');
        const skills = vault.filter(v => v.category === 'skill').map(v => v.content).join('\n\n');

        // 2. Ambil Data Real-time untuk di-audit
        // A. Cek User baru (24jam)
        const { data: newUsers } = await supabase
            .from('user_profiles')
            .select('wallet_address, display_name, pfp_url, total_xp, last_seen_at')
            .gt('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        // B. Cek Anomali XP (Contoh: XP > 1jt dalam sehari)
        const { data: anomalies } = await supabase
            .from('user_task_claims')
            .select('wallet_address, xp_earned, task_id')
            .gt('claimed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .gt('xp_earned', 5000); // Threshold anomali

        // 3. Gunakan Otak AI (Gemini Flash) untuk Analisa
        const prompt = `
            Kamu adalah "Lurah Ekosistem", Agen Otonom untuk Crypto Disco App.
            Tugasmu adalah mengaudit data berdasarkan protokol berikut:
            
            PROTOKOL ARSITEKTUR:
            ${protocols}
            
            KEAHLIAN SENTINEL:
            ${skills}
            
            DATA AUDIT (24 JAM TERAKHIR):
            - User Baru: ${JSON.stringify(newUsers)}
            - Potensi Anomali XP: ${JSON.stringify(anomalies)}
            
            Berikan laporan ringkas (Bahasa Indonesia) yang mencakup:
            1. Ringkasan kesehatan ekosistem.
            2. Daftar pelanggaran (jika ada, misal: PFP URL terlalu panjang atau XP mencurigakan).
            3. Rekomendasi tindakan untuk Admin.
        `;

        let aiResponse = "Analisa AI tidak tersedia (Missing API Key).";
        if (geminiApiKey) {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const result = await response.json();
            aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "AI Gagal memberikan respon.";
        }

        // 4. Kirim Notifikasi Telegram
        if (telegramBotToken && telegramChatId) {
            const message = `🚨 *LAPORAN LURAH EKOSISTEM*\n\n${aiResponse}`;
            await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: telegramChatId,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
        }

        console.log('✅ [Lurah Ekosistem] Audit Selesai.');
        return res.status(200).json({ success: true, report: aiResponse });

    } catch (error) {
        console.error('❌ [Lurah Ekosistem] Error:', error.message);
        return res.status(500).json({ error: error.message });
    }
};
