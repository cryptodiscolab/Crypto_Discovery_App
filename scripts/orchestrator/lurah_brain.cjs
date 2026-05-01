require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_TOKEN || !TELEGRAM_CHAT) {
    console.error("❌ Missing configuration for Lurah Brain.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getRecentReports() {
    const { data, error } = await supabase
        .from('nexus_agent_reports')
        .select('*')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) throw error;
    return data;
}

async function getVaultContext() {
    const { data, error } = await supabase
        .from('agents_vault')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
    
    if (error) throw error;
    return data;
}

async function sendTelegram(text) {
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT,
                text: text,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error("❌ Telegram failed:", e.message);
    }
}

async function runLurahBrain() {
    console.log("🛰️ Lurah Brain is thinking...");
    
    try {
        const reports = await getRecentReports();
        const context = await getVaultContext();

        if (reports.length === 0) {
            console.log("✅ No open issues found. Lurah is silent.");
            return;
        }

        // Logical Filter: Priority Assessment
        const criticalReports = reports.filter(r => 
            r.error_type === 'SECURITY' || 
            r.error_type === 'DATA_SYNC' || 
            r.error_type === 'DB_SCHEMA' ||
            r.message.includes('error') || 
            r.message.includes('fail')
        );

        if (criticalReports.length === 0) {
            console.log("ℹ️ Only minor reports found. Skipping Telegram spam.");
            return;
        }

        let digest = `🛰️ **LAPORAN INTELIJEN LURAH (v3.56.4)**\n\n`;
        digest += `Ditemukan **${criticalReports.length}** masalah KRUSIAL yang memerlukan perhatian segera:\n\n`;

        criticalReports.forEach(r => {
            const icon = r.error_type === 'SECURITY' || r.error_type === 'DATA_SYNC' ? '🚨' : '⚠️';
            digest += `${icon} **[${r.agent_role}] ${r.error_type}**\n`;
            digest += `> Issue: \`${r.message.substring(0, 200)}...\`\n`;
            digest += `> Target: \`${r.target_file || 'Global System'}\`\n\n`;
        });

        // Add Context from Vault
        if (context.length > 0) {
            digest += `\n📌 **Konteks Terakhir (Vault):**\n`;
            context.forEach(v => {
                digest += `- ${v.task_name} (${v.status})\n`;
            });
        }

        digest += `\n💡 **Saran Lurah:** Segera jalankan audit sinkronisasi database (\`scripts/audits/check_sync_status.cjs\`) untuk memastikan integritas data v3.56.4 tidak terkompromi.`;

        await sendTelegram(digest);
        console.log("✅ Intelligence Digest sent to Telegram.");

    } catch (err) {
        console.error("❌ Lurah Brain Error:", err.message);
    }
}

runLurahBrain();
