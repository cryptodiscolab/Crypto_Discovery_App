const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase configuration");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const STALE_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours

async function runHealthBot() {
    console.log("📡 [Health Bot] Starting ecosystem pulse-check...");

    try {
        const { data: services, error } = await supabase
            .from('system_health')
            .select('*');

        if (error) throw error;
        if (!services || services.length === 0) {
            console.log("⚠️ No services found in system_health.");
            return;
        }

        const now = Date.now();
        let issuesFound = 0;

        for (const svc of services) {
            const lastHb = new Date(svc.last_heartbeat).getTime();
            const isStale = (now - lastHb) > STALE_THRESHOLD;
            const isFailed = svc.status === 'failed';
            const isRecovering = svc.status === 'recovering';
            const consecutive = svc.metadata?.consecutive_success || 0;

            if (isRecovering) {
                console.log(`🩹 Service ${svc.service_key} is in RECOVERY mode (${consecutive}/3).`);
            }

            // Detection for "Just Recovered" (Healthy but was recently recovering)
            if (svc.status === 'healthy' && svc.metadata?.last_recovery_at) {
                const recoveredAt = new Date(svc.metadata.last_recovery_at).getTime();
                if (now - recoveredAt < 10 * 60 * 1000) { // If recovered in last 10 mins
                     // Logic to send "Recovery" alert only once could be added here
                     // For now, let's focus on Failure/Stale
                }
            }

            if (isStale || isFailed) {
                issuesFound++;
                const alertType = isFailed ? 'FAILURE' : 'STALE_HEARTBEAT';
                const emoji = isFailed ? '🚨' : '⚠️';
                const message = `${emoji} **NEXUS HEALTH ALERT: ${svc.service_key}**\n\n` +
                                `Status: \`${svc.status}\`${isStale ? ' (STALE)' : ''}\n` +
                                `Last Seen: \`${svc.last_heartbeat}\`\n` +
                                `Error: \`${svc.last_error || 'No error message'}\`\n\n` +
                                `👉 [Admin Dashboard](${process.env.VITE_VERIFY_SERVER_URL || 'https://crypto-disco-raffle.vercel.app'}/admin)`;
                
                console.warn(`🚨 ALERT: ${message}`);

                // Send Telegram Alert
                await sendTelegramAlert(message);

                // Log to Admin Audit Logs
                await supabase.from('admin_audit_logs').insert({
                    admin_address: 'SYSTEM_BOT',
                    action: `HEALTH_ALERT_${alertType}`,
                    details: {
                        service_key: svc.service_key,
                        status: svc.status,
                        last_heartbeat: svc.last_heartbeat,
                        error: svc.last_error,
                        message: message
                    }
                });
            }
        }

        if (issuesFound === 0) {
            console.log("✅ All systems operational. 0 issues detected.");
        } else {
            console.log(`📡 [Health Bot] Scan complete. ${issuesFound} issues flagged.`);
        }

    } catch (err) {
        console.error("❌ Health Bot Error:", err.message);
        process.exit(1);
    }
}

async function sendTelegramAlert(text) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        console.warn("⚠️ Telegram alert skipped: Missing configuration");
        return;
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown'
            })
        });
        const result = await res.json();
        if (!result.ok) console.error("❌ Telegram API error:", result.description);
        else console.log("📡 Telegram alert sent successfully.");
    } catch (e) {
        console.error("❌ Failed to send Telegram alert:", e.message);
    }
}

runHealthBot();
