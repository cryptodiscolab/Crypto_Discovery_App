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
            await sendTelegram(chatId, "Sampurasun! Saya **Lurah Ekosistem**.\n\nKirim perintah berikut:\n/audit - Audit Ekosistem Instan\n/stats - Statistik User\n/health - Cek Koneksi DB & RPC");
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
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        })
    });
}
