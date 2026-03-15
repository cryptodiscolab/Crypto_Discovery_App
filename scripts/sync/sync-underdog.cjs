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

        // 3. Update System Settings
        await updateThreshold(thresholdXp);

    } catch (err) {
        console.error("❌ Underdog Sync Error:", err.message);
        process.exit(1);
    }
}

async function updateThreshold(val) {
    const { error } = await supabase
        .from('system_settings')
        .upsert({
            key: 'underdog_threshold_xp',
            value: Number(val), // JSONB stores number
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) {
        console.error("❌ Failed to update system_settings:", error.message);
    } else {
        console.log("✅ Successfully updated 'underdog_threshold_xp' in Supabase.");
    }
}

syncUnderdogThreshold();
