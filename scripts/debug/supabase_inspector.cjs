const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
    "point_settings", "sbt_thresholds", "ens_subdomains", "admin_audit_logs", 
    "user_point_logs", "user_profiles", "daily_tasks", "user_task_claims", 
    "app_settings", "supported_platforms", "allowed_tokens", "campaigns", 
    "campaign_tasks", "user_claims", "sbt_pool_stats", "raffles", 
    "sponsor_stats", "project_revenue_logs", "system_settings", "sync_state", 
    "api_action_log", "agent_vault", "user_privileges", "agents_vault", 
    "user_activity_logs"
];

async function exportAll() {
    console.log('🚀 Starting Full Supabase Export...');
    const dump = {
        timestamp: new Date().toISOString(),
        project_url: SUPABASE_URL,
        tables: {},
        schema: {},
        policies: []
    };

    // 1. Fetch Data for each table
    for (const table of TABLES) {
        console.log(`- Fetching data from ${table}...`);
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
            console.warn(`  ⚠️ Error fetching ${table}: ${error.message}`);
            dump.tables[table] = { error: error.message };
        } else {
            dump.tables[table] = data;
        }
    }

    // Since we cannot run raw SQL via supabase-js without a custom RPC,
    // we'll instruct the user to run the SQL parts if they need deeper schema info.
    // However, we can try to get some metadata if available.

    const outputPath = path.join(__dirname, '../../supabase_full_dump.json');
    fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2));
    console.log(`\n✅ Export complete! Saved to: ${outputPath}`);
}

exportAll();
