/**
 * Robust Vercel Environment Synchronizer (v4.2.0)
 * Syncs ALL keys (public and sensitive) to BOTH Vercel projects:
 *  1. crypto-discovery-app (Frontend + Backend Bundles)
 *  2. dailyapp-verification-server (Verification Telegram Bot Server)
 * 
 * Run: node scripts/sync/robust_sync_vercel.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.join(__dirname, '..', '..');
const SOURCE_ENV_PATH = path.join(ROOT_DIR, '.env');

// Projects Registry
const PROJECTS = [
    { id: 'prj_BdRt129D3z4CuDMppWfb8V84Gqx6', name: 'crypto-discovery-app' },
    { id: 'prj_QLL2cKjNM6JmYKY5NM8MrPHX4NWV', name: 'dailyapp-verification-server' }
];

const TEAM_ID = 'team_cGQwJrMBFOXFUfCzkPlSR7UF';
const ENVIRONMENTS = ['production', 'preview', 'development'];

const SENSITIVE_KEY_PATTERN = /(PRIVATE|SECRET|TOKEN|KEY|PASSWORD|DATABASE_URL|SIGNER|JWT|API_SECRET|BEARER)/i;

function maskEnvValue(key, value) {
    const text = String(value || '');
    if (!text) return '[EMPTY]';
    if (SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]';
    return `${text.substring(0, 35)}${text.length > 35 ? '...' : ''}`;
}

// Keys Registry to synchronize
const KEYS_TO_SYNC = [
    // Blockchain & Contracts
    'PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'VERIFIER_PRIVATE_KEY', 'VITE_DEPLOYER_PRIVATE_KEY',
    'BASESCAN_API_KEY', 'ALCHEMY_API_KEY', 'VITE_ALCHEMY_API_KEY',
    'DAILY_APP_ADDRESS', 'DAILY_APP_ADDRESS_SEPOLIA', 'NEXT_PUBLIC_DAILY_APP_ADDRESS', 'VITE_DAILY_APP_ADDRESS', 'VITE_DAILY_APP_V16_ADDRESS',
    'MASTER_X_ADDRESS', 'MASTER_X_ADDRESS_SEPOLIA', 'NEXT_PUBLIC_MASTER_X_ADDRESS', 'VITE_MASTER_X_ADDRESS', 'VITE_MASTER_X_ADDRESS_SEPOLIA',
    'RAFFLE_ADDRESS', 'RAFFLE_ADDRESS_SEPOLIA', 'NEXT_PUBLIC_RAFFLE_ADDRESS', 'VITE_RAFFLE_ADDRESS', 'VITE_RAFFLE_ADDRESS_SEPOLIA',
    'VITE_V12_CONTRACT_ADDRESS', 'VITE_V12_CONTRACT_ADDRESS_SEPOLIA',
    'VITE_CMS_CONTRACT_ADDRESS', 'VITE_CMS_CONTRACT_ADDRESS_SEPOLIA',
    'USDC_ADDRESS', 'VITE_USDC_ADDRESS', 'CREATOR_TOKEN_ADDRESS', 'VITE_CREATOR_TOKEN_ADDRESS',
    'PRICE_FEED_ETH_USD', 'VITE_PRICE_FEED_ADDRESS', 'VITE_TREASURY_ADDRESS', 'TREASURY_WALLET', 'OPERATIONS_WALLET', 'VITE_VERIFIER_ADDRESS',
    'AIRNODE_RRP', 'AIRNODE_ADDRESS', 'ENDPOINT_ID_UINT256', 'SPONSOR_WALLET',
    
    // Supabase
    'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL',
    'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SERVICE_ROLE_KEY',
    'DATABASE_URL', 'DATABASE_PASSWORD', 'POSTGRES_PASSWORD', 'POSTGRES_USER', 'POSTGRES_HOST', 'POSTGRES_DATABASE',
    
    // Social APIs (Neynar, Twitter, Telegram)
    'NEYNAR_API_KEY', 'VITE_NEYNAR_API_KEY', 'NEYNAR_CLIENT_ID', 'VITE_NEYNAR_CLIENT_ID', 'NEYNAR_SIGNER_UUID', 'VITE_NEYNAR_SIGNER_UUID',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'CHAT_ID', 'TELEGRAM_ALLOWED_CHAT_IDS', 'TELEGRAM_GROUP_CHAT_ID',
    'X_MONASQUE_BEARER_TOKEN', 'X_MONASQUE_CLIENT_ID', 'X_MONASQUE_CLIENT_SECRET',
    'TWITTER_BEARER_TOKEN', 'TWITTER_API_KEY', 'TWITTER_API_SECRET',
    
    // Others & Secret Keys
    'GEMINI_API_KEY', 'PINATA_API_KEY', 'PINATA_API_SECRET', 'PINATA_JWT',
    'ONCHAINKIT_API_KEY', 'VITE_ONCHAINKIT_API_KEY',
    'REOWN_PROJECT_ID', 'VITE_REOWN_PROJECT_ID', 'VITE_WALLETCONNECT_PROJECT_ID',
    'JWT_SECRET', 'API_SECRET', 'VITE_VERIFY_API_SECRET', 'CRON_SECRET',
    'VERCEL_TOKEN', 'SUPABASE_ACCESS_TOKEN', 'WALLET_BOT_SIGNER',
    
    // Business Logic Settings
    'VITE_CHAIN_ID', 'CHAIN_ID', 'TICKET_PRICE_USD', 'MAX_GAS_PRICE'
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

const localEnv = parseEnv(SOURCE_ENV_PATH);
const VERCEL_TOKEN = localEnv.VERCEL_TOKEN || process.env.VERCEL_TOKEN;

if (!VERCEL_TOKEN) {
    console.error('❌ VERCEL_TOKEN required. Set VERCEL_TOKEN in root .env or environment variable.');
    process.exit(1);
}

// Fallback mappings for aliases
if (!localEnv['SUPABASE_URL']) localEnv['SUPABASE_URL'] = localEnv['VITE_SUPABASE_URL'] || localEnv['NEXT_PUBLIC_SUPABASE_URL'];
if (!localEnv['SUPABASE_ANON_KEY']) localEnv['SUPABASE_ANON_KEY'] = localEnv['VITE_SUPABASE_ANON_KEY'] || localEnv['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
if (!localEnv['SUPABASE_SECRET_KEY']) localEnv['SUPABASE_SECRET_KEY'] = localEnv['SUPABASE_SERVICE_ROLE_KEY'];
if (!localEnv['CONTRACT_ADDRESS']) localEnv['CONTRACT_ADDRESS'] = localEnv['VITE_DAILY_APP_V16_ADDRESS'] || localEnv['DAILY_APP_ADDRESS_SEPOLIA'];

function apiRequest(method, projectId, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : undefined;
        const options = {
            hostname: 'api.vercel.com',
            path: `${path}?teamId=${TEAM_ID}`,
            method,
            headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
            },
        };
        const req = https.request(options, (res) => {
            let resBody = '';
            res.on('data', (chunk) => resBody += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(resBody) });
                } catch {
                    resolve({ status: res.statusCode, data: resBody });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getExistingEnvs(projectId) {
    const res = await apiRequest('GET', projectId, `/v10/projects/${projectId}/env`);
    if (res.status !== 200) {
        throw new Error(`Failed to list env vars: ${res.status} ${JSON.stringify(res.data)}`);
    }
    return res.data.envs || [];
}

async function deleteEnv(projectId, envId) {
    const res = await apiRequest('DELETE', projectId, `/v10/projects/${projectId}/env/${envId}`);
    if (res.status !== 200) {
        console.warn(`  ⚠️ Failed to delete env ${envId}: ${res.status}`);
    }
}

async function createEnv(projectId, key, value, target) {
    const res = await apiRequest('POST', projectId, `/v10/projects/${projectId}/env`, {
        key,
        value,
        target,
        type: 'plain',
    });
    if (res.status !== 201 && res.status !== 200) {
        throw new Error(`Failed to create ${key}: ${res.status} ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

async function syncProject(project) {
    console.log(`\n--------------------------------------------`);
    console.log(`🔄 Syncing Project: ${project.name} (${project.id})`);
    console.log(`--------------------------------------------`);

    // 1. List existing env vars
    console.log('Fetching existing Vercel env vars...');
    const existing = await getExistingEnvs(project.id);
    console.log(`  Found ${existing.length} existing env vars on Vercel.`);

    // 2. Group existing by key
    const existingByKey = {};
    for (const env of existing) {
        if (!existingByKey[env.key]) existingByKey[env.key] = [];
        existingByKey[env.key].push(env);
    }

    // 3. Sync each registered key
    let updated = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const key of KEYS_TO_SYNC) {
        const value = localEnv[key];
        if (value === undefined) {
            skipped++;
            continue;
        }

        try {
            // Delete existing entries for this key (all environments)
            if (existingByKey[key]) {
                for (const env of existingByKey[key]) {
                    await deleteEnv(project.id, env.id);
                    await sleep(350);
                }
            }

            // Create new entry for all environments
            await createEnv(project.id, key, value, ENVIRONMENTS);
            await sleep(350);

            if (existingByKey[key]) {
                console.log(`  ✅ Updated: ${key} → ${maskEnvValue(key, value)}`);
                updated++;
            } else {
                console.log(`  ✅ Created: ${key} → ${maskEnvValue(key, value)}`);
                created++;
            }
        } catch (err) {
            console.error(`  ❌ Error syncing key ${key}: ${err.message}`);
            errors++;
        }
    }

    console.log(`\nProject ${project.name} Sync Complete:`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ⏭️  Skipped (not in .env): ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    
    return errors === 0;
}

async function main() {
    console.log('🚀 Starting Robust Vercel Multi-Project Environment Sync...');
    console.log(`Source env path: ${SOURCE_ENV_PATH}`);
    console.log(`Total registry keys: ${KEYS_TO_SYNC.length}`);
    
    let allOk = true;
    for (const project of PROJECTS) {
        const ok = await syncProject(project);
        if (!ok) allOk = false;
    }
    
    console.log('\n============================================');
    if (allOk) {
        console.log('🎉 SUCCESS: All projects synchronized successfully!');
        console.log('👉 Please redeploy the Vercel projects to apply the changes.');
    } else {
        console.warn('⚠️ WARNING: Sync completed with some errors. See logs above.');
    }
    console.log('============================================');
}

main().catch(err => {
    console.error('Fatal Error:', err.message);
    process.exit(1);
});
