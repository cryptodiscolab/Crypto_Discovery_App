/**
 * Push env vars to Vercel using CLI (authenticated via stored session)
 * Run: node scripts/sync/push_vercel_env_cli.cjs
 * Requires: vercel CLI authenticated (`vercel whoami` should work)
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '..', '..', 'Raffle_Frontend');

const ENVS = [
    // Fixed malformed addresses
    ['VITE_DAILY_APP_ADDRESS', '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353'],
    ['VITE_MASTER_X_ADDRESS', '0x5916E4A76Ec2a790373FDC2C7410d5065856F142'],
    ['RAFFLE_ADDRESS', '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7'],
    // New critical env vars
    ['VITE_DAILY_APP_V16_ADDRESS', '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353'],
    ['VITE_MASTER_X_ADDRESS_SEPOLIA', '0x5916E4A76Ec2a790373FDC2C7410d5065856F142'],
    ['VITE_V12_CONTRACT_ADDRESS_SEPOLIA', '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353'],
    ['VITE_RAFFLE_ADDRESS', '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7'],
    ['VITE_RAFFLE_ADDRESS_SEPOLIA', '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7'],
    ['VITE_CMS_CONTRACT_ADDRESS_SEPOLIA', '0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC'],
    ['VITE_REOWN_PROJECT_ID', '5ae6de312908f2d0cd512576920b78cd'],
    ['VITE_SUPABASE_URL', 'https://rbgzwhsdqnhwrwimjjfm.supabase.co'],
    ['VITE_SUPABASE_ANON_KEY', 'sb_publishable_oFA-r_qXEDCD1WT3RLD4sg_NCQKlRSX'],
    ['VITE_NEYNAR_CLIENT_ID', '0a715e62-512c-4b04-a51a-58b3ca51795d'],
    ['VITE_PRICE_FEED_ADDRESS', '0x4adC67696BA383f43fd60604633031D935f9584b'],
    ['VITE_EXPLORER_URL', 'https://sepolia.basescan.org'],
    ['VITE_CHAIN_ID', '84532'],
    ['DAILY_APP_ADDRESS_SEPOLIA', '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353'],
    ['NEXT_PUBLIC_DAILY_APP_ADDRESS', '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353'],
];

const ENVIRONMENTS = ['production', 'preview', 'development'];

let success = 0, failed = 0;

for (const [key, value] of ENVS) {
    for (const env of ENVIRONMENTS) {
        const result = spawnSync('vercel', ['env', 'add', key, env], {
            cwd: PROJECT_DIR,
            input: value + '\n',
            encoding: 'utf8',
            shell: true,
            timeout: 30000,
        });
        const out = (result.stdout + result.stderr).trim();
        if (result.status === 0 || out.includes('Added') || out.includes('already')) {
            // Success or already exists
        } else if (out.includes('already exists')) {
            console.log(`  ⏭️  ${key} [${env}] — already exists`);
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
