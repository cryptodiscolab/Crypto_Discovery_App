const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../tools/nexus-monitor/nexus-activity.json');

/**
 * Nexus Bridge - Senior Staff Engineer Implementation
 * Menghubungkan aktivitas Agen (Antigravity, Lurah, Qwen, DeepSeek) ke Monitor UI.
 * Menghilangkan "Protokol Kertas" dan menggantinya dengan data fungsional.
 */
function logActivity(agent, message, code = null) {
    try {
        let logs = [];
        if (fs.existsSync(LOG_FILE)) {
            const content = fs.readFileSync(LOG_FILE, 'utf8');
            logs = JSON.parse(content || '[]');
        }

        const newEntry = {
            id: Date.now(),
            agent: agent, // antigravity, lurah, qwen, deepseek
            message: message,
            code: code,
            timestamp: new Date().toISOString()
        };

        // Simpan 50 log terakhir saja untuk performa
        logs.push(newEntry);
        if (logs.length > 50) logs.shift();

        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
        
        // Console output untuk transparansi terminal
        const icons = { antigravity: '🚀', lurah: '🛡️', qwen: '⚙️', deepseek: '🧠' };
        console.log(`${icons[agent] || '🤖'} [Nexus Bridge] Data Pushed: ${message}`);
    } catch (err) {
        console.error('❌ Nexus Bridge Failure:', err.message);
    }
}

module.exports = { logActivity };
