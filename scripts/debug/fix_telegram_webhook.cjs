require('dotenv').config();
const t = process.env.TELEGRAM_BOT_TOKEN;
// Correct URL based on our verification of the dailyapp-verification-server project
const correctUrl = 'https://dailyapp-verification-server.vercel.app/api/webhook/telegram';
// Telegram recommends a secret token for security
const secretToken = t.replace(/:/g, '_');

async function fixWebhook() {
    if (!t) { console.log('❌ BOT_TOKEN missing in .env'); return; }
    
    console.log('🔄 Registering Webhook to:', correctUrl);
    
    try {
        const res = await fetch(`https://api.telegram.org/bot${t}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: correctUrl,
                secret_token: secretToken,
                allowed_updates: ['message', 'callback_query']
            })
        });
        
        const data = await res.json();
        if (data.ok) {
            console.log('✅ Webhook BERHASIL didaftarkan!');
            console.log('URL:', correctUrl);
        } else {
            console.log('❌ GAGAL mendaftarkan Webhook:', data.description);
        }
    } catch (e) {
        console.log('❌ Fetch error:', e.message);
    }
}

fixWebhook();
