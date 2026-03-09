
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    const { data: campaigns } = await supabase.from('campaigns').select('*').limit(1);
    const { data: raffles } = await supabase.from('raffles').select('*').limit(1);
    
    console.log('--- CAMPAIGNS SAMPLE ---');
    console.log(campaigns?.[0] || 'No rows');
    
    console.log('\n--- RAFFLES SAMPLE ---');
    console.log(raffles?.[0] || 'No rows');
}

checkSchema();
