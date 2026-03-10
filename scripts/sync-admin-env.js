import fs from 'fs';
import { execSync } from 'child_process';

function parseEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const env = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
        }
        env[key] = value;
    }
    return env;
}

const localEnv = parseEnv('.env.local');
const keysToSync = [
    'ADMIN_ADDRESS',
    'VITE_ADMIN_ADDRESS',
    'VITE_ADMIN_WALLETS',
    'VITE_ADMIN_FIDS'
];

console.log('--- Syncing Admin Wallet Configuration ---');

for (const key of keysToSync) {
    const value = localEnv[key];
    if (value) {
        console.log(`Syncing ${key}...`);
        const environments = ['production', 'preview'];
        for (const env of environments) {
            try {
                // Remove existing key to ensure update
                try {
                    execSync(`vercel env rm ${key} ${env} -y`, { stdio: 'ignore' });
                } catch (e) {
                    // Ignore if doesn't exist
                }
                
                const cmd = `echo "${value}" | vercel env add ${key} ${env}`;
                execSync(cmd, { stdio: 'inherit' });
                console.log(`  ✅ Synced ${key} to ${env}`);
            } catch (e) {
                console.error(`  ❌ Failed to sync ${key} to ${env}: ${e.message}`);
            }
        }
    } else {
        console.log(`⚠️ ${key} not found in .env.local or is empty.`);
    }
}
