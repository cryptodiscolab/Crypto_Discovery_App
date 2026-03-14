
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/.env' });

const supabaseStats = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testLeaderboard() {
    console.log('--- TESTING LEADERBOARD DATA ---');
    
    // Check if v_user_full_profile has Diamond/Rookie users (if any)
    const { data: global, error: err1 } = await supabaseStats
        .from('v_user_full_profile')
        .select('*')
        .order('total_xp', { ascending: false })
        .limit(5);

    if (err1) console.error('View Error:', err1);
    else {
        console.log('Global Top 5:');
        global.forEach(u => console.log(`- ${u.wallet_address}: ${u.total_xp} XP (${u.rank_name})`));
    }

    // Check sbt_thresholds listing
    const { data: tiers, error: err2 } = await supabaseStats
        .from('sbt_thresholds')
        .select('*')
        .order('level', { ascending: true });

    if (err2) console.error('Tiers Error:', err2);
    else {
        console.log('\nSystem Tiers:');
        tiers.forEach(t => console.log(`- Level ${t.level}: ${t.tier_name}`));
    }
}

testLeaderboard();
