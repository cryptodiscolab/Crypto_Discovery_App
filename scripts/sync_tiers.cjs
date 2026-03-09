
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateTiers() {
    console.log('--- SYNCING THRESHOLDS ---');
    
    // Ensure Diamond exists
    const { error: dErr } = await supabase
        .from('sbt_thresholds')
        .upsert({
            level: 6,
            tier_name: 'Diamond',
            min_xp: 150000,
            badge_url: 'https://crypto-discovery-app.vercel.app/badges/diamond.png'
        }, { onConflict: 'level' });

    if (dErr) console.error('Error adding Diamond:', dErr);
    else console.log('✅ Diamond tier synchronized (Level 6).');

    // Add Rookie if missing
    const { error: rErr } = await supabase
        .from('sbt_thresholds')
        .upsert({
            level: 1,
            tier_name: 'Rookie',
            min_xp: 0,
            badge_url: 'https://crypto-discovery-app.vercel.app/badges/rookie.png'
        }, { onConflict: 'level' });
        
    if (rErr) console.error('Error adding Rookie:', rErr);
    else console.log('✅ Rookie tier synchronized (Level 1).');

    console.log('--- THRESHOLDS SYNCED ---');
}

updateTiers();
