const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- ADDING WINNER_COUNT COLUMN ---');
    
    const { error } = await supabase.rpc('execute_sql', {
        sql_query: `
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='winner_count') THEN
                    ALTER TABLE public.raffles ADD COLUMN winner_count INTEGER DEFAULT 1;
                END IF;
            END $$;
        `
    });

    if (error) {
        console.error('Error applying migration:', error.message);
        console.warn('Attempting direct column addition as fallback...');
        
        // Some setups don't have execute_sql RPC, let's try a simple select to test connection
        const { error: directErr } = await supabase.from('raffles').select('winner_count').limit(1);
        if (directErr && directErr.message.includes('column "winner_count" does not exist')) {
             console.log('Column definitely missing. Please apply SQL manually in Supabase Dashboard.');
             console.log('SQL to run: ALTER TABLE public.raffles ADD COLUMN winner_count INTEGER DEFAULT 1;');
        } else if (!directErr) {
             console.log('Column already exists or added.');
        } else {
             console.error('Unexpected error:', directErr.message);
        }
    } else {
        console.log('Successfully added winner_count column!');
    }
}

main();
