const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- UPGRADING RAFFLE SCHEMA ---');
    
    const sql = `
        DO $$ 
        BEGIN 
            -- winner_count (if not already there)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='winner_count') THEN
                ALTER TABLE public.raffles ADD COLUMN winner_count INTEGER DEFAULT 1;
            END IF;

            -- description
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='description') THEN
                ALTER TABLE public.raffles ADD COLUMN description TEXT;
            END IF;

            -- image_url
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='image_url') THEN
                ALTER TABLE public.raffles ADD COLUMN image_url TEXT;
            END IF;

            -- category
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='category') THEN
                ALTER TABLE public.raffles ADD COLUMN category TEXT;
            END IF;

            -- external_link
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='external_link') THEN
                ALTER TABLE public.raffles ADD COLUMN external_link TEXT;
            END IF;

            -- twitter_link
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='twitter_link') THEN
                ALTER TABLE public.raffles ADD COLUMN twitter_link TEXT;
            END IF;

            -- min_sbt_level
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='min_sbt_level') THEN
                ALTER TABLE public.raffles ADD COLUMN min_sbt_level INTEGER DEFAULT 0;
            END IF;
        END $$;
    `;

    console.log('Please run the following SQL in Supabase SQL Editor if execute_sql is not available:');
    console.log(sql);

    // Attempting direct column existence checks as a "soft" verification
    const tables = ['raffles'];
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error && data) {
            console.log(`Table ${table} current columns:`, Object.keys(data[0] || {}));
        } else {
            console.error(`Error checking ${table}:`, error?.message);
        }
    }
}

main();
