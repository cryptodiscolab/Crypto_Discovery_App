require('dotenv').config();
process.env.LURAH_LOCAL_MODE = 'true';
const { createClient } = require('@supabase/supabase-js');
const handler = require('./verification-server/api/webhook/telegram.js');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!supabaseUrl || !supabaseKey || !chatId) {
    console.error('❌ Mohon pastikan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan TELEGRAM_CHAT_ID terisi di .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🤖 ============================================== 🤖');
console.log('                 LURAH EKOSISTEM                  ');
console.log('                 Local Chat Interface             ');
console.log('🤖 ============================================== 🤖\n');
console.log('Ketik perintah seperti di Telegram: /start, /stats, /health, /audit, atau /fix <error>');
console.log('Ketik "exit" untuk keluar.\n');

const resMock = {
    status: (code) => ({
        json: (data) => {/* silent output */ }
    })
};

const askLurah = () => {
    rl.question('Anda: ', async (command) => {
        if (command.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        const reqMock = {
            method: 'POST',
            body: {
                message: {
                    chat: { id: chatId },
                    text: command
                }
            }
        };

        try {
            // Kita bypass pengiriman ke telegram sungguhan (optional jika ingin tes murni di terminal)
            // Namun karena script telegram.js kita menggunakan fetch langsung ke API Telegram,
            // Hasilnya akan tetap terkirim ke Telegram Anda!

            console.log('\n⏳ Menghubungi Lurah...\n');
            await handler(reqMock, resMock);
            console.log('✅ Respons terkirim ke Aplikasi Telegram Anda (Silakan cek HP/Desktop APP Telegram Anda!).\n');
        } catch (e) {
            console.error('❌ Error Local Script:', e.message);
        }

        askLurah();
    });
};

askLurah();
