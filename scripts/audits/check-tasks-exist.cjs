const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const ids = [
        '288596d8-b5a9-4faf-bde0-0dd28aaba902',
        '885535d2-4c5c-4a80-9af5-36666192c244'
    ];

    console.log('--- CHECKING DAILY TASKS ---');
    const { data, error } = await supabase
        .from('daily_tasks')
        .select('id, description')
        .in('id', ids);
    
    if (error) console.error(error);
    else console.log('Found tasks:', data);
}

main();
