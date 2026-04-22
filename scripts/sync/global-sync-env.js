import fs from 'fs';
import { execSync, spawnSync } from 'child_process';

/**
 * Global Ecosystem Synchronization Script (v3.17.0)
 * Adheres to: Multi-Project Sync Mandate & Clean-Pipe Sync Protocol
 */

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

const rootEnv = parseEnv('.env');

// Projects Configuration
const projects = [
    {
        name: 'crypto-discovery-app',
        mapping: (key, val) => ({ key, val }) // Direct mapping
    },
    {
        name: 'dailyapp-verification-server',
        mapping: (key, val) => {
            // Mapping for verification server specific keys
            if (key === 'DAILY_APP_ADDRESS_SEPOLIA') return { key: 'CONTRACT_ADDRESS', val };
            if (key === 'PRIVATE_KEY') return { key: 'VERIFIER_PRIVATE_KEY', val };
            if (key === 'BASE_SEPOLIA_RPC_URL') return { key: 'RPC_URL', val };
            return { key, val };
        }
    }
];

const keysToSync = [
    // Blockchain
    'USDC_ADDRESS', 'CREATOR_TOKEN_ADDRESS', 'BASE_SEPOLIA_RPC_URL', 'BASESCAN_API_KEY',
    'OPERATIONS_WALLET', 'TREASURY_WALLET', 
    'VITE_V12_CONTRACT_ADDRESS', 'VITE_V12_CONTRACT_ADDRESS_SEPOLIA',
    'MASTER_X_ADDRESS', 'VITE_MASTER_X_ADDRESS_SEPOLIA', 
    'RAFFLE_ADDRESS_SEPOLIA', 'VITE_RAFFLE_ADDRESS_SEPOLIA',
    'VITE_CMS_CONTRACT_ADDRESS_SEPOLIA', 'DAILY_APP_ADDRESS_SEPOLIA', 
    'MASTER_X_ADDRESS_SEPOLIA', 'PRICE_FEED_ETH_USD',
    'PRIVATE_KEY',
    
    // Supabase
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
    'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
    'SUPABASE_ACCESS_TOKEN',
    
    // Telegram / AI
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'GEMINI_API_KEY', 'CHAT_ID',
    
    // Pinata
    'PINATA_API_KEY', 'PINATA_API_SECRET', 'PINATA_JWT',
    
    // Admin / Social
    'ADMIN_ADDRESS', 'VITE_ADMIN_ADDRESS', 'VITE_ADMIN_WALLETS',
    'NEYNAR_API_KEY',
    
    // System
    'TICKET_PRICE_USD', 'MAX_GAS_PRICE',
    
    // Security / Cron (Verification Server)
    'JWT_SECRET', 'API_SECRET', 'CRON_SECRET'
];

async function sync() {
    console.log('🚀 Starting Global Ecosystem Environment Sync...');
    
    for (const project of projects) {
        console.log(`\n📂 Project: ${project.name}`);
        
        // Link project before syncing
        try {
            console.log(`  🔗 Linking project ${project.name}...`);
            execSync(`vercel link --project ${project.name} --yes`, { stdio: 'inherit' });
        } catch (e) {
            console.warn(`  ⚠️ Warning during linking: ${e.message}`);
        }

        for (const rootKey of keysToSync) {
            const rootValue = rootEnv[rootKey];
            if (rootValue === undefined || rootValue === '') continue;

            const { key, val } = project.mapping(rootKey, rootValue);
            
            console.log(`  🔄 Syncing ${key} (${rootKey})...`);
            
            const envs = ['production', 'preview'];
            for (const env of envs) {
                try {
                    // Remove existing key to ensure update
                    try {
                        execSync(`vercel env rm ${key} ${env} -y`, { stdio: 'ignore' });
                    } catch (e) {}
                    
                    // Adheres to Clean-Pipe Sync Protocol v3.16.0
                    const result = spawnSync('vercel', ['env', 'add', key, env, '--yes'], {
                        input: val,
                        encoding: 'utf-8',
                        shell: true,
                        stdio: ['pipe', 'inherit', 'pipe']
                    });

                    if (result.status === 0) {
                        console.log(`    ✅ Synced to ${env}`);
                    } else {
                        console.error(`    ❌ Failed to sync to ${env}`);
                    }
                } catch (e) {
                    console.error(`    ❌ Error syncing ${key} to ${env}: ${e.message}`);
                }
            }
        }
    }
    
    console.log('\n✅ Global Ecosystem Sync Complete!');
}

sync();
