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

    // Handle Callback Queries (for Inline Buttons)
    if (req.body.callback_query) {
        const query = req.body.callback_query;
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('delete_task:')) {
            const taskId = data.split(':')[1];

            // 1. Check for existing claims before deleting (Safe Delete)
            const { data: task, error: fetchError } = await supabase
                .from('daily_tasks')
                .select('description, current_claims')
                .eq('id', taskId)
                .single();

            if (fetchError) {
                await sendTelegram(chatId, `❌ Error: ${fetchError.message}`);
            } else if (task.current_claims > 0) {
                // Task has claims, suggest deactivation instead of deletion to protect XP
                await supabase.from('daily_tasks').update({ is_active: false }).eq('id', taskId);
                await sendTelegram(chatId, `⚠️ **Task ini memiliki ${task.current_claims} klaim!**\nUntuk menjaga keamanan XP user, task hanya dinonaktifkan (is_active: false) dan tidak dihapus permanen.`);
            } else {
                // No claims, safe to delete
                const { error: deleteError } = await supabase
                    .from('daily_tasks')
                    .delete()
                    .eq('id', taskId);

                if (deleteError) {
                    await sendTelegram(chatId, `❌ Gagal menghapus: ${deleteError.message}`);
                } else {
                    await sendTelegram(chatId, `✅ Task "${task.description}" berhasil dihapus permanen.`);
                }
            }
        }

        // Answer callback query to stop loading state in Telegram
        await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: query.id })
        });

        return res.status(200).json({ ok: true });
    }

    const { message } = req.body;

    // 1. MAXIMUM Security Check (Anti-Spoofing & Zero Trust)
    // Telegram will send X-Telegram-Bot-Api-Secret-Token if configured.
    // We sanitize bot token (remove :) because Telegram only allows A-Z, a-z, 0-9, _ and -
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];

    if (!telegramBotToken) {
        console.error('❌ TELEGRAM_BOT_TOKEN is not configured in environment variables!');
        return res.status(500).json({ error: 'Server misconfigured: Bot token missing' });
    }

    const expectedSecret = telegramBotToken.replace(/:/g, '_');

    // Skip secret token check in local mode to allow CLI testing
    if (process.env.LURAH_LOCAL_MODE !== 'true' && secretToken !== expectedSecret) {
        console.error(`[Security Alert] Invalid or missing Telegram Secret Token. Expected: ${expectedSecret.substring(0, 5)}... Received: ${secretToken ? secretToken.substring(0, 5) : 'null'}...`);
        return res.status(401).json({ error: 'Unauthorized: Invalid Security Token' });
    }

    // 2. Identity Check: Hanya balas chat dari owner (Anda)
    if (!telegramChatId) {
        console.error('❌ TELEGRAM_CHAT_ID is not configured!');
        return res.status(500).json({ error: 'Server misconfigured: Chat ID missing' });
    }

    if (!message || !message.chat || String(message.chat.id) !== String(telegramChatId)) {
        console.log(`[Webhook] Ignored unauthorized chat ID: ${message?.chat?.id}`);
        return res.status(200).json({ ok: true });
    }

    // 3. Vault & External Keys Check
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase configuration is missing!');
        await sendTelegram(chatId, "⚠️ Server Error: Supabase configuration is missing on Vercel.");
        return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    if (!geminiApiKey) {
        console.warn('⚠️ Gemini API Key is missing!');
        // Don't error out entirely, can still show health/stats maybe
    }

    const text = message.text || '';
    const chatId = message.chat.id;

    console.log(`[Webhook] Received command: ${text} from ${chatId}`);

    // 2. Command Router
    try {
        if (text === '/start') {
            await sendTelegram(chatId, "Sampurasun! Saya **Lurah Ekosistem**.\n\nKirim perintah berikut:\n/audit - Audit Ekosistem Instan\n/stats - Statistik User\n/health - Cek Koneksi DB & RPC\n/model - Pilih Otak AI (Model)\n/fix <error> - Perbaiki error via AI");
        }
        else if (text === '/model') {
            await sendTelegram(chatId, "🧠 **PILIH OTAK LURAH (AI MODEL - 2026 EDITION)**\n\nKetik perintah di bawah:\n`/model_flash` - Gemini 2.5 Flash (Super Cepat & Akurat)\n`/model_pro` - Gemini 2.5 Pro (Otak Paling Cerdas & Mendalam)\n`/model_3` - Gemini 3.1 Flash (Teknologi Masa Depan)\n\n*Pilihan Anda akan disimpan secara permanen di database.*");
        }
        else if (text.startsWith('/model_')) {
            const chosen = text.split('_')[1];
            let modelId = "gemini-2.5-flash"; // Default 2026
            let modelName = "Gemini 2.5 Flash";

            if (chosen === 'pro') { modelId = "gemini-2.5-pro"; modelName = "Gemini 2.5 Pro"; }
            else if (chosen === '3') { modelId = "gemini-3.1-flash-lite-preview"; modelName = "Gemini 3.1 Flash"; }

            // Simpan ke Agent Vault (Settings)
            await supabase.from('agent_vault').upsert({
                file_path: 'settings/preferred_model',
                content: modelId,
                category: 'setting',
                version: 1,
                updated_at: new Date().toISOString()
            }, { onConflict: 'file_path' });

            await sendTelegram(chatId, `✅ Otak Lurah berhasil diganti secara permanen ke: **${modelName}**.\nSilakan coba kirim chat atau perintah baru!`);
        }
        else if (text === '/help') {
            const helpMsg = `📖 **PANDUAN LURAH EKOSISTEM**

**Manajemen Task:**
• \`/tambah_task Deskripsi | Link\` - Tambah task baru (XP & Platform otomatis).
• \`/daftar_task\` - Lihat semua task & tombol hapus.
• \`/hapus_task <uuid>\` - Hapus task secara manual.

**Audit & Stats:**
• \`/audit\` - Jalankan audit ekosistem instan.
• \`/stats\` - Lihat statistik User, XP, dan Task.
• \`/health\` - Cek status koneksi Database & Bot.

**Siklus Sistem:**
• **07:00 WIB**: Task lama expired (Otomatis).
• **07:15 WIB**: Task baru aktif (Otomatis).
• **Anti-Cheat**: Pencegahan klaim XP berulang aktif pada setiap verifikasi.
`;
            await sendTelegram(chatId, helpMsg);
        }
        else if (text === '/audit') {
            await sendTelegram(chatId, "⏳ Memulai audit instan, mohon tunggu...");
            // Trigger the same logic as the cron job but return response here
            const auditHandler = require('../cron/lurah-ekosistem.js');
            // We mock res to capture output or just run it as it handles telegram internally
            await auditHandler({ headers: { 'authorization': `Bearer ${process.env.CRON_SECRET}` } }, { status: () => ({ json: () => { } }) });
        }
        else if (text === '/daftar_task' || text === '/tasks') {
            const { data: tasks, error } = await supabase
                .from('daily_tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                await sendTelegram(chatId, `❌ Error fetching tasks: ${error.message}`);
                return res.status(200).json({ ok: true });
            }

            if (!tasks || tasks.length === 0) {
                await sendTelegram(chatId, "📭 Belum ada task harian.");
                return res.status(200).json({ ok: true });
            }

            let msg = "📝 **DAFTAR TASK HARIAN**\n\n";
            const inline_keyboard = [];

            tasks.forEach((t, i) => {
                const status = t.is_active ? "✅ Aktif" : "⏳ Pending/Inactive";
                msg += `${i + 1}. **${t.description}**\n   💰 XP: ${t.xp_reward} | 🌐 ${t.platform}\n   🆔 \`${t.id}\`\n   📊 Status: ${status}\n\n`;

                // Add a delete button for each task
                inline_keyboard.push([{
                    text: `🗑️ Hapus Task ${i + 1}`,
                    callback_data: `delete_task:${t.id}`
                }]);
            });

            await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: msg,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard }
                })
            });
        }
        else if (text.startsWith('/tambah_task') || text.startsWith('/create_task')) {
            // Format: /tambah_task Deskripsi | Link
            const parts = text.split('|').map(p => p.trim());
            const descPart = parts[0].replace('/tambah_task', '').replace('/create_task', '').trim();
            const link = parts[1] || '';

            if (!descPart || !link) {
                await sendTelegram(chatId, "⚠️ Format salah! Gunakan:\n`/tambah_task Deskripsi | Link`\n\nContoh:\n`/tambah_task Follow @chebrothers | https://x.com/chebrothers`Ready");
                return res.status(200).json({ ok: true });
            }

            // 1. Auto-detect Platform and Task Type
            let platform = 'base';
            let actionType = 'transaction';
            let targetId = '';

            if (link.includes('x.com') || link.includes('twitter.com')) {
                platform = 'twitter';
                actionType = 'follow'; // Default for simple links
                // Extract username
                const match = link.match(/(?:x|twitter)\.com\/([^\n\/\s?]+)/);
                if (match) targetId = match[1];
            } else if (link.includes('warpcast.com')) {
                platform = 'farcaster';
                actionType = 'follow';
                const match = link.match(/warpcast\.com\/([^\n\/\s?]+)/);
                if (match) targetId = match[1];
            }

            // 2. Fetch XP Reward from point_settings
            const { data: pointSetting } = await supabase
                .from('point_settings')
                .select('points_value')
                .eq('platform', platform === 'twitter' ? 'x' : platform)
                .ilike('action_type', actionType)
                .eq('is_active', true)
                .maybeSingle();

            const xpReward = pointSetting ? pointSetting.points_value : 50; // Default 50 if not found

            // 3. Calculate Expires At (Next 07:00 WIB / 00:00 UTC)
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setUTCHours(0, 0, 0, 0);
            if (expiresAt <= now) {
                expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);
            }

            // 4. Insert Task
            const { data: newTask, error: insertError } = await supabase
                .from('daily_tasks')
                .insert([{
                    description: descPart,
                    platform,
                    action_type: actionType,
                    link,
                    target_id: targetId,
                    xp_reward: xpReward,
                    is_active: false, // 07:15 activate logic
                    expires_at: expiresAt.toISOString(),
                    requires_verification: true,
                    task_type: 'social'
                }])
                .select()
                .single();

            if (insertError) {
                await sendTelegram(chatId, `❌ Gagal membuat task: ${insertError.message}`);
            } else {
                await sendTelegram(chatId, `✅ **Task Berhasil Dibuat!**\n\nID: \`${newTask.id}\`\nReward: ${xpReward} XP\nTarget: ${targetId || 'N/A'}\n\nStatus: ⏳ Pending (Aktif pukul 07:15 WIB)\nExpires: ${expiresAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n*Anti-Cheat Aktif: Cegah Klaim Berulang.*`);
            }
        }
        else if (text.startsWith('/hapus_task')) {
            const taskId = text.replace('/hapus_task', '').trim();
            // Logic simplified: we'll handle callback queries for true convenience, but this is the text fallback
            if (!taskId) {
                await sendTelegram(chatId, "⚠️ Gunakan `/daftar_task` untuk menghapus menggunakan tombol, atau ketik `/hapus_task <uuid>`");
                return res.status(200).json({ ok: true });
            }
            // ... existing delete logic ...
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

            // 1. Fetch knowledge & Settings from Vault
            const { data: vault } = await supabase.from('agent_vault').select('content, category, file_path');
            const protocols = vault?.filter(v => v.category === 'protocol').map(v => v.content).join('\n\n');
            const skills = vault?.filter(v => v.category === 'skill').map(v => v.content).join('\n\n');

            // Get preferred model from settings
            const modelSetting = vault?.find(v => v.file_path === 'settings/preferred_model');
            let modelId = modelSetting ? modelSetting.content : "gemini-2.5-flash";

            // Override if mentioning specific model in chat
            if (text.toLowerCase().includes("pakai pro")) modelId = "gemini-2.5-pro";
            else if (text.toLowerCase().includes("pakai 3")) modelId = "gemini-3.1-flash-lite-preview";

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
                    // Use v1beta for most 2.5/3.x models in 2026
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
            // Conversational Mode: Talk like Local Agent (Antigravity/Lurah)
            await sendTelegram(chatId, "⏳ Memproses pemikiran...");

            // 1. Fetch knowledge & Settings from Vault
            const { data: vault } = await supabase.from('agent_vault').select('content, category, file_path');
            const protocols = vault?.filter(v => v.category === 'protocol').map(v => v.content).join('\n\n');
            const skills = vault?.filter(v => v.category === 'skill').map(v => v.content).join('\n\n');

            // Get preferred model from settings
            const modelSetting = vault?.find(v => v.file_path === 'settings/preferred_model');
            let modelId = modelSetting ? modelSetting.content : "gemini-2.5-flash";

            // Manual override detection
            if (text.toLowerCase().includes("pakai pro")) modelId = "gemini-2.5-pro";
            else if (text.toLowerCase().includes("pakai 3")) modelId = "gemini-3.1-flash-lite-preview";

            const prompt = `
                Kamu adalah "Lurah Ekosistem" (atau Antigravity), Agen Otonom Tingkat Senior (Senior Web3 Staff Engineer) untuk proyek Crypto Disco App.
                Pengguna saat ini sedang bekerja secara remote melalui Telegram, jauh dari PC lokal.
                
                Gaya Bicaramu:
                - Profesional, sangat cerdas, responsif, dan langsung ke intinya (seperti saat kamu bekerja di Cursor IDE).
                - Gunakan Bahasa Indonesia.
                - Jika diminta untuk melakukan tugas, tulislah pemikiranmu, lalu berikan blok kode (code blocks) persis apa yang harus dirubah (diff/patch) atau panduan eksekusi "copy-paste" untuk pengguna.
                - Sertakan jaminan keamanan (Bytecode Impact, Gas Impact, Zero Trust).

                [PERTANYAAN/PERINTAH DARI OWNER]:
                ${text}

                PROTOKOL ARSITEKTUR REPOSITORY INI (.cursorrules):
                ${protocols || 'Tidak tersedia'}

                KEAHLIAN AUTOMATION DAN SENTINEL (SKILLS):
                ${skills || 'Tidak tersedia'}
                
                Pastikan respons formatnya rapi menggunakan Markdown Telegram.
            `;

            let chatResponse = "Gagal menghubungi AI Service.";
            if (geminiApiKey) {
                try {
                    // Use v1beta for 2026 models
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    });
                    const result = await response.json();
                    if (result.error) {
                        chatResponse = `ℹ️ Analisa AI tertunda: ${result.error.message}`;
                    } else {
                        chatResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "AI tidak merespons.";
                    }
                } catch (aiErr) {
                    console.error('❌ AI Fetch Error:', aiErr.message);
                }
            }

            if (chatResponse.length > 4000) {
                chatResponse = chatResponse.substring(0, 4000) + '\n... (Pesan terlalu panjang untuk Telegram)';
            }
            await sendTelegram(chatId, chatResponse);
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('[Webhook Error]', err.message);
        await sendTelegram(chatId, `❌ Terjadi kesalahan: ${err.message}`);
        return res.status(200).json({ ok: true });
    }
};

async function sendTelegram(chatId, text) {
    if (process.env.LURAH_LOCAL_MODE === 'true') {
        console.log('\n🤖 [LURAH DI TERMINAL] 🤖\n' + text + '\n-------------------------\n');
    }

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
