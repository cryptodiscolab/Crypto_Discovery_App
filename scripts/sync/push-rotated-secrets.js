import fs from 'fs';
import { execSync, spawnSync } from 'child_process';

const rotatedKeys = [
    // CDP & Builder Code
    'VITE_ONCHAINKIT_API_KEY', 'CDP_API_SECRET', 'VITE_BUILDER_CODE', 'VITE_BASE_BUILDER_API_KEY'
];

function parseEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.replace(/\r/g, '').split('\n');
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

const rootEnv = parseEnv('.env');

const envs = ['production', 'preview', 'development'];

const projects = [
    { name: 'crypto-discovery-app' },
    { name: 'dailyapp-verification-server' }
];

console.log('🚀 Pushing Rotated Secrets to Vercel...');

for (const project of projects) {
    console.log(`\n📂 Project: ${project.name}`);
    try {
        execSync(`vercel link --project ${project.name} --yes`, { stdio: 'ignore', env: { ...process.env, CI: '1' } });
    } catch (e) {
        console.warn(`  ⚠️ Failed to link ${project.name}. Ensure VERCEL_TOKEN is valid.`);
    }

    for (const key of rotatedKeys) {
        let val = rootEnv[key];
        
        // Specific mapping for verification server
        if (project.name === 'dailyapp-verification-server' && key.startsWith('VITE_')) continue; // verification server doesn't use VITE_ prefix much except for frontend syncs, but let's just attempt it if it exists in .env

        let finalKey = key;

        if (!val && rootEnv[`VITE_${key}`]) {
             val = rootEnv[`VITE_${key}`];
        }

        if (!val) {
            continue;
        }

        console.log(`  🔄 Syncing ${finalKey}...`);
        
        for (const envMode of envs) {
            try {
                execSync(`vercel env rm ${finalKey} ${envMode} --yes`, { stdio: 'ignore', env: { ...process.env, CI: '1' } });
            } catch (e) {}

            try {
                // Escape quotes for bash/powershell if necessary, but since this runs under Node we can escape double quotes.
                const safeVal = val.replace(/"/g, '\\"');
                execSync(`vercel env add ${finalKey} ${envMode} --value "${safeVal}" --yes`, {
                    stdio: 'ignore',
                    env: { ...process.env, CI: '1', VERCEL_FORCE_NON_INTERACTIVE: '1' }
                });

                console.log(`    ✅ ${envMode}`);
            } catch (e) {
                console.log(`    ❌ ${envMode} Error`);
            }
        }
    }
}

console.log('\n✅ Push Completed!');
