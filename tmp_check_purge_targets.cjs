
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
    const { data: campaigns } = await supabase.from('campaigns').select('id, title');
    const { data: profiles } = await supabase.from('user_profiles').select('wallet_address, total_xp, streak_count').limit(10);
    
    console.log('--- CAMPAIGNS ---');
    campaigns?.forEach(c => console.log(`[${c.id}] ${c.title}`));
    
    console.log('\n--- TOP PROFILES ---');
    profiles?.forEach(p => console.log(`[${p.wallet_address}] XP: ${p.total_xp}, Streak: ${p.streak_count}`));
}

checkData();
