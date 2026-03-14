
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/.env' });

// CRYPTO DISCO APP - DATABASE PURGE & RESET RUNNER
// This script resets the application to a clean production state.

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ CRITICAL: Missing SUPABASE environment variables.");
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- 🛑 STARTING DATABASE PURGE 🛑 ---');

    try {
        // 1. Reset User Profiles
        console.log('[1/4] Reseting User Profiles (XP, Streaks, Wins)...');
        const { error: profileErr } = await supabase
            .from('user_profiles')
            .update({ 
                total_xp: 0, 
                streak_count: 0, 
                raffle_wins: 0,
                tier: 0,
                active_status: 'active'
            })
            .neq('wallet_address', ''); // Targeted update for all

        if (profileErr) throw profileErr;
        console.log('✅ User Profiles reset.');

        // 2. Clear History Tables
        console.log('[2/4] Clearing Task Claims and Activity Logs...');
        try {
            await supabase.from('user_task_claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('user_activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            console.log('✅ History cleared.');
        } catch (e) { console.warn('⚠️ History clear warning:', e.message); }

        // 3. Clear Feature Data (Raffles & Campaigns)
        console.log('[3/4] Clearing Raffles and Campaigns...');
        try {
            // Try UUID first, then fall back to Int
            const { error: rErr } = await supabase.from('raffles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (rErr) await supabase.from('raffles').delete().gte('id', 0);
            
            const { error: cErr } = await supabase.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (cErr) await supabase.from('campaigns').delete().gte('id', 0);
            
            console.log('✅ Feature data cleared.');
        } catch (e) { console.warn('⚠️ Feature clear warning:', e.message); }

        // 4. Remove Redundant Daily Tasks
        console.log('[4/4] Removing Redundant "Daily Mojo" and other Test Tasks...');
        const { error: taskErr } = await supabase
            .from('daily_tasks')
            .delete()
            .neq('task_type', 'system'); // Keeps system-level sync tasks

        if (taskErr) throw taskErr;
        console.log('✅ Non-system daily tasks removed.');

        console.log('\n================================================');
        console.log('🏁 PURGE COMPLETE: Application is now in a clean state.');
        process.exit(0);

    } catch (err) {
        console.error('🚨 PURGE FAILED:', err.message);
        process.exit(1);
    }
}

main();
