const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const tasksToEnsure = [
        { description: 'On-Chain Daily Claim', xp_reward: 100, is_active: true },
        { description: 'Raffle Ticket Purchase', xp_reward: 0, is_active: true }
    ];

    for (const t of tasksToEnsure) {
        const { data: existing } = await supabase.from('daily_tasks').select('id').eq('description', t.description).single();
        if (!existing) {
            console.log(`Creating task: ${t.description}`);
            const { data: created, error } = await supabase.from('daily_tasks').insert([t]).select('id').single();
            if (error) console.error(error);
            else console.log(`Created ${t.description} with ID: ${created.id}`);
        } else {
            console.log(`${t.description} already exists with ID: ${existing.id}`);
        }
    }
}

main();
