const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- FETCHING TABLES & COLUMNS ---');
    
    // Query information_schema for a complete overview
    const { data: columns, error } = await supabase
        .rpc('get_schema_details'); // Testing if custom RPC exists first
    
    if (error) {
        console.warn('RPC get_schema_details failed, falling back to raw queries...');
        // Fallback: Query tables one by one or via common tables to get column keys
        const tables = [
            'user_profiles', 'user_stats', 'daily_tasks', 'user_task_claims', 
            'user_activity_logs', 'raffles', 'campaigns', 'raffle_tickets',
            'system_settings', 'point_settings', 'sbt_thresholds', 'pool_claims',
            'agents_vault'
        ];

        for (const table of tables) {
            const { data, error: tErr } = await supabase.from(table).select('*').limit(1);
            if (tErr) {
                console.log(`Table [${table}]: Not Found or Error (${tErr.message})`);
            } else {
                console.log(`Table [${table}]:`, data.length > 0 ? Object.keys(data[0]) : '(Empty but exists)');
            }
        }
    } else {
        console.log('Schema Details:', JSON.stringify(columns, null, 2));
    }
}

main();
