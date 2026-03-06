/**
 * LURAH EKOSISTEM - INTERACTIVE WEBHOOK
 * Lokasi: verification-server/api/webhook/telegram.js
 */

const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const geminiApiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body;

    // 1. Security Check: Hanya balas chat dari owner
    if (!message || !message.chat || String(message.chat.id) !== String(telegramChatId)) {
        console.log(`[Webhook] Ignored message from: ${message?.chat?.id}`);
        return res.status(200).json({ ok: true });
    }

    const text = message.text || '';
    const chatId = message.chat.id;

    console.log(`[Webhook] Received command: ${text} from ${chatId}`);

    // 2. Command Router
    try {
        if (text === '/start') {
            await sendTelegram(chatId, "Sampurasun! Saya **Lurah Ekosistem**.\n\nKirim perintah berikut:\n/audit - Audit Ekosistem Instan\n/stats - Statistik User\n/health - Cek Koneksi DB & RPC\n/fix <error> - Minta Lurah memperbaiki error berdasarkan protokol & skill");
        }
        else if (text === '/audit') {
            await sendTelegram(chatId, "⏳ Memulai audit instan, mohon tunggu...");
            // Trigger the same logic as the cron job but return response here
            const auditHandler = require('../cron/lurah-ekosistem.js');
            // We mock res to capture output or just run it as it handles telegram internally
            await auditHandler({ headers: { 'authorization': `Bearer ${process.env.CRON_SECRET}` } }, { status: () => ({ json: () => { } }) });
        }
        else if (text === '/health') {
            const { data, error } = await supabase.from('user_profiles').select('count', { count: 'exact', head: true });
            const dbStatus = error ? "❌ Error" : "✅ Connected";
            await sendTelegram(chatId, `📶 *System Health*\n\nDatabase: ${dbStatus}\nNetwork: Base Sepolia\nAgent Mode: Interaktif (Gemini 3 Flash)`);
        }
        else if (text === '/stats') {
            const { count: totalUsers } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
            const { count: newUsers } = await supabase.from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            const table = "```\n+----------+-------+\n| Stat     | Count |\n+----------+-------+\n| Total    | " + (totalUsers || 0) + "     |\n| New (24h)| " + (newUsers || 0) + "     |\n+----------+-------+\n```";
            await sendTelegram(chatId, `📊 *Statistik Ekosistem*\n\n${table}`);
        }
        else if (text.startsWith('/fix')) {
            const errorMessage = text.replace('/fix', '').trim();
            if (!errorMessage) {
                await sendTelegram(chatId, "⚠️ Mohon sertakan pesan errornya, misal:\n`/fix TypeError: Cannot read property...`");
                return res.status(200).json({ ok: true });
            }
            await sendTelegram(chatId, "⏳ Lurah sedang menganalisa error berdasarkan protokol (.cursorrules) dan skills, mohon tunggu...");

            // 1. Fetch knowledge from Vault
            const { data: vault } = await supabase.from('agent_vault').select('content, category');
            const protocols = vault?.filter(v => v.category === 'protocol').map(v => v.content).join('\n\n');
            const skills = vault?.filter(v => v.category === 'skill').map(v => v.content).join('\n\n');

            const prompt = `
                Kamu adalah "Lurah Ekosistem", Pemecah Masalah dan Agen Otonom untuk Crypto Disco App.
                Tugasmu adalah menganalisa dan memberikan perbaikan (code fix/solusi) untuk error berikut:

                [ERROR INPUT]:
                ${errorMessage}

                Berikan solusi berdasarkan protokol dan keahlian berikut:
                PROTOKOL ARSITEKTUR (.cursorrules):
                ${protocols || 'Tidak tersedia'}

                KEAHLIAN SENTINEL:
                ${skills || 'Tidak tersedia'}
                
                Sajikan solusi secara ringkas, profesional, dan langsung ke intinya. Gunakan block code jika memberikan perbaikan kode.
            `;

            let fixResponse = "Gagal menghubungi AI Service.";
            if (geminiApiKey) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    });
                    const result = await response.json();
                    if (result.error) {
                        console.error('❌ [Lurah Ekosistem] Gemini API Error:', result.error.message);
                        fixResponse = `ℹ️ Analisa AI tertunda: ${result.error.message}`;
                    } else {
                        fixResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "AI tidak memberikan solusi.";
                    }
                } catch (aiErr) {
                    console.error('❌ AI Fetch Error:', aiErr.message);
                }
            } else {
                fixResponse = "API Key Gemini tidak dikonfigurasi.";
            }

            if (fixResponse.length > 4000) {
                fixResponse = fixResponse.substring(0, 4000) + '\n... (Pesan dipotong karena terlalu panjang)';
            }
            await sendTelegram(chatId, `🛠️ *HASIL ANALISA ERROR LURAH*\n\n${fixResponse}`);
        }
        else {
            await sendTelegram(chatId, "Maaf, Lurah belum mengerti perintah itu. Gunakan /start untuk bantuan.");
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('[Webhook Error]', err.message);
        await sendTelegram(chatId, `❌ Terjadi kesalahan: ${err.message}`);
        return res.status(200).json({ ok: true });
    }
};

async function sendTelegram(chatId, text) {
    const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        })
    });

    const result = await res.json();
    if (!result.ok && result.description && result.description.includes('can\'t parse entities')) {
        // Fallback without Markdown if parsing fails
        await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text
            })
        });
    }
}
