const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- Daily Tasks ---');
    const { data: tasks, error: tErr } = await supabase.from('daily_tasks').select('*');
    if (tErr) console.error(tErr); else console.table(tasks);

    console.log('\n--- Recent Task Claims ---');
    const { data: claims, error: cErr } = await supabase.from('user_task_claims').select('*').limit(5);
    if (cErr) console.error(cErr); else console.table(claims);

    console.log('\n--- User Profiles (Top 5) ---');
    const { data: profiles, error: pErr } = await supabase.from('user_profiles').select('wallet_address, xp, tier').order('xp', { ascending: false }).limit(5);
    if (pErr) console.error(pErr); else console.table(profiles);
}

main();
