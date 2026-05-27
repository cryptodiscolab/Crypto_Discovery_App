/**
 * Sync critical environment variables to Vercel project
 * Uses Vercel REST API to upsert env vars for all environments
 * 
 * Run: node scripts/sync/sync_vercel_envs.cjs
 */
'use strict';

const https = require('https');

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
if (!VERCEL_TOKEN) {
    console.error('❌ VERCEL_TOKEN env var required. Get from: https://vercel.com/account/tokens');
    process.exit(1);
}
const PROJECT_ID = 'prj_BdRt129D3z4CuDMppWfb8V84Gqx6';
const TEAM_ID = 'team_cGQwJrMBFOXFUfCzkPlSR7UF';
const ENVIRONMENTS = ['production', 'preview', 'development'];

// The env vars to upsert — key/value pairs
const ENV_VARS = {
    // ✅ Fixed malformed addresses (were embedding key name in value)
    VITE_DAILY_APP_ADDRESS: '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353',
    VITE_MASTER_X_ADDRESS: '0x1b573DdD9a1679505ae64498564523222c758EC2',
    RAFFLE_ADDRESS: '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7',

    // ✅ Added missing V16 primary key
    VITE_DAILY_APP_V16_ADDRESS: '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353',

    // ✅ Sepolia-specific addresses
    VITE_MASTER_X_ADDRESS_SEPOLIA: '0x1b573DdD9a1679505ae64498564523222c758EC2',
    VITE_V12_CONTRACT_ADDRESS_SEPOLIA: '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353',
    VITE_RAFFLE_ADDRESS: '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7',
    VITE_RAFFLE_ADDRESS_SEPOLIA: '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7',
    VITE_CMS_CONTRACT_ADDRESS_SEPOLIA: '0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC',

    // ✅ Missing VITE_ prefixed config
    VITE_REOWN_PROJECT_ID: '5ae6de312908f2d0cd512576920b78cd',
    VITE_SUPABASE_URL: 'https://rbgzwhsdqnhwrwimjjfm.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_oFA-r_qXEDCD1WT3RLD4sg_NCQKlRSX',
    VITE_NEYNAR_CLIENT_ID: '0a715e62-512c-4b04-a51a-58b3ca51795d',
    VITE_PRICE_FEED_ADDRESS: '0x4adc67696ba383f43dd60a9e78f2c97fbbfc7cb1',
    VITE_EXPLORER_URL: 'https://sepolia.basescan.org',
    VITE_CHAIN_ID: '84532',
    DAILY_APP_ADDRESS_SEPOLIA: '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353',
    NEXT_PUBLIC_DAILY_APP_ADDRESS: '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353',
};

function apiRequest(method, path, body) {
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
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function getExistingEnvs() {
    const res = await apiRequest('GET', `/v10/projects/${PROJECT_ID}/env`);
    if (res.status !== 200) {
        throw new Error(`Failed to list env vars: ${res.status} ${JSON.stringify(res.data)}`);
    }
    return res.data.envs || [];
}

async function deleteEnv(envId) {
    const res = await apiRequest('DELETE', `/v10/projects/${PROJECT_ID}/env/${envId}`);
    if (res.status !== 200) {
        console.warn(`  ⚠️ Failed to delete env ${envId}: ${res.status}`);
    }
}

async function createEnv(key, value, target) {
    const res = await apiRequest('POST', `/v10/projects/${PROJECT_ID}/env`, {
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

async function main() {
    console.log('=== Vercel Env Sync ===');
    console.log(`Project: ${PROJECT_ID}`);
    console.log(`Team: ${TEAM_ID}`);
    console.log(`Vars to sync: ${Object.keys(ENV_VARS).length}`);
    console.log('');

    // 1. List existing env vars
    console.log('[1] Fetching existing env vars...');
    const existing = await getExistingEnvs();
    console.log(`  Found ${existing.length} existing env vars`);

    // 2. Group existing by key
    const existingByKey = {};
    for (const env of existing) {
        if (!existingByKey[env.key]) existingByKey[env.key] = [];
        existingByKey[env.key].push(env);
    }

    // 3. Upsert each var
    let updated = 0;
    let created = 0;
    let errors = 0;

    for (const [key, value] of Object.entries(ENV_VARS)) {
        try {
            // Delete existing entries for this key (all environments)
            if (existingByKey[key]) {
                for (const env of existingByKey[key]) {
                    await deleteEnv(env.id);
                }
            }

            // Create new entry for all environments
            await createEnv(key, value, ENVIRONMENTS);

            if (existingByKey[key]) {
                console.log(`  ✅ Updated: ${key} → ${value.substring(0, 40)}...`);
                updated++;
            } else {
                console.log(`  ✅ Created: ${key} → ${value.substring(0, 40)}...`);
                created++;
            }
        } catch (err) {
            console.error(`  ❌ Error on ${key}: ${err.message}`);
            errors++;
        }
    }

    console.log('');
    console.log('=== Sync Complete ===');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log('');
    if (errors === 0) {
        console.log('🚀 All env vars synced! Trigger a new Vercel deployment to apply changes.');
    }
}

main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
