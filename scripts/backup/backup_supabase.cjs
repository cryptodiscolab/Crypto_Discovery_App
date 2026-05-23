/**
 * Supabase Full Database Backup Script
 * 
 * Usage:
 *   node scripts/backup/backup_supabase.cjs
 *   node scripts/backup/backup_supabase.cjs --storage-only   # skip local files
 *   node scripts/backup/backup_supabase.cjs --local-only     # skip storage upload
 * 
 * Backs up all critical tables to:
 *   1. Local: backups/YYYY-MM-DD_HH-MM-SS/  (for immediate use)
 *   2. Supabase Storage: db-backups bucket   (persistent cloud backup)
 *
 * Retention: 30 daily backups auto-rotated in storage.
 */
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const SERVICE_KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim();
const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT  = (process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || '').trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
}

// Lazy load Supabase to avoid requiring it at the top level
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Config ──────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'db-backups';
const MAX_BACKUPS    = 30; // Keep 30 daily backups in storage

// Tables in priority order (critical first)
const BACKUP_TABLES = [
    // 🔴 Critical — user data
    { name: 'user_profiles',       critical: true  },
    { name: 'user_task_claims',    critical: true  },
    { name: 'user_activity_logs',  critical: true  },
    { name: 'admin_audit_logs',    critical: true  },
    // 🟠 Config — can be recreated but good to keep
    { name: 'daily_tasks',         critical: false },
    { name: 'point_settings',      critical: false },
    { name: 'system_settings',     critical: false },
    { name: 'sbt_thresholds',      critical: false },
    { name: 'allowed_tokens',      critical: false },
    { name: 'campaigns',           critical: false },
    { name: 'raffles',             critical: false },
    // 🟡 Agent / AI data
    { name: 'agent_vault',         critical: false },
    { name: 'agents_vault',        critical: false },
    // 🟢 Supplementary
    { name: 'system_error_logs',   critical: false },
    { name: 'nexus_agent_reports', critical: false },
];

const STORAGE_ONLY = process.argv.includes('--storage-only');
const LOCAL_ONLY   = process.argv.includes('--local-only');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchTable(tableName) {
    let allRows = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw new Error(`Table ${tableName}: ${error.message}`);
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        page++;
    }
    return allRows;
}

async function ensureBucket() {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === STORAGE_BUCKET);
    if (!exists) {
        const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
            public: false,
            fileSizeLimit: 52428800, // 50 MB max per file
        });
        if (error && !error.message?.includes('already exists')) {
            throw new Error(`Failed to create bucket: ${error.message}`);
        }
        console.log(`  📦 Created Supabase Storage bucket: ${STORAGE_BUCKET}`);
    }
}

async function uploadToStorage(folderName, fileName, content) {
    const storagePath = `${folderName}/${fileName}`;
    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, Buffer.from(content, 'utf8'), {
            contentType: 'application/json',
            upsert: true,
        });
    if (error) throw new Error(`Storage upload ${storagePath}: ${error.message}`);
}

async function rotateOldBackups() {
    const { data: files } = await supabase.storage.from(STORAGE_BUCKET).list('', {
        limit: 200,
        sortBy: { column: 'name', order: 'asc' },
    });
    if (!files || files.length <= MAX_BACKUPS) return;

    // Each backup is a "folder" (prefix) in Supabase Storage
    const folders = files
        .filter(f => f.id === null) // folders appear as items with null id
        .sort((a, b) => a.name.localeCompare(b.name));

    const toDelete = folders.slice(0, folders.length - MAX_BACKUPS);
    for (const folder of toDelete) {
        // List files inside the folder and delete them
        const { data: innerFiles } = await supabase.storage
            .from(STORAGE_BUCKET)
            .list(folder.name);
        if (innerFiles) {
            const paths = innerFiles.map(f => `${folder.name}/${f.name}`);
            if (paths.length > 0) {
                await supabase.storage.from(STORAGE_BUCKET).remove(paths);
            }
        }
        console.log(`  🗑️  Rotated old backup: ${folder.name}`);
    }
}

async function sendTelegram(message) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT,
                text: message,
                parse_mode: 'Markdown',
            }),
        });
        if (!res.ok) console.warn(`Telegram send failed: ${res.status}`);
    } catch (e) {
        console.warn('Telegram notify error:', e.message);
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const startTime = Date.now();
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-05-23T09-00-00
    const dateLabel = now.toISOString().slice(0, 10); // 2026-05-23

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  🗄️  Supabase Backup — ${ts}  ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);

    // 1. Ensure local backup dir
    const localDir = path.join(__dirname, '../../backups', ts);
    if (!STORAGE_ONLY) {
        fs.mkdirSync(localDir, { recursive: true });
        console.log(`  📁 Local dir: ${localDir}`);
    }

    // 2. Ensure Supabase Storage bucket
    if (!LOCAL_ONLY) {
        await ensureBucket();
    }

    // 3. Backup each table
    const manifest = {
        timestamp: now.toISOString(),
        environment: process.env.VITE_CHAIN_ID === '8453' ? 'mainnet' : 'sepolia',
        supabase_url: SUPABASE_URL.replace(/https:\/\/([^.]+)\.supabase\.co.*/, 'https://$1.supabase.co'),
        tables: {},
        total_rows: 0,
        errors: [],
    };

    for (const { name, critical } of BACKUP_TABLES) {
        process.stdout.write(`  ${critical ? '🔴' : '⚪'} ${name}...`);
        try {
            const rows = await fetchTable(name);
            const content = JSON.stringify(rows, null, 2);
            manifest.tables[name] = { count: rows.length, size_bytes: Buffer.byteLength(content) };
            manifest.total_rows += rows.length;

            if (!STORAGE_ONLY) {
                fs.writeFileSync(path.join(localDir, `${name}.json`), content);
            }
            if (!LOCAL_ONLY) {
                await uploadToStorage(ts, `${name}.json`, content);
            }
            console.log(` ✅ ${rows.length} rows`);
        } catch (err) {
            console.log(` ⚠️  ${err.message}`);
            manifest.errors.push({ table: name, error: err.message });
            if (critical) {
                console.error(`  ❌ CRITICAL table ${name} failed!`);
            }
        }
    }

    // 4. Save manifest
    const manifestContent = JSON.stringify(manifest, null, 2);
    if (!STORAGE_ONLY) {
        fs.writeFileSync(path.join(localDir, 'manifest.json'), manifestContent);
    }
    if (!LOCAL_ONLY) {
        await uploadToStorage(ts, 'manifest.json', manifestContent);
    }

    // 5. Rotate old backups
    if (!LOCAL_ONLY) {
        await rotateOldBackups();
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const errorCount = manifest.errors.length;
    const tableCount = Object.keys(manifest.tables).length;

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  ✅ Backup Complete                           ║`);
    console.log(`║  📊 ${tableCount} tables · ${manifest.total_rows} rows · ${duration}s         ║`);
    if (!LOCAL_ONLY) console.log(`║  ☁️  Storage: ${STORAGE_BUCKET}/${ts}      ║`);
    if (!STORAGE_ONLY) console.log(`║  💾 Local: backups/${ts}  ║`);
    if (errorCount > 0) console.log(`║  ⚠️  ${errorCount} errors (check manifest.json)         ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);

    // 6. Telegram notification
    const status = errorCount === 0 ? '✅' : '⚠️';
    await sendTelegram(
        `${status} *DB Backup Complete*\n` +
        `📅 ${now.toISOString()}\n` +
        `📊 ${tableCount} tables · ${manifest.total_rows} rows · ${duration}s\n` +
        (errorCount > 0 ? `⚠️ ${errorCount} errors: ${manifest.errors.map(e => e.table).join(', ')}\n` : '') +
        `☁️ Storage: \`${STORAGE_BUCKET}/${ts}\``
    );

    if (errorCount > 0) process.exit(1);
}

main().catch(err => {
    console.error('Fatal backup error:', err);
    process.exit(1);
});
