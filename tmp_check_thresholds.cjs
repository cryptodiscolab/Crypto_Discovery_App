
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkThresholds() {
    const { data, error } = await supabase
        .from('sbt_thresholds')
        .select('*')
        .order('min_xp', { ascending: true });
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('--- SBT THRESHOLDS ---');
    data.forEach(t => {
        console.log(`[Level ${t.level}] ${t.tier_name}: ${t.min_xp} XP`);
    });
}

checkThresholds();
