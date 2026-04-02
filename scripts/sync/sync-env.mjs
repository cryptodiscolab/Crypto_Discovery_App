import fs from 'fs';
import { execSync, spawnSync } from 'child_process';

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
        
        // Remove surrounding quotes if they exist
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
        }
        env[key] = value;
    }
    return env;
}

const localEnv = parseEnv('.env');
// Map missing keys
if (!localEnv['SUPABASE_URL']) localEnv['SUPABASE_URL'] = localEnv['NEXT_PUBLIC_SUPABASE_URL'] || localEnv['VITE_SUPABASE_URL'];
if (!localEnv['SUPABASE_ANON_KEY']) localEnv['SUPABASE_ANON_KEY'] = localEnv['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || localEnv['VITE_SUPABASE_ANON_KEY'];

const keysToSync = [
    'USDC_ADDRESS', 'CREATOR_TOKEN_ADDRESS', 'BASE_SEPOLIA_RPC_URL', 'BASESCAN_API_KEY',
    'OPERATIONS_WALLET', 'TREASURY_WALLET', 'VITE_V12_CONTRACT_ADDRESS_SEPOLIA',
    'VITE_MASTER_X_ADDRESS_SEPOLIA', 'VITE_RAFFLE_ADDRESS_SEPOLIA', 'VITE_CMS_CONTRACT_ADDRESS_SEPOLIA',
    'DAILY_APP_ADDRESS_SEPOLIA', 'MASTER_X_ADDRESS_SEPOLIA', 'RAFFLE_ADDRESS_SEPOLIA',
    'AIRNODE_RRP', 'AIRNODE_ADDRESS', 'ENDPOINT_ID_UINT256', 'SPONSOR_WALLET',
    'PRICE_FEED_ETH_USD', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
    'MAX_GAS_PRICE', 'TICKET_PRICE_USD', 'CHAT_ID', 'GEMINI_API_KEY',
    'PINATA_API_KEY', 'PINATA_API_SECRET', 'PINATA_JWT',
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
    'VITE_V12_CONTRACT_ADDRESS', 'SUPABASE_ACCESS_TOKEN'
];

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
                } catch (e) {}
                
                // Use spawnSync with input to avoid shell echo issues (no newlines, no quotes)
                const result = spawnSync('vercel', ['env', 'add', key, env], {
                    input: value,
                    encoding: 'utf-8',
                    shell: true,
                    stdio: ['pipe', 'inherit', 'pipe']
                });

                if (result.status === 0) {
                    console.log(`  ✅ Synced ${key} to ${env}`);
                } else {
                    console.error(`  ❌ Failed to sync ${key} to ${env}`);
                    if (result.stderr) console.error(`     Error: ${result.stderr}`);
                }
            } catch (e) {
                console.error(`  ❌ Failed to sync ${key} to ${env}: ${e.message}`);
            }
        }
    }
}
