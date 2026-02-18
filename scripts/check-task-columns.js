const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: tasks, error: tErr } = await supabase.from('daily_tasks').select('*').limit(1);
    if (tErr) console.error(tErr); else console.log('Columns:', Object.keys(tasks[0]));
}

main();
