const fs = require('fs');
const path = require('path');

/**
 * Ecosystem Sync Validator
 * Memeriksa keselarasan antara .env dan .cursorrules
 */

const ROOT_DIR = path.resolve(__dirname, '../../../../');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const RULES_PATH = path.join(ROOT_DIR, '.cursorrules');

function parseEnv(content) {
    const env = {};
    content.split('\n').forEach(line => {
        // Match key=value, ignoring comments and handling optional quotes
        const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove trailing comments if any
            value = value.split('#')[0].trim();
            // Remove quotes
            value = value.replace(/^['"]|['"]$/g, '');
            env[key] = value;
        }
    });
    return env;
}

function auditSync() {
    console.log("🚀 Starting Ecosystem Sync Audit...");

    if (!fs.existsSync(ENV_PATH)) {
        console.error("❌ Error: .env file not found at " + ENV_PATH);
        return;
    }
    if (!fs.existsSync(RULES_PATH)) {
        console.error("❌ Error: .cursorrules file not found at " + RULES_PATH);
        return;
    }

    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');
    const env = parseEnv(envContent);

    const checkList = [
        { key: 'VITE_DAILY_APP_ADDRESS', label: 'DailyApp V12', envKey: 'VITE_DAILY_APP_ADDRESS' },
        { key: 'VITE_RAFFLE_ADDRESS', label: 'Raffle V2', envKey: 'VITE_RAFFLE_ADDRESS' }
    ];

    let hasMismatch = false;

    console.log("\n--- Contract Address Sync ---");
    checkList.forEach(item => {
        const envAddr = env[item.envKey]?.toLowerCase();
        // Simple regex to find the address in .cursorrules
        const ruleRegex = new RegExp(`${item.key}\\s*[:=]\\s*(0x[a-fA-F0-9]{40})`, 'i');
        const ruleMatch = rulesContent.match(ruleRegex);
        const ruleAddr = ruleMatch ? ruleMatch[1].toLowerCase() : null;

        if (!envAddr) {
            console.warn(`⚠️ Warning: ${item.envKey} missing in .env`);
        } else if (!ruleAddr) {
            console.warn(`⚠️ Warning: ${item.key} missing in .cursorrules`);
        } else if (envAddr !== ruleAddr) {
            console.error(`❌ Mismatch [${item.label}]:`);
            console.error(`   .env:         ${envAddr}`);
            console.error(`   .cursorrules: ${ruleAddr}`);
            hasMismatch = true;
        } else {
            console.log(`✅ ${item.label} synchronized: ${envAddr}`);
        }
    });

    if (hasMismatch) {
        console.log("\n🚨 ACTION REQUIRED: Update .cursorrules or .env to match the current deployment.");
        process.exit(1);
    } else {
        console.log("\n✨ Ecosystem is fully synchronized!");
    }
}

auditSync();
