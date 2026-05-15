#!/usr/bin/env node
/**
 * Live Supabase RLS Smoke Check
 *
 * Verifies application-level RLS behavior with two clients:
 * - service role: required tables are reachable and exist
 * - anon key: sensitive tables do not expose rows publicly
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');

function loadEnvFile(file) {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const eq = trimmed.indexOf('=');
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value.replace(/\\r\\n/g, '').trim();
    }
}

[
    path.join(REPO_ROOT, '.env'),
    path.join(REPO_ROOT, '.env.local'),
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.local'),
].forEach(loadEnvFile);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_KEY;

const requiredTables = [
    'user_profiles',
    'user_task_claims',
    'user_activity_logs',
    'daily_tasks',
    'point_settings',
    'system_settings',
    'sbt_thresholds',
    'campaigns',
    'raffles',
    'admin_audit_logs',
    'agent_vault',
    'agents_vault',
    'pending_sync_jobs',
    'system_error_logs',
];

const sensitiveTables = [
    'admin_audit_logs',
    'agent_vault',
    'agents_vault',
    'pending_sync_jobs',
    'system_error_logs',
    'user_activity_logs',
    'user_task_claims',
];

const publicReadableTables = [
    'point_settings',
    'sbt_thresholds',
    'allowed_tokens',
];

async function countRows(client, table) {
    return await client.from(table).select('*', { count: 'exact', head: true });
}

async function sampleRows(client, table) {
    return await client.from(table).select('*').limit(1);
}

async function main() {
    if (!url || !serviceKey || !anonKey) {
        console.error('❌ Missing Supabase URL, service role key, or anon key in local env.');
        process.exit(1);
    }

    const service = createClient(url, serviceKey);
    const anon = createClient(url, anonKey);
    const failures = [];

    console.log('🔍 Live Supabase RLS smoke check');

    for (const table of requiredTables) {
        const { error, count } = await countRows(service, table);
        if (error) {
            failures.push(`${table}: service-role read failed (${error.code || error.message})`);
            console.log(`  ❌ ${table.padEnd(22)} service read failed`);
        } else {
            console.log(`  ✅ ${table.padEnd(22)} service reachable (${count ?? 0} rows)`);
        }
    }

    console.log('\n🛡️  Anon access checks');
    for (const table of sensitiveTables) {
        const { data, error } = await sampleRows(anon, table);
        const exposed = !error && Array.isArray(data) && data.length > 0;
        if (exposed) {
            failures.push(`${table}: anon client can read sensitive rows`);
            console.log(`  ❌ ${table.padEnd(22)} exposed to anon`);
        } else {
            console.log(`  ✅ ${table.padEnd(22)} not publicly readable`);
        }
    }

    console.log('\n🌐 Public-safe read checks');
    for (const table of publicReadableTables) {
        const { error } = await sampleRows(anon, table);
        if (error) {
            failures.push(`${table}: expected public read failed (${error.code || error.message})`);
            console.log(`  ❌ ${table.padEnd(22)} public read failed`);
        } else {
            console.log(`  ✅ ${table.padEnd(22)} public read allowed`);
        }
    }

    if (failures.length > 0) {
        console.error(`\n❌ RLS smoke check failed (${failures.length} issue(s)):`);
        for (const failure of failures) console.error(`  - ${failure}`);
        process.exit(1);
    }

    console.log('\n🎉 Live RLS smoke check passed.');
}

main().catch((error) => {
    console.error(`❌ Live RLS smoke check failed: ${error?.message || error}`);
    process.exit(1);
});
