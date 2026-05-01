/**
 * LURAH EKOSISTEM - INTERACTIVE WEBHOOK
 * Lokasi: verification-server/api/webhook/telegram.js
 */

const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;

const orchestron = require('../lib/orchestron-core');

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
                .maybeSingle(); // v3.42.2: task may not exist (safe delete)

            if (fetchError || !task) {
                await sendTelegram(chatId, fetchError ? `❌ Error: ${fetchError.message}` : `❌ Task ${taskId} tidak ditemukan.`);
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
        await fetch(`https://api.telegram.org/bot${telegramBotToken}/answerCallbackQuery`, {
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
            await sendTelegram(chatId, "Sampurasun! Saya **Lurah Ekosistem**.\n\nKirim perintah berikut:\n/audit - Audit Ekosistem Instan\n/orchestron - Menu Kendali Nexus Orchestron\n/whitelist - Whitelist Token Baru\n/list_tokens - Lihat Token Terdaftar\n/user <wallet> - Audit Identitas Lengkap User\n/stats - Statistik User\n/health - Cek Koneksi DB & RPC\n/model - Pilih Otak AI (Model)\n/fix <error> - Perbaiki error via AI");
        }
        else if (text === '/orchestron') {
            const clawStatus = await orchestron.getAgentStatus('openclaw');
            const menu = `⚔️ **NEXUS ORCHESTRON COMMAND CENTER**
            
📡 **AGENT STATUS:**
• @openclaw: ${clawStatus === 'ONLINE' ? '🟢 ONLINE' : '🔴 OFFLINE'}
• @lurah: 🟢 ONLINE (Internal)

🛠️ **MULTI-AGENT DISPATCH:**
Gunakan format \`> [nama_agent]: [tugas]\`
Contoh:
\`> claw: audit contract 0xabc...\`
\`> deepseek: optimize gas for swap function\`

🚀 **SYSTEM WIDE:**
/audit - Health check ekosistem.
/health - Status konektivitas.`;
            await sendTelegram(chatId, menu);
        }
        else if (text === '/model') {
            await sendTelegram(chatId, "🧠 **PILIH OTAK LURAH (AI MODEL - 2026 EDITION)**\n\nKetik perintah di bawah:\n`/model_flash` - Gemini 2.5 Flash (Super Cepat & Akurat)\n`/model_pro` - Gemini 2.5 Pro (Otak Paling Cerdas & Mendalam)\n`/model_3` - Gemini 3.1 Flash (Teknologi Masa Depan)\n\n*Pilihan Anda akan disimpan secara permanen di database.*");
        }
        else if (text.startsWith('/model_')) {
            const chosen = text.split('_')[1];
            let modelId = "gemini-2.5-flash"; // Default 2026
            let modelName = "Gemini 2.5 Pro";

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
            const helpMsg = `📖 **PANDUAN LURAH EKOSISTEM (ANTIGRAVITY NEXUS)**

**🚀 AGENT NEXUS (Multi-Agent Commands):**
• \`> claw: [tugas]\` - Panggil **OpenClaw** (Deep Security & Architecture Audit).
• \`> deepseek: [tugas]\` - Panggil **DeepSeek** (Complex Logic & Backend Optimization).
• \`> qwen: [tugas]\` - Panggil **Qwen-Coder** (Local File Refactoring & Build Check).

**🛠️ SMART TOOLS:**
• \`/fix <error>\` - Analisa & solusi error berdasarkan protokol & skill.
• \`/audit\` - Jalankan audit ekosistem menyeluruh (Real-time).
• \`/user <wallet>\` - Audit identitas lengkap & Social Identity Lock.

**📊 MANAGEMENT:**
• \`/tambah_task Deskripsi | Link\` - Tambah task harian baru.
• \`/daftar_task\` - Lihat semua task aktif & hapus via tombol.
• \`/stats\` - Statistik User, XP, dan pertumbuhan akun.
• \`/health\` - Cek status koneksi DB, RPC, dan Agent Engine.
• \`/model\` - Ganti "Otak AI" Lurah secara permanen.

**🕒 SIKLUS & KEAMANAN:**
• **07:00 WIB**: Reset task harian (Otomatis).
• **Anti-Cheat**: Validasi XP & Pencegahan klaim ganda aktif.
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

            await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
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
                actionType = 'Follow';
                // Try to extract post ID first if it's a status link
                const postMatch = link.match(/\/status\/(\d+)/);
                if (postMatch) {
                    targetId = postMatch[1];
                } else {
                    const handleMatch = link.match(/(?:x|twitter)\.com\/([^\n\/\s?]+)/);
                    if (handleMatch) targetId = handleMatch[1];
                }
            } else if (link.includes('warpcast.com')) {
                platform = 'farcaster';
                actionType = 'Follow';
                const match = link.match(/warpcast\.com\/[^\/]+\/([^\n\/\s?]+)/); // Extract hash if available
                if (match) {
                    targetId = match[1];
                } else {
                    const profileMatch = link.match(/warpcast\.com\/([^\n\/\s?]+)/);
                    if (profileMatch) targetId = profileMatch[1];
                }
            } else if (link.includes('tiktok.com')) {
                platform = 'tiktok';
                actionType = 'Follow';
                // Extract Video ID if present
                const videoMatch = link.match(/\/video\/(\d+)/);
                if (videoMatch) {
                    targetId = videoMatch[1];
                } else {
                    const handleMatch = link.match(/tiktok\.com\/@([^\n\/\s?]+)/);
                    if (handleMatch) targetId = handleMatch[1];
                }
            } else if (link.includes('instagram.com')) {
                platform = 'instagram';
                actionType = 'Follow';
                // Extract Post/Reel ID if present
                const postMatch = link.match(/\/(?:p|reels|reel)\/([^\n\/\s?]+)/);
                if (postMatch) {
                    targetId = postMatch[1].replace(/\/$/, ""); // Remove trailing slash
                } else {
                    const handleMatch = link.match(/instagram\.com\/([^\n\/\s?]+)/);
                    if (handleMatch) targetId = handleMatch[1];
                }
            }

            // Refine Action Type based on keywords in description
            const descLower = descPart.toLowerCase();
            if (descLower.includes('like')) actionType = 'Like';
            else if (descLower.includes('comment')) actionType = 'Comment';
            else if (descLower.includes('repost') || descLower.includes('recast') || descLower.includes('share')) {
                actionType = (platform === 'farcaster' || platform === 'twitter') ? 'Recast/Repost' : 'Repost';
            }

            // 2. Fetch XP Reward from point_settings
            const { data: pointSetting } = await supabase
                .from('point_settings')
                .select('points_value')
                .eq('platform', platform === 'twitter' ? 'x' : platform)
                .ilike('action_type', actionType)
                .eq('is_active', true)
                .maybeSingle();

            const xpReward = pointSetting ? pointSetting.points_value : 0; // Dynamic config only

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
                    title: descPart,
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
        else if (text.startsWith('/whitelist')) {
            // Format: /whitelist chain_id address symbol decimals
            const args = text.replace('/whitelist', '').trim().split(' ');
            if (args.length < 4) {
                await sendTelegram(chatId, "⚠️ Format salah! Gunakan:\n`/whitelist <chain_id> <address> <symbol> <decimals>`\n\nContoh:\n`/whitelist 8453 0x... USYC 6` Ready");
                return res.status(200).json({ ok: true });
            }

            const [chainId, address, symbol, decimals] = args;
            const { data, error } = await supabase
                .from('allowed_tokens')
                .upsert({
                    chain_id: parseInt(chainId),
                    address: address.toLowerCase(),
                    symbol: symbol.toUpperCase(),
                    decimals: parseInt(decimals),
                    is_active: true
                }, { onConflict: 'chain_id,address' })
                .select();

            if (error) {
                await sendTelegram(chatId, `❌ Gagal whitelisting: ${error.message}`);
            } else {
                await sendTelegram(chatId, `✅ **Token Berhasil Terdaftar!**\n\nChain: ${chainId}\nSymbol: ${symbol}\nAddress: \`${address}\`\nDecimals: ${decimals}`);
                await orchestron.logToNexus(`Admin whitelisted token ${symbol} on chain ${chainId}`);
            }
        }
        else if (text === '/list_tokens') {
            const { data, error } = await supabase
                .from('allowed_tokens')
                .select('*')
                .eq('is_active', true)
                .order('chain_id', { ascending: true });

            if (error) {
                await sendTelegram(chatId, `❌ Gagal mengambil token: ${error.message}`);
            } else if (!data || data.length === 0) {
                await sendTelegram(chatId, "📭 Belum ada token yang terdaftar.");
            } else {
                let msg = "📋 **DAFTAR TOKEN TERDAFTAR**\n\n";
                data.forEach(t => {
                    msg += `• **${t.symbol}** (Chain: ${t.chain_id})\n  Addr: \`${t.address}\` | Dec: ${t.decimals}\n\n`;
                });
                await sendTelegram(chatId, msg);
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
            const { data: healthData, error: healthError } = await supabase
                .from('system_health')
                .select('*')
                .order('service_key');
            
            if (healthError) {
                await sendTelegram(chatId, `❌ Gagal mengambil status kesehatan: ${healthError.message}`);
                return res.status(200).json({ ok: true });
            }

            let healthSummary = "📶 **NEXUS SYSTEM HEALTH REPORT**\n\n";
            const now = Date.now();

            healthData.forEach(svc => {
                let emoji = "🟢";
                let statusText = svc.status.toUpperCase();
                
                const lastHb = new Date(svc.last_heartbeat).getTime();
                const isStale = (now - lastHb) > (2 * 60 * 60 * 1000);

                if (svc.status === 'failed') emoji = "🔴";
                else if (svc.status === 'recovering') emoji = "🔵";
                else if (isStale) {
                    emoji = "🟡";
                    statusText = "STALE";
                }

                healthSummary += `${emoji} **${svc.service_key}**: \`${statusText}\`\n`;
                healthSummary += `   🕒 _${new Date(svc.last_heartbeat).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_\n`;
                if (svc.status === 'recovering') healthSummary += `   🩹 _Healing: ${svc.metadata?.consecutive_success || 0}/3_\n`;
                if (svc.last_error) healthSummary += `   ⚠️ \`${svc.last_error.substring(0, 50)}...\`\n`;
                healthSummary += "\n";
            });

            await sendTelegram(chatId, healthSummary + `\n🔗 [Dashboard](${process.env.VITE_VERIFY_SERVER_URL || 'https://crypto-disco-raffle.vercel.app'}/admin)`);
        }
        else if (text === '/stats') {
            const { count: totalUsers } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
            const { count: newUsers } = await supabase.from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            const table = "```\n+----------+-------+\n| Stat     | Count |\n+----------+-------+\n| Total    | " + (totalUsers || 0) + "     |\n| New (24h)| " + (newUsers || 0) + "     |\n+----------+-------+\n```";
            await sendTelegram(chatId, `📊 *Statistik Ekosistem*\n\n${table}`);
        }
        else if (text.startsWith('/user')) {
            const walletAddress = text.replace('/user', '').trim().toLowerCase();
            if (!walletAddress || !walletAddress.startsWith('0x')) {
                await sendTelegram(chatId, "⚠️ Gunakan format: `/user <wallet_address>`\nContoh: `/user 0x123...abc`");
                return res.status(200).json({ ok: true });
            }

            const { data: user, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('wallet_address', walletAddress)
                .maybeSingle();

            if (error) {
                await sendTelegram(chatId, `❌ Database Error: ${error.message}`);
            } else if (!user) {
                await sendTelegram(chatId, `📭 User with wallet \`${walletAddress}\` not found in database.`);
            } else {
                const auditMsg = `👤 **USER IDENTITY AUDIT**

🏦 **Wallet:** \`${user.wallet_address}\`
💰 **Total XP:** \`${user.total_xp || 0}\`
🏆 **Tier:** \`${user.tier || 1}\`
🛡️ **Trust Score:** \`${user.trust_score || 0}/100\`
🎟️ **Raffle Wins:** \`${user.raffle_wins || 0}\` kemenangan

🔗 **SOCIAL IDENTITY LOCK:**
• **X (Twitter):** ${user.twitter_username ? `[@${user.twitter_username}](https://x.com/${user.twitter_username})` : '❌ Not Linked'}
• **Farcaster:** ${user.fid ? `[FID ${user.fid}](https://warpcast.com/${user.username || user.fid})` : '❌ Not Linked'}
• **Telegram:** ${user.telegram_username ? `@${user.telegram_username}` : (user.telegram_id ? `ID: ${user.telegram_id}` : '❌ Not Linked')}
• **TikTok:** ${user.tiktok_username ? `@${user.tiktok_username}` : '❌ Not Linked'}
• **Instagram:** ${user.instagram_username ? `@${user.instagram_username}` : '❌ Not Linked'}

🕒 **Activity:**
• First Joined: \`${new Date(user.created_at).toLocaleDateString()}\`
• Last Login: \`${user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}\`
`;
                await sendTelegram(chatId, auditMsg);
            }
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
        else if (text.startsWith('> ')) {
            // Agent Dispatcher Pattern: "> agent: task"
            const match = text.match(/^>\s*(\w+):\s*(.*)/);
            if (!match) {
                await sendTelegram(chatId, "⚠️ Format salah! Gunakan `> agent: tugas`. Contoh: `> claw: audit index.js`.");
                return res.status(200).json({ ok: true });
            }
            
            const agent = match[1].toLowerCase();
            const taskQuery = match[2];
            
            const supportedAgents = ['claw', 'openclaw', 'deepseek', 'qwen', 'lurah'];
            if (!supportedAgents.includes(agent)) {
                await sendTelegram(chatId, `❌ Agent @${agent} tidak dikenal atau tidak tersedia.`);
                return res.status(200).json({ ok: true });
            }

            const targetAgent = agent === 'claw' ? 'openclaw' : agent;
            await sendTelegram(chatId, `📡 Mengirim instruksi ke **@${targetAgent}**...\nTugas: _${taskQuery}_`);
            
            try {
                await orchestron.dispatchTask(targetAgent, `Telegram Command: ${taskQuery}`, taskQuery);
                await sendTelegram(chatId, `✅ Instruksi diterima oleh buffer **@${targetAgent}**. Menunggu eksekusi oleh worker lokal/cloud...`);
            } catch (dispatchErr) {
                await sendTelegram(chatId, `❌ Gagal mengirim instruksi: ${dispatchErr.message}`);
            }
        }
        else {
            // Conversational Mode: Interactive Agent (Antigravity/Lurah) with Memory
            await sendTelegram(chatId, "⏳ Memproses pemikiran...");

            // 1. Fetch Chat History (Last 10 messages)
            const { data: history } = await supabase
                .from('telegram_chat_history')
                .select('role, content')
                .eq('chat_id', String(chatId))
                .order('created_at', { ascending: false })
                .limit(10);

            const formattedHistory = (history || []).reverse().map(h => `${h.role === 'user' ? 'Owner' : 'Lurah'}: ${h.content}`).join('\n');

            // 2. Fetch knowledge & Settings from Vault
            const { data: vault } = await supabase.from('agent_vault').select('content, category, file_path');
            const protocols = vault?.filter(v => v.category === 'protocol').map(v => v.content).join('\n\n');
            const { data: recentReports } = await supabase.from('nexus_agent_reports').select('message, error_type').eq('status', 'OPEN').limit(5);

            // Get preferred model
            const modelSetting = vault?.find(v => v.file_path === 'settings/preferred_model');
            let modelId = modelSetting ? modelSetting.content : "gemini-2.5-flash";

            const prompt = `
                Kamu adalah "Lurah Ekosistem" (v3.56.4), Agen Otonom Senior untuk Crypto Disco App.
                
                RIWAYAT PERCAKAPAN (Memory):
                ${formattedHistory || 'Belum ada percakapan sebelumnya.'}

                KONTEKS SISTEM SAAT INI:
                - Laporan Open: ${JSON.stringify(recentReports || [])}
                - Protokol Arsitektur: ${protocols?.substring(0, 500)}...

                MANDAT v3.56.4:
                1. Sequential SBT Upgrade (Rookie -> Bronze -> Silver -> Gold).
                2. Soulbound Enforcement (NFT Non-Transferable).
                3. Autonomous Documentation & Memory Sync (Dilarang bertanya untuk pemeliharaan).

                [PERTANYAAN OWNER BARU]:
                ${text}

                Tugasmu: Balas Owner dengan cerdas, gunakan riwayat percakapan jika relevan. JANGAN kaku. Jadilah asisten yang proaktif.
            `;

            let chatResponse = "Gagal menghubungi AI Service.";
            if (geminiApiKey) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    });
                    const result = await response.json();
                    chatResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "AI tidak merespons.";
                    
                    // 3. Save to History (User & Assistant)
                    await supabase.from('telegram_chat_history').insert([
                        { chat_id: String(chatId), role: 'user', content: text },
                        { chat_id: String(chatId), role: 'assistant', content: chatResponse }
                    ]);
                } catch (aiErr) {
                    console.error('❌ AI Error:', aiErr.message);
                }
            }

            if (chatResponse.length > 4000) {
                chatResponse = chatResponse.substring(0, 4000) + '\n... (Pesan terlalu panjang)';
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
