#!/usr/bin/env node
/**
 * check_sync_status.cjs
 * Validates that all 13 critical project synchronization invariants pass.
 * Run: node scripts/audits/check_sync_status.cjs
 * Must pass 13/13 before mainnet deploy.
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '../..');
const CONTRACTS    = path.join(ROOT, '../../contracts');
const ENV_EXAMPLE  = path.join(ROOT, '.env.example');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const MAIN_TSX     = path.join(ROOT, 'src', 'main.tsx');
const BACKUP_TS    = path.join(ROOT, 'api', 'cron', '_backup.ts');
const MIDDLEWARE   = path.join(ROOT, 'api', '_shared', 'middleware.ts');

let passed = 0;
let failed = 0;
const results = [];

function check(name, fn) {
    try {
        const ok = fn();
        if (ok) {
            results.push(`  ✅ ${name}`);
            passed++;
        } else {
            results.push(`  ❌ ${name}`);
            failed++;
        }
    } catch (e) {
        results.push(`  ❌ ${name} — ERROR: ${e.message}`);
        failed++;
    }
}

function readFile(p) {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

const pkg  = JSON.parse(readFile(PACKAGE_JSON) || '{}');
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

// ── 13 Synchronization Checks ────────────────────────────────────────────────

// 1. @sentry/react present (frontend error tracking)
check('[@sentry/react] installed in package.json', () =>
    typeof deps['@sentry/react'] === 'string' && !deps['@sentry/react'].startsWith('^'));

// 2. @sentry/node present (serverless API error tracking)
check('[@sentry/node] installed in package.json (for Vercel API routes)', () =>
    typeof deps['@sentry/node'] === 'string' && !deps['@sentry/node'].startsWith('^'));

// 3. Sentry initialized in main.tsx
check('[Sentry] initialized in src/main.tsx', () => {
    const content = readFile(MAIN_TSX);
    return content.includes("Sentry.init(") && content.includes("@sentry/react");
});

// 4. axios pinned (no ^ or ~)
check('[axios] exact version pinned (no ^ or ~)', () => {
    const v = deps['axios'] || '';
    return v.length > 0 && !v.startsWith('^') && !v.startsWith('~');
});

// 5. .env.example has new MasterX address (not the old blacklisted one)
check('[.env.example] uses new MasterX address (0x1b573D...)', () => {
    const content = readFile(ENV_EXAMPLE);
    return content.includes('0x1b573DdD9a1679505ae64498564523222c758EC2') &&
           !content.includes('VITE_MASTER_X_ADDRESS_SEPOLIA=0x980770');
});

// 6. .env.example has new Raffle address (not the old blacklisted one)
check('[.env.example] uses new Raffle address (0xaE8fe1d...)', () => {
    const content = readFile(ENV_EXAMPLE);
    return content.includes('0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7') &&
           !content.includes('VITE_RAFFLE_ADDRESS_SEPOLIA=0xE7CB85');
});

// 7. .env.example has VITE_SENTRY_DSN
check('[.env.example] contains VITE_SENTRY_DSN entry', () =>
    readFile(ENV_EXAMPLE).includes('VITE_SENTRY_DSN'));

// 8. backup.ts uses SupabaseClient (not ReturnType<typeof createClient>)
check('[backup.ts] SupabaseClient (TS2345 fix applied)', () => {
    const content = readFile(BACKUP_TS);
    return (content.includes('SupabaseClient<any>') || content.includes('SupabaseClient<Database>')) &&
           !content.includes('ReturnType<typeof createClient>');
});

// 9. middleware.ts has @sentry/node import
check('[middleware.ts] imports @sentry/node (TS2307 fix applied)', () =>
    readFile(MIDDLEWARE).includes('@sentry/node'));

// 10. test/DailyAppV16.test.cjs exists (Disco_DailyApp/test/ is one level above Raffle_Frontend/)
check('[tests] DailyAppV16.test.cjs exists', () =>
    fs.existsSync(path.join(ROOT, '../test/DailyAppV16.test.cjs')));

// 11. test/CryptoDiscoRaffle.test.cjs exists
check('[tests] CryptoDiscoRaffle.test.cjs exists', () =>
    fs.existsSync(path.join(ROOT, '../test/CryptoDiscoRaffle.test.cjs')));

// 12. test/CryptoDiscoMasterX.test.cjs exists
check('[tests] CryptoDiscoMasterX.test.cjs exists', () =>
    fs.existsSync(path.join(ROOT, '../test/CryptoDiscoMasterX.test.cjs')));

// 13. supabase RLS migration exists
check('[supabase] RLS hardening migration exists', () =>
    fs.existsSync(path.join(ROOT, 'supabase', 'migrations', '20260515_rls_hardening.sql')));

// ── Report ────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════');
console.log('  Disco DailyApp — Sync Status Check');
console.log('══════════════════════════════════════════════════════');
results.forEach(r => console.log(r));
console.log('──────────────────────────────────────────────────────');
console.log(`  Result: ${passed}/13 passed, ${failed}/13 failed`);
console.log('══════════════════════════════════════════════════════\n');

if (failed > 0) {
    console.error(`❌ ${failed} check(s) failed. Fix before mainnet deploy.\n`);
    process.exit(1);
} else {
    console.log('✅ All 13 checks passed. Ready to proceed.\n');
    process.exit(0);
}
