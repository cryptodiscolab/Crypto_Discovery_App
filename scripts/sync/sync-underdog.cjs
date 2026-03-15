const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase configuration");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Calculates the 20th percentile of XP across all users.
 * Purpose: Population-aware Underdog Bonus threshold (v3.20.0)
 */
async function syncUnderdogThreshold() {
    console.log("📡 [Underdog Sync] Starting percentile calculation...");

    try {
        // 1. Fetch all XP values
        const { data: users, error } = await supabase
            .from('user_profiles')
            .select('total_xp')
            .gt('total_xp', 0) // Only consider active users
            .order('total_xp', { ascending: true });

        if (error) throw error;
        if (!users || users.length === 0) {
            console.log("⚠️ No active users found. Threshold defaults to 0.");
            await updateThreshold(0);
            return;
        }

        // 2. Calculate 20th Percentile
        const count = users.length;
        const index = Math.floor(count * 0.2); // 20th percentile
        const thresholdXp = users[index]?.total_xp || 0;

        console.log(`📊 Population Size: ${count} users`);
        console.log(`🎯 20th Percentile Index: ${index}`);
        console.log(`🔥 Calculated Underdog Threshold: ${thresholdXp} XP`);

        // v3.22.0: Recovery & Auto-Healing Check
        const { data: healthRecord } = await supabase
            .from('system_health')
            .select('*')
            .eq('service_key', 'sync-underdog')
            .maybeSingle();

        let consecutiveSuccess = healthRecord?.metadata?.consecutive_success || 0;
        let isRecovering = healthRecord?.status === 'failed' || healthRecord?.status === 'recovering';

        if (isRecovering) {
            consecutiveSuccess++;
            console.log(`🩹 [Auto-Healing] Recovery run ${consecutiveSuccess}/3 in progress...`);
        } else {
            consecutiveSuccess = 0;
        }

        // 3. Update System Settings
        const { error: syncErr } = await supabase
            .from('system_settings')
            .upsert({
                key: 'underdog_threshold_xp',
                value: Number(thresholdXp),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (syncErr) throw syncErr;

        console.log("✅ Successfully updated 'underdog_threshold_xp' in Supabase.");

        // 4. Update Health State (Auto-Reset Logic)
        let finalStatus = 'healthy';
        let finalError = null;

        if (isRecovering && consecutiveSuccess < 3) {
            finalStatus = 'recovering';
            finalError = healthRecord.last_error;
        } else if (isRecovering && consecutiveSuccess >= 3) {
            console.log("🎊 [Auto-Healing] Service fully recovered!");
            finalStatus = 'healthy';
            finalError = null;
            consecutiveSuccess = 0;
        }

        await supabase.from('system_health').upsert({
            service_key: 'sync-underdog',
            status: finalStatus,
            last_heartbeat: new Date().toISOString(),
            last_error: finalError,
            metadata: { consecutive_success: consecutiveSuccess },
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });

    } catch (err) {
        console.error("❌ Underdog Sync Error:", err.message);
        await supabase.from('system_health').upsert({
            service_key: 'sync-underdog',
            status: 'failed',
            last_error: err.message,
            metadata: { consecutive_success: 0 },
            updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' });
        process.exit(1);
    }
}

syncUnderdogThreshold();
