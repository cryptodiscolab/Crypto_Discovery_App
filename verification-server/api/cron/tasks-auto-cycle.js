/**
 * TASK AUTO-CYCLE SCHEDULER
 * Lokasi: verification-server/api/cron/tasks-auto-cycle.js
 * 
 * Logic Daily Cycle:
 * - 07:00 WIB (00:00 UTC): Task lama expired (is_active = false)
 * - 07:15 WIB (00:15 UTC): Task baru/pending diaktifkan (is_active = true)
 */

const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    console.log('⏳ [Task Cycle] Running automated task scheduler...');

    try {
        const now = new Date();
        const currentUtcHour = now.getUTCHours();
        const currentUtcMinute = now.getUTCMinutes();

        let actionReport = "";

        // 1. CYCLE: EXPIRE (Targeting 00:00 UTC / 07:00 WIB)
        // We run this between 00:00 and 00:10 UTC
        if (currentUtcHour === 0 && currentUtcMinute < 10) {
            const { data, error } = await supabase
                .from('daily_tasks')
                .update({ is_active: false })
                .eq('is_active', true)
                .lt('expires_at', now.toISOString())
                .select();

            if (error) throw error;
            actionReport = `🌅 **Cycle Expire (07:00 WIB)**\nBerhasil menonaktifkan ${data?.length || 0} task yang kadaluarsa.`;
            console.log(`[Task Cycle] Expired ${data?.length || 0} tasks.`);
        }

        // 2. CYCLE: ACTIVATE (Targeting 00:15 UTC / 07:15 WIB)
        // We run this between 00:15 and 00:25 UTC
        else if (currentUtcHour === 0 && currentUtcMinute >= 15 && currentUtcMinute < 30) {
            const { data, error } = await supabase
                .from('daily_tasks')
                .update({ is_active: true })
                .eq('is_active', false)
                .gt('expires_at', now.toISOString()) // Only activate if not yet expired
                .select();

            if (error) throw error;
            actionReport = `🚀 **Cycle Activate (07:15 WIB)**\nBerhasil mengaktifman ${data?.length || 0} task baru untuk hari ini.`;
            console.log(`[Task Cycle] Activated ${data?.length || 0} tasks.`);
        }

        else {
            actionReport = "ℹ️ [Task Cycle] Bukan waktu transisi (07:00/07:15 WIB). Tidak ada aksi sistem.";
        }

        // 3. Notify Admin via Telegram
        if (actionReport && telegramBotToken && telegramChatId) {
            await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: telegramChatId,
                    text: `⚙️ **SYSTEM LURAH: TASK SCHEDULER**\n\n${actionReport}`,
                    parse_mode: 'Markdown'
                })
            });
        }

        return res.status(200).json({ success: true, report: actionReport });

    } catch (error) {
        console.error('❌ [Task Cycle] Error:', error.message);
        return res.status(500).json({ error: error.message });
    }
};
