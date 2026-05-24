/**
 * Automated Daily Supabase Backup — Vercel Cron
 * Schedule: daily 05:00 UTC (configured in vercel.json)
 *
 * Backs up all critical tables to Supabase Storage bucket `db-backups`.
 * Retains last 30 daily backups. Sends Telegram alert on completion/failure.
 *
 * Authentication: requires CRON_SECRET in Authorization header.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../_shared/database.types.js';

// ── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL      = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const SERVICE_KEY       = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim();
const TELEGRAM_TOKEN    = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT     = (process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || '').trim();
const CRON_SECRET       = (process.env.CRON_SECRET || '').trim();

const STORAGE_BUCKET = 'db-backups';
const MAX_BACKUPS    = 30;

// Critical tables first, config tables second
const BACKUP_TABLES: Array<{ name: string; critical: boolean }> = [
    { name: 'user_profiles',       critical: true  },
    { name: 'user_task_claims',    critical: true  },
    { name: 'user_activity_logs',  critical: true  },
    { name: 'admin_audit_logs',    critical: true  },
    { name: 'daily_tasks',         critical: false },
    { name: 'point_settings',      critical: false },
    { name: 'system_settings',     critical: false },
    { name: 'sbt_thresholds',      critical: false },
    { name: 'allowed_tokens',      critical: false },
    { name: 'campaigns',           critical: false },
    { name: 'raffles',             critical: false },
    { name: 'agent_vault',         critical: false },
    { name: 'agents_vault',        critical: false },
    { name: 'system_error_logs',   critical: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchTableData(
    supabase: SupabaseClient<Database>,
    tableName: string
): Promise<unknown[]> {
    let allRows: unknown[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;
    while (hasMore) {
        const { data, error } = await supabase
            .from(tableName as keyof Database['public']['Tables'])
            .select('*')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw new Error(`${tableName}: ${error.message}`);
        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }
        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) {
            hasMore = false;
            break;
        }
        page++;
    }
    return allRows;
}

async function ensureBackupBucket(supabase: SupabaseClient<Database>) {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b: { name: string }) => b.name === STORAGE_BUCKET);
    if (!exists) {
        const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
            public: false,
            fileSizeLimit: 52428800,
        });
        if (error && !error.message?.includes('already exists')) {
            throw new Error(`Bucket creation failed: ${error.message}`);
        }
    }
}

async function uploadFile(
    supabase: SupabaseClient<Database>,
    folder: string,
    filename: string,
    content: string
): Promise<void> {
    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(`${folder}/${filename}`, Buffer.from(content, 'utf8'), {
            contentType: 'application/json',
            upsert: true,
        });
    if (error) throw new Error(`Upload ${folder}/${filename}: ${error.message}`);
}

async function rotateOldBackups(supabase: SupabaseClient<Database>) {
    const { data: items } = await supabase.storage.from(STORAGE_BUCKET).list('', {
        limit: 200,
        sortBy: { column: 'name', order: 'asc' },
    });
    if (!items) return;

    // Supabase Storage treats "folders" as items with null id
    const folders = items
        .filter((f: { id: string | null }) => f.id === null)
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    if (folders.length <= MAX_BACKUPS) return;

    const toDelete = folders.slice(0, folders.length - MAX_BACKUPS);
    for (const folder of toDelete) {
        const { data: inner } = await supabase.storage.from(STORAGE_BUCKET).list(folder.name);
        if (inner && inner.length > 0) {
            const paths = inner.map((f: { name: string }) => `${folder.name}/${f.name}`);
            await supabase.storage.from(STORAGE_BUCKET).remove(paths);
        }
    }
    return toDelete.length;
}

async function notifyTelegram(message: string) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'Markdown' }),
        });
    } catch { /* fire and forget */ }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Auth: allow Vercel cron (no origin) OR CRON_SECRET header
    const authHeader = req.headers['authorization'];
    const isCron = authHeader === `Bearer ${CRON_SECRET}`;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';

    if (!isCron && !isVercelCron && CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
        await notifyTelegram('❌ *Backup Failed*\nSUPABASE_URL or SERVICE_KEY missing');
        return res.status(500).json({ error: 'Missing Supabase credentials' });
    }

    const startTime = Date.now();
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const supabase = createClient<Database>(SUPABASE_URL, SERVICE_KEY);
    const manifest: {
        timestamp: string;
        environment: string;
        tables: Record<string, { count: number; size_bytes: number }>;
        total_rows: number;
        errors: Array<{ table: string; error: string }>;
        duration_ms?: number;
        rotated_count?: number;
    } = {
        timestamp: now.toISOString(),
        environment: process.env.VITE_CHAIN_ID === '8453' ? 'mainnet' : 'sepolia',
        tables: {},
        total_rows: 0,
        errors: [],
    };

    try {
        // 1. Ensure storage bucket exists
        await ensureBackupBucket(supabase);

        // 2. Back up each table
        for (const { name, critical } of BACKUP_TABLES) {
            try {
                const rows = await fetchTableData(supabase, name);
                const content = JSON.stringify(rows, null, 2);
                manifest.tables[name] = {
                    count: rows.length,
                    size_bytes: Buffer.byteLength(content),
                };
                manifest.total_rows += rows.length;
                await uploadFile(supabase, ts, `${name}.json`, content);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                manifest.errors.push({ table: name, error: msg });
                console.error(`[backup] Error on ${name}:`, msg);
                if (critical) {
                    // Log but continue — don't abort for non-critical failures
                    console.error(`[backup] CRITICAL table ${name} failed`);
                }
            }
        }

        // 3. Upload manifest
        manifest.duration_ms = Date.now() - startTime;
        await uploadFile(supabase, ts, 'manifest.json', JSON.stringify(manifest, null, 2));

        // 4. Rotate old backups
        const rotated = await rotateOldBackups(supabase);
        if (typeof rotated === 'number') manifest.rotated_count = rotated;

        // 5. Notify
        const errorCount = manifest.errors.length;
        const tableCount = Object.keys(manifest.tables).length;
        const duration = (manifest.duration_ms / 1000).toFixed(1);
        const status = errorCount === 0 ? '✅' : '⚠️';

        await notifyTelegram(
            `${status} *Daily DB Backup*\n` +
            `📅 ${now.toISOString().slice(0, 19)}Z\n` +
            `📊 ${tableCount} tables · ${manifest.total_rows} rows · ${duration}s\n` +
            (errorCount > 0 ? `⚠️ ${errorCount} errors: ${manifest.errors.map(e => e.table).join(', ')}\n` : '') +
            `☁️ \`db-backups/${ts}\``
        );

        return res.status(200).json({
            success: true,
            timestamp: ts,
            tables: tableCount,
            total_rows: manifest.total_rows,
            duration_ms: manifest.duration_ms,
            errors: manifest.errors,
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[backup] Fatal:', msg);
        await notifyTelegram(`❌ *Backup Failed*\n${msg.slice(0, 200)}`);
        return res.status(500).json({ error: msg });
    }
}
