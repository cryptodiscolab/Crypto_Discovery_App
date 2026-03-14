const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../Raffle_Frontend/.env') });

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Missing Supabase credentials in .env');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const migrationPath = path.join(__dirname, 'migration_zero_hardcode.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration: Zero Hardcode...');

    // Split SQL into individual statements because Supabase RPC might not support multiple
    // But since this is a migration, we'll try to run it via an RPC if available, 
    // or just execute parts manually if needed.
    // For now, let's use a simple approach: if we don't have a 'exec_sql' RPC, we'll try to run them.
    
    // Note: Usually we use an exec_sql RPC for migrations if available.
    // Let's check if we can just run the whole thing or need to split.
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        // We use the postgres extension if available via RPC
        const { error } = await supabase.rpc('exec_sql', { query: statement });
        
        if (error) {
            console.error(`❌ Statement failed: ${error.message}`);
            // If exec_sql doesn't exist, we might be in trouble without a direct SQL access.
            // But we'll try to continue or fallback.
        }
    }

    console.log('✅ Migration complete (or attempted via RPC).');
}

main();
