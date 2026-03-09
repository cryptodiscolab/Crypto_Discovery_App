
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTasks() {
    const { data, error } = await supabase
        .from('daily_tasks')
        .select('*');
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('--- ACTIVE TASKS ---');
    data.forEach(t => {
        console.log(`[${t.id}] ${t.description} (${t.task_type}) - Active: ${t.is_active}`);
    });
}

checkTasks();
