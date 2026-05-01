const fs = require('fs');
const path = require('path');

/**
 * Global Ecosystem Environment Synchronizer (v4.1.0)
 * Source of Truth: .env (root)
 */

const SYNC_REGISTRY = [
    // --- Infrastructure & Secrets ---
    'PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'VERIFIER_PRIVATE_KEY', 'VITE_DEPLOYER_PRIVATE_KEY',
    'BASESCAN_API_KEY', 'ALCHEMY_API_KEY', 'VITE_ALCHEMY_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL',
    'DATABASE_URL', 'DATABASE_PASSWORD',
    'POSTGRES_PASSWORD', 'POSTGRES_USER', 'POSTGRES_HOST', 'POSTGRES_DATABASE',
    'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_PRISMA_URL',
    'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5',
    'GEMINI_API_KEY_6', 'GEMINI_API_KEY_7', 'GEMINI_API_KEY_8', 'GEMINI_API_KEY_9',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'CHAT_ID',
    'PINATA_API_KEY', 'PINATA_API_SECRET', 'PINATA_JWT',
    'NEYNAR_API_KEY', 'VITE_NEYNAR_API_KEY', 'NEYNAR_CLIENT_ID', 'VITE_NEYNAR_CLIENT_ID',
    'ONCHAINKIT_API_KEY', 'VITE_ONCHAINKIT_API_KEY',
    'REOWN_PROJECT_ID', 'VITE_REOWN_PROJECT_ID', 'VITE_WALLETCONNECT_PROJECT_ID',
    'AIRNODE_ADDRESS', 'AIRNODE_RRP', 'ENDPOINT_ID_UINT256', 'SPONSOR_WALLET',
    'JWT_SECRET', 'API_SECRET', 'VITE_VERIFY_API_SECRET', 'CRON_SECRET',
    'VERCEL_TOKEN', 'MCP_SUPABASE_ACCESS_TOKEN', 'MCP_GITHUB_PAT',
    'SUPABASE_ACCESS_TOKEN',

    // --- Contract Registry (Critical for Sync) ---
    'DAILY_APP_ADDRESS', 'DAILY_APP_ADDRESS_SEPOLIA', 'NEXT_PUBLIC_DAILY_APP_ADDRESS',
    'MASTER_X_ADDRESS', 'MASTER_X_ADDRESS_SEPOLIA', 'NEXT_PUBLIC_MASTER_X_ADDRESS',
    'RAFFLE_ADDRESS', 'RAFFLE_ADDRESS_SEPOLIA', 'NEXT_PUBLIC_RAFFLE_ADDRESS', 'VITE_RAFFLE_ADDRESS', 'VITE_RAFFLE_ADDRESS_SEPOLIA',
    'VITE_V12_CONTRACT_ADDRESS_SEPOLIA', 'VITE_MASTER_X_ADDRESS_SEPOLIA', 'VITE_CMS_CONTRACT_ADDRESS_SEPOLIA',
    'VITE_CMS_CONTRACT_ADDRESS', 'PRICE_FEED_ETH_USD', 'VITE_TREASURY_ADDRESS', 'TREASURY_WALLET', 'OPERATIONS_WALLET',
    'USDC_ADDRESS', 'VITE_USDC_ADDRESS', 'CREATOR_TOKEN_ADDRESS', 'VITE_CREATOR_TOKEN_ADDRESS',

    // --- Admin & Governance ---
    'ADMIN_ADDRESS', 'VITE_ADMIN_ADDRESS', 'VITE_ADMIN_WALLETS', 'VITE_ADMIN_FIDS',
    
    // --- Business Logic & Fees ---
    'TICKET_PRICE_USD', 'MAX_GAS_PRICE'
];

const KEY_MAPPINGS = {
    'POSTGRES_PASSWORD': 'DATABASE_PASSWORD',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY': 'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_URL': 'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL': 'SUPABASE_URL',
    'VITE_NEYNAR_API_KEY': 'NEYNAR_API_KEY',
    'VITE_ALCHEMY_API_KEY': 'ALCHEMY_API_KEY',
    'RAFFLE_ADDRESS': 'VITE_RAFFLE_ADDRESS',
    'MASTER_X_ADDRESS': 'VITE_MASTER_X_ADDRESS',
    'DAILY_APP_ADDRESS': 'DAILY_APP_ADDRESS_SEPOLIA', // Fallback to Sepolia if Mainnet is reserved
    'NEXT_PUBLIC_DAILY_APP_ADDRESS': 'DAILY_APP_ADDRESS_SEPOLIA',
    'NEXT_PUBLIC_MASTER_X_ADDRESS': 'MASTER_X_ADDRESS_SEPOLIA',
    'VITE_CONTRACT_ADDRESS': 'DAILY_APP_ADDRESS_SEPOLIA',
    'VITE_MASTER_X_ADDRESS': 'MASTER_X_ADDRESS_SEPOLIA',
    'VITE_RAFFLE_ADDRESS': 'VITE_RAFFLE_ADDRESS_SEPOLIA'
};

const TARGET_FILES = [
    '.env',
    '.env.example',
    '.env.vercel',
    '.env.vercel.preview',
    '.env.vercel.production',
    '.env.verification.vercel',
    'Raffle_Frontend/.env',
    'Raffle_Frontend/.env.local',
    'Raffle_Frontend/.env.prod.vercel',
    'Raffle_Frontend/.env.vercel',
    'Raffle_Frontend/.env.vercel.live',
    'Raffle_Frontend/.env.vercel.preview',
    'Raffle_Frontend/.env.vercel.preview.check',
    'Raffle_Frontend/.env.vercel.prod',
    'Raffle_Frontend/.env.vercel.production',
    'Raffle_Frontend/.env.vercel.production.check'
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

function sync() {
    console.log('🔄 Starting Global Ecosystem Environment Sync (v4.1.0)...');
    
    const rootPath = process.cwd();
    const sourceEnvPath = path.join(rootPath, '.env');
    const sourceEnv = parseEnv(sourceEnvPath);
    
    if (Object.keys(sourceEnv).length === 0) {
        console.error('❌ Source .env not found or empty!');
        return;
    }

    TARGET_FILES.forEach(relativeFile => {
        const filePath = path.join(rootPath, relativeFile);
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ Skipping missing file: ${relativeFile}`);
            return;
        }

        console.log(`📂 Syncing ${relativeFile}...`);
        let content = fs.readFileSync(filePath, 'utf8');
        const isExample = relativeFile.endsWith('.env.example');
        
        let updatedCount = 0;

        SYNC_REGISTRY.forEach(key => {
            let masterValue = sourceEnv[key];
            
            // Try mapping if not found directly
            if (masterValue === undefined && KEY_MAPPINGS[key]) {
                masterValue = sourceEnv[KEY_MAPPINGS[key]];
            }

            if (masterValue === undefined) return;

            const displayValue = isExample ? `your_${key.toLowerCase()}_here` : masterValue;
            
            // Regex to match the entire line starting with the key
            const regex = new RegExp(`^${key}\\s*=.*$`, 'm');
            
            if (regex.test(content)) {
                // Determine if we should quote the value
                // Avoid quoting if it's a simple alphanumeric string unless it's an example
                const needsQuotes = isExample || masterValue.includes(' ') || masterValue.includes('"') || masterValue.includes('#');
                const formattedValue = needsQuotes ? `"${displayValue}"` : displayValue;
                
                content = content.replace(regex, `${key}=${formattedValue}`);
                updatedCount++;
            }
        });

        // Clean up messy artifacts like duplicated values or weird literals
        content = content.replace(/\\r\\n/g, '')
                        .replace(/\\r/g, '')
                        .replace(/\\n/g, '')
                        .replace(/""/g, '""') // Keep empty quotes as they are
                        .replace(/" "/g, '')
                        .trim() + '\n';

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ Updated ${updatedCount} keys.`);
    });

    console.log('\n✨ Global Sync Complete!');
}

sync();
