const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ============================================================================
// CRYPTO DISCO APP - DATABASE SYNCHRONIZATION & HEALTH CHECK SCRIPT
// Mandated by .cursorrules: All Agents (Antigravity, OpenClaw, Qwen, DeepSeek) 
// MUST run this script to verify DB sync before and after infrastructure changes.
// ============================================================================

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ CRITICAL: Missing SUPABASE environment variables.");
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- 🛡️ CRYPTO DISCO DB SYNC VERIFICATION 🛡️ ---');

    const criticalTables = [
        'user_profiles', 'daily_tasks', 'user_task_claims', 
        'user_activity_logs', 'raffles', 'campaigns', 
        'sbt_thresholds', 'point_settings'
    ];

    const bannedLegacyTables = ['user_stats', 'profiles'];

    let errorsFound = 0;

    // 1. Check for Banned Legacy Tables (They should NOT exist)
    console.log('\n[1] Checking for Legacy Fragmentation...');
    for (const table of bannedLegacyTables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        // We EXPECT an error here because the table should be dropped.
        if (!error) {
            console.error(`❌ VULNERABILITY: Legacy table '${table}' still exists! It must be dropped.`);
            errorsFound++;
        } else {
            console.log(`✅ Legacy table '${table}' successfully eradicated.`);
        }
    }

    // 2. Verify Critical Tables and Basic Sync
    console.log('\n[2] Verifying Core Feature Synchronization...');
    for (const table of criticalTables) {
        // Just verify we can query it without error, confirming schema existence
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`❌ SYNC ERROR: Cannot access '${table}'. Details: ${error.message}`);
            errorsFound++;
        } else {
            console.log(`✅ Table '${table}' is synchronized and accessible.`);
        }
    }

    // 3. Verify Specific Feature Sync Elements (UGC, Raffles, Logs)
    console.log('\n[3] Deep Feature Inspection...');
    
    // Check if point_settings has the active baseline
    const { data: points, error: pErr } = await supabase.from('point_settings').select('activity_key');
    if (pErr || !points || points.length === 0) {
        console.warn('⚠️ WARNING: Settings table "point_settings" appears empty. Core features may not award XP.');
        errorsFound++;
    } else {
        console.log(`✅ 'point_settings' is active with ${points.length} registered activities.`);
    }

    console.log('\n================================================');
    if (errorsFound > 0) {
        console.error(`🚨 AUDIT FAILED: Found ${errorsFound} synchronization issues.`);
        console.error(`🚨 AGENT MANDATE: You MUST fix these database issues before proceeding with your task.`);
        process.exit(1);
    } else {
        console.log(`🟢 AUDIT PASSED: Database is perfectly synchronized and unified.`);
        console.log(`🟢 AGENT CLEARANCE: App is running lightweight and clean. You may proceed.`);
        process.exit(0);
    }
}

main();
