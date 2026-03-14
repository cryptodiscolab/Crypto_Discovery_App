
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTiersAndSettings() {
    const { data: settings } = await supabase.from('system_settings').select('*');
    const { data: tiers } = await supabase.from('sbt_thresholds').select('*').order('level');
    
    console.log('--- SYSTEM SETTINGS ---');
    console.log(settings);
    
    console.log('\n--- SBT THRESHOLDS ---');
    console.log(tiers);

    // Look for any table related to tokens
    const { data: whitelisted, error: wErr } = await supabase.from('whitelisted_tokens').select('*');
    if (wErr) {
        console.error('\n--- WHITELISTED TOKENS (Error) ---');
        console.error(wErr.message);
    } else {
        console.log('\n--- WHITELISTED TOKENS ---');
        console.log(whitelisted);
    }
}

checkTiersAndSettings();
