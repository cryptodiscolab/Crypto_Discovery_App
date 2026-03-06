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
    content.split(/\r?\n/).forEach(line => {
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
        {
            label: 'DailyApp V12',
            envKey: 'VITE_V12_CONTRACT_ADDRESS',
            cursorrulesAddr: '0xfc12f4FEFf825860c5145680bde38BF222cC669A'
        },
        {
            label: 'Raffle V2',
            envKey: 'VITE_RAFFLE_ADDRESS',
            cursorrulesAddr: '0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08'
        },
        {
            label: 'MasterX V2',
            envKey: 'VITE_MASTER_X_ADDRESS',
            cursorrulesAddr: '0x78a566a11AcDA14b2A4F776227f61097C7381C84'
        },
        {
            label: 'CMS V2',
            envKey: 'VITE_CMS_CONTRACT_ADDRESS',
            cursorrulesAddr: '0x555D06933CC45038c42a1ba1F74140A5e4E0695d'
        }
    ];

    let hasMismatch = false;

    console.log("\n--- Contract Address Sync ---");
    checkList.forEach(item => {
        const envAddr = env[item.envKey]?.toLowerCase();
        const expectedAddr = item.cursorrulesAddr.toLowerCase();
        const inCursorrules = rulesContent.toLowerCase().includes(expectedAddr);

        if (!envAddr) {
            console.warn(`⚠️ Warning: ${item.envKey} missing in .env`);
        } else if (!inCursorrules) {
            console.warn(`⚠️ Warning: ${item.label} address not found in .cursorrules`);
        } else if (envAddr !== expectedAddr) {
            console.error(`❌ Mismatch [${item.label}]:`);
            console.error(`   .env:         ${envAddr}`);
            console.error(`   .cursorrules: ${expectedAddr}`);
            hasMismatch = true;
        } else {
            console.log(`✅ ${item.label} (${item.envKey}): synchronized`);
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
