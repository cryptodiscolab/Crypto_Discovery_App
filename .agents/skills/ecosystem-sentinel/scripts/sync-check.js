import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        // --- BASE MAINNET ---
        {
            label: 'DailyApp V12 (Mainnet)',
            envKey: 'VITE_V12_CONTRACT_ADDRESS',
            cursorrulesAddr: '[RESERVED]',
            required: true
        },
        // --- BASE SEPOLIA ---
        {
            label: 'DailyApp V12 (Sepolia)',
            envKey: 'VITE_V12_CONTRACT_ADDRESS_SEPOLIA',
            cursorrulesAddr: '0xaC430adE9217e2280b852EA29b91d14b12b3E151',
            required: true
        },
        {
            label: 'Raffle V2 (Sepolia)',
            envKey: 'VITE_RAFFLE_ADDRESS_SEPOLIA',
            cursorrulesAddr: '0x012FAdd087540e1B51a587f420e77D007fED2a84',
            required: true
        },
        {
            label: 'MasterX V2 (Sepolia)',
            envKey: 'VITE_MASTER_X_ADDRESS_SEPOLIA',
            cursorrulesAddr: '0x1ED8B135F01522505717D1E620c4EF869D7D25e7',
            required: true
        },
        {
            label: 'CMS V2 (Sepolia)',
            envKey: 'VITE_CMS_CONTRACT_ADDRESS_SEPOLIA',
            cursorrulesAddr: '0x8D5ef43A69DDc9f9d4bCc6dF3DcCcDBEDa53A302',
            required: true
        }
    ];

    let hasMismatch = false;

    console.log("\n--- Contract Address Sync ---");
    checkList.forEach(item => {
        const envValue = env[item.envKey];
        const envAddr = envValue?.toLowerCase();
        const expectedAddr = item.cursorrulesAddr.toLowerCase();
        const inCursorrules = rulesContent.toLowerCase().includes(expectedAddr);

        if (!envAddr) {
            if (item.required) {
                console.warn(`⚠️ Warning: ${item.envKey} missing in .env`);
            }
        } else if (envValue === '[RESERVED]') {
            console.log(`ℹ️ ${item.label}: [RESERVED]`);
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
        console.log("\n✨ Ecosystem is fully synchronized across networks!");
    }
}

auditSync();
