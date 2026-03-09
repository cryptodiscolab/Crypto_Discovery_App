const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const wallet = '0x455DF75735d2a18c26f0AfDefa93217B60369fe5'.toLowerCase();

    console.log('--- USER PROFILE ---');
    const { data: profile, error: pErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('wallet_address', wallet)
        .maybeSingle();
    
    if (pErr) console.error(pErr);
    else console.log(JSON.stringify(profile, null, 2));

    console.log('--- USER TASK CLAIMS ---');
    const { data: claims, error: cErr } = await supabase
        .from('user_task_claims')
        .select('*')
        .eq('wallet_address', wallet);
    
    if (cErr) console.error(cErr);
    else console.log('Claims count:', claims.length, claims);

    console.log('--- USER ACTIVITY LOGS ---');
    const { data: logs, error: lErr } = await supabase
        .from('user_activity_logs')
        .select('*')
        .eq('wallet_address', wallet)
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (lErr) console.error(lErr);
    else console.log(JSON.stringify(logs, null, 2));
}

main();
