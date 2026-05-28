/**
 * Push env vars to Vercel using CLI (authenticated via stored session)
 * Run: node scripts/sync/push_vercel_env_cli.cjs
 * Requires: vercel CLI authenticated (`vercel whoami` should work)
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const PROJECT_DIR = path.join(ROOT_DIR, 'Raffle_Frontend');

// Load environment variables from root .env
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });

const ENVS = [
    'VITE_DAILY_APP_ADDRESS',
    'VITE_MASTER_X_ADDRESS',
    'RAFFLE_ADDRESS',
    'VITE_DAILY_APP_V16_ADDRESS',
    'VITE_MASTER_X_ADDRESS_SEPOLIA',
    'VITE_V12_CONTRACT_ADDRESS_SEPOLIA',
    'VITE_RAFFLE_ADDRESS',
    'VITE_RAFFLE_ADDRESS_SEPOLIA',
    'VITE_CMS_CONTRACT_ADDRESS_SEPOLIA',
    'VITE_REOWN_PROJECT_ID',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_NEYNAR_CLIENT_ID',
    'VITE_PRICE_FEED_ADDRESS',
    'VITE_EXPLORER_URL',
    'VITE_CHAIN_ID',
    'DAILY_APP_ADDRESS_SEPOLIA',
    'NEXT_PUBLIC_DAILY_APP_ADDRESS',
];

const MAPPINGS = {
    'VITE_DAILY_APP_ADDRESS': 'VITE_DAILY_APP_V16_ADDRESS',
    'VITE_MASTER_X_ADDRESS': 'VITE_MASTER_X_ADDRESS_SEPOLIA',
    'RAFFLE_ADDRESS': 'VITE_RAFFLE_ADDRESS_SEPOLIA',
    'VITE_RAFFLE_ADDRESS': 'VITE_RAFFLE_ADDRESS_SEPOLIA',
    'DAILY_APP_ADDRESS_SEPOLIA': 'VITE_DAILY_APP_V16_ADDRESS',
    'NEXT_PUBLIC_DAILY_APP_ADDRESS': 'VITE_DAILY_APP_V16_ADDRESS',
    'VITE_PRICE_FEED_ADDRESS': 'PRICE_FEED_ETH_USD'
};

const ENVIRONMENTS = ['production', 'preview', 'development'];

let success = 0, failed = 0;

for (const key of ENVS) {
    let value = process.env[key];
    if (value === undefined && MAPPINGS[key]) {
        value = process.env[MAPPINGS[key]];
    }

    if (value === undefined) {
        console.error(`  ⚠️ Warning: Key ${key} not found in root .env. Skipping.`);
        continue;
    }

    // Strip quotes if they were added in .env parsing
    value = value.replace(/^["']|["']$/g, '').trim();

    for (const env of ENVIRONMENTS) {
        // Delete existing env var first to avoid conflict
        spawnSync('vercel', ['env', 'rm', key, env], {
            cwd: PROJECT_DIR,
            input: 'y\n',
            encoding: 'utf8',
            shell: true,
            timeout: 10000,
        });

        const result = spawnSync('vercel', ['env', 'add', key, env], {
            cwd: PROJECT_DIR,
            input: value + '\n',
            encoding: 'utf8',
            shell: true,
            timeout: 30000,
        });
        const out = (result.stdout + result.stderr).trim();
        if (result.status === 0 || out.includes('Added') || out.includes('already')) {
            // Success
        } else {
            console.error(`  ❌ ${key} [${env}] failed: ${out.slice(0, 100)}`);
            failed++;
            continue;
        }
    }
    console.log(`  ✅ ${key} → ${value.substring(0, 42)}`);
    success++;
}

console.log(`\n=== Done: ${success} vars synced, ${failed} errors ===`);
if (failed === 0) {
    console.log('🚀 All env vars pushed! Redeploy Vercel to pick up changes.');
    console.log('   vercel --prod --cwd Raffle_Frontend');
}
