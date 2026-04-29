const { generateMap } = require('./ncc-generator.cjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const STATE_FILE = path.join(__dirname, '../../.agents/tools/ncc/sentinel-state.json');
const INTERVAL_MS = 60000; // 60 seconds

// Telegram Config
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(text) {
    if (!BOT_TOKEN || !CHAT_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error("❌ Failed to send Telegram alert:", e.message);
    }
}

async function runSentinel() {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🛰️  Sentinel Heartbeat...`);
    
    try {
        const data = await generateMap();
        let state = { lastStatus: "UNKNOWN", seenAlerts: [] };
        
        if (fs.existsSync(STATE_FILE)) {
            state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        }

        const newAlerts = data.alerts.filter(a => !state.seenAlerts.includes(a.msg));
        const statusChanged = data.status !== state.lastStatus;

        // 1. Handle Status Change (Recovery or Degradation)
        if (statusChanged) {
            const icon = data.status === "HEALTHY" ? "🟢" : (data.status === "CRITICAL" ? "🔴" : "🟡");
            let msg = `${icon} **NEXUS SYSTEM UPDATE**\n\n`;
            msg += `Status: \`${state.lastStatus}\` ➡️ **\`${data.status}\`**\n`;
            msg += `Time: \`${new Date().toLocaleString()}\`\n\n`;
            
            if (data.status === "HEALTHY") {
                msg += `✅ All systems have recovered and are now nominal.`;
            } else {
                msg += `⚠️ Issues have been detected requiring attention.`;
            }
            
            await sendTelegram(msg);
        }

        // 2. Handle New Critical Alerts
        for (const alert of newAlerts) {
            const icon = alert.level === "RED" ? "🚨" : "⚠️";
            let msg = `${icon} **NEW NEXUS ALERT** [${alert.area}]\n\n`;
            msg += `Issue: \`${alert.msg}\`\n`;
            msg += `Priority: \`${alert.level}\`\n\n`;
            msg += `👉 Check the [Nexus Command Center](https://crypto-disco-raffle.vercel.app/admin) for details.`;
            
            await sendTelegram(msg);
        }

        // Update State
        fs.writeFileSync(STATE_FILE, JSON.stringify({
            lastStatus: data.status,
            seenAlerts: data.alerts.map(a => a.msg),
            lastRun: new Date().toISOString()
        }, null, 2));

        console.log(`✅ Sentinel Cycle Complete. Status: ${data.status} | Alerts: ${data.alerts.length}`);
        
    } catch (err) {
        console.error(`❌ Sentinel Error: ${err.message}`);
        await sendTelegram(`💀 **SENTINEL CRASHED**\n\nError: \`${err.message}\``);
    }
}

console.log(`======================================================`);
console.log(`🛰️  REAL-TIME NEXUS SENTINEL ACTIVATED`);
console.log(`🔄  Monitoring Interval: ${INTERVAL_MS/1000}s`);
console.log(`📢  Telegram Alerts: ${BOT_TOKEN ? 'ENABLED' : 'DISABLED'}`);
console.log(`======================================================`);

// Initial run
runSentinel();

// Persistence
setInterval(runSentinel, INTERVAL_MS);
