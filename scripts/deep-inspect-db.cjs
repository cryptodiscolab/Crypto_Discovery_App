const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- REVEALING FULL SCHEMA ---');

    // Using raw SQL via Supabase (if allowed) or querying the RPC if it works.
    // If we can't do raw SQL, we will use the 'get_schema_details' if it's there.
    // Since I suspect it might not be there, I will try to use the 'db_auth' check or just list systematically.
    
    const { data: tables, error: tErr } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

    if (tErr) {
        console.error('Failed to query information_schema.tables:', tErr.message);
        console.log('Falling back to systematic inspection of known features...');
    }

    // Comprehensive list of columns for each table
    const targetTables = [
        'user_profiles', 'user_stats', 'daily_tasks', 'user_task_claims', 
        'user_activity_logs', 'raffles', 'campaigns', 'sbt_thresholds', 
        'system_settings', 'point_settings', 'agents_vault'
    ];

    for (const table of targetTables) {
        // Query to get column names even for empty tables
        const { data: cols, error: cErr } = await supabase
            .rpc('get_table_columns', { tname: table }); 
        
        if (cErr) {
            console.log(`[${table}] No column RPC found.`);
        } else {
            console.log(`[${table}] Columns:`, cols);
        }
    }
}

main();
