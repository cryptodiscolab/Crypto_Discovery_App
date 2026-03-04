#!/usr/bin/env node
'use strict';

/**
 * Ecosystem Sentinel — Cloud Config Sync
 * Upload .agents/skills & .cursorrules ke Supabase Storage sebagai backup cloud.
 *
 * Dijalankan dari ROOT repo:
 *   node .agents/skills/ecosystem-sentinel/scripts/sync-cloud.js
 *
 * Requires (tersedia di Raffle_Frontend/node_modules):
 *   - @supabase/supabase-js
 *   - dotenv
 *
 * GitHub Secrets yang dibutuhkan:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../../');
const RAFFLE_MODULES = path.join(ROOT_DIR, 'Raffle_Frontend', 'node_modules');

// ── Resolve dependencies dari Raffle_Frontend/node_modules ───────────────────
// (Di CI, npm ci dijalankan di Raffle_Frontend sehingga modules ada di sana)
let createClient, dotenv;
try {
    ({ createClient } = require(path.join(RAFFLE_MODULES, '@supabase/supabase-js')));
    dotenv = require(path.join(RAFFLE_MODULES, 'dotenv'));
} catch (e) {
    console.error('❌ [FATAL] Cannot load @supabase/supabase-js or dotenv.');
    console.error('   Pastikan `npm ci` sudah dijalankan di Raffle_Frontend/');
    console.error('   Detail:', e.message);
    process.exit(1);
}

// Load .env jika ada (lokal). Di CI, env vars datang dari GitHub Secrets.
const envPath = path.join(ROOT_DIR, 'Raffle_Frontend', '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// ── Supabase Client ───────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ [FATAL] Missing required environment variables:');
    if (!supabaseUrl) console.error('   → SUPABASE_URL (or VITE_SUPABASE_URL)');
    if (!supabaseKey) console.error('   → SUPABASE_SERVICE_ROLE_KEY');
    console.error('   Set these as GitHub Secrets untuk CI, atau di .env lokal.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const STORAGE_BUCKET = 'ai-config'; // Bucket private di Supabase Storage

// ── File/Dir yang di-sync ke Supabase Storage ────────────────────────────────
// .cursorrules mungkin tidak ada di CI (gitignored) — skip gracefully
const SYNC_TARGETS = [
    { local: '.cursorrules', dest: 'config/.cursorrules', optional: true },
    { local: '.agents/skills', dest: 'agents/skills', optional: false, isDir: true },
    { local: '.agents/workflows', dest: 'agents/workflows', optional: true, isDir: true },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

async function ensureBucketExists() {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw new Error(`List buckets failed: ${error.message}`);

    const exists = buckets.some(b => b.name === STORAGE_BUCKET);
    if (!exists) {
        console.log(`🪣 Creating private bucket: ${STORAGE_BUCKET}`);
        const { error: createErr } = await supabase.storage.createBucket(STORAGE_BUCKET, {
            public: false,
        });
        if (createErr) throw new Error(`Create bucket failed: ${createErr.message}`);
        console.log(`  ✅ Bucket "${STORAGE_BUCKET}" created.`);
    } else {
        console.log(`  ✅ Bucket "${STORAGE_BUCKET}" exists.`);
    }
}

async function uploadFile(localAbsPath, destPath) {
    if (!fs.existsSync(localAbsPath)) return false;

    const buffer = fs.readFileSync(localAbsPath);
    const contentType = localAbsPath.endsWith('.json') ? 'application/json' : 'text/plain';

    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(destPath, buffer, { upsert: true, contentType });

    if (error) {
        console.error(`  ❌ Upload failed [${destPath}]: ${error.message}`);
        return false;
    }
    console.log(`  ✅ Uploaded: ${destPath}`);
    return true;
}

async function uploadDirectory(localAbsDir, destBaseDir) {
    if (!fs.existsSync(localAbsDir)) return;

    const entries = fs.readdirSync(localAbsDir);
    for (const entry of entries) {
        const fullLocal = path.join(localAbsDir, entry);
        const fullDest = `${destBaseDir}/${entry}`;
        const stat = fs.statSync(fullLocal);

        if (stat.isDirectory()) {
            await uploadDirectory(fullLocal, fullDest);
        } else {
            await uploadFile(fullLocal, fullDest);
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('☁️  Ecosystem Sentinel — Cloud Config Sync');
    console.log(`📁 ROOT_DIR: ${ROOT_DIR}`);
    console.log(`🪣 Target bucket: ${STORAGE_BUCKET}\n`);

    // 1. Pastikan bucket ada
    await ensureBucketExists();

    let success = 0;
    let skipped = 0;

    // 2. Upload semua target
    for (const target of SYNC_TARGETS) {
        const localAbs = path.join(ROOT_DIR, target.local);

        if (!fs.existsSync(localAbs)) {
            if (target.optional) {
                console.warn(`⚠️  Skip (not found / gitignored): ${target.local}`);
                skipped++;
            } else {
                console.error(`❌ Required target missing: ${target.local}`);
            }
            continue;
        }

        console.log(`\n📤 Syncing: ${target.local} → ${STORAGE_BUCKET}/${target.dest}`);

        if (target.isDir) {
            await uploadDirectory(localAbs, target.dest);
        } else {
            await uploadFile(localAbs, target.dest);
        }
        success++;
    }

    // 3. Summary
    console.log('\n══════════════════════════════════════════');
    console.log('📋 CLOUD SYNC SUMMARY');
    console.log('══════════════════════════════════════════');
    console.log(`  ✅ Synced targets : ${success}`);
    if (skipped > 0) console.log(`  ⚠️  Skipped (optional): ${skipped}`);
    console.log('\n✨ Cloud sync complete!');
}

main().catch(err => {
    console.error('\n❌ [FATAL] Sync failed:', err.message);
    process.exit(1);
});
