require('dotenv').config();
const t = process.env.TELEGRAM_BOT_TOKEN;
const c = process.env.TELEGRAM_CHAT_ID;
const g = process.env.GEMINI_API_KEY;
const cronSecret = process.env.CRON_SECRET;
const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('=== LURAH BOT ENV AUDIT ===');
console.log('TELEGRAM_BOT_TOKEN:', t ? 'OK (' + t.substring(0,8) + '...)' : 'MISSING ❌');
console.log('TELEGRAM_CHAT_ID:  ', c ? 'OK (' + c + ')' : 'MISSING ❌');
console.log('GEMINI_API_KEY:    ', g ? 'OK' : 'MISSING ❌');
console.log('GEMINI_API_KEY_2:  ', process.env.GEMINI_API_KEY_2 ? 'OK' : 'MISSING ❌');
console.log('CRON_SECRET:       ', cronSecret ? 'OK' : 'MISSING ❌');
console.log('SUPABASE_URL:      ', supaUrl ? 'OK' : 'MISSING ❌');
console.log('SERVICE_ROLE_KEY:  ', supaKey ? 'OK' : 'MISSING ❌');
console.log('');

async function testTelegram() {
    if (!t) { console.log('SKIP: Cannot test Telegram - BOT_TOKEN missing'); return; }
    try {
        const res = await fetch('https://api.telegram.org/bot' + t + '/getMe');
        const data = await res.json();
        if (data.ok) {
            console.log('✅ Telegram Bot OK: @' + data.result.username + ' (ID: ' + data.result.id + ')');
        } else {
            console.log('❌ Telegram Bot ERROR:', data.description);
        }
    } catch(e) {
        console.log('❌ Telegram fetch failed:', e.message);
    }

    try {
        const res2 = await fetch('https://api.telegram.org/bot' + t + '/getWebhookInfo');
        const wh = await res2.json();
        if (wh.ok) {
            const info = wh.result;
            console.log('');
            console.log('=== WEBHOOK STATUS ===');
            console.log('URL:             ', info.url || 'NOT SET ❌');
            console.log('Pending updates: ', info.pending_update_count);
            console.log('Last error:      ', info.last_error_message || 'None ✅');
            console.log('Last error date: ', info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : 'None');
            if (!info.url) {
                console.log('');
                console.log('⚠️  WEBHOOK TIDAK TERDAFTAR - Bot tidak akan merespons pesan!');
            } else if (info.last_error_message) {
                console.log('');
                console.log('⚠️  WEBHOOK ERROR: ' + info.last_error_message);
            } else {
                console.log('✅ Webhook aktif dan normal');
            }
        }
    } catch(e) {
        console.log('❌ Webhook check failed:', e.message);
    }
}

testTelegram();
