/**
 * TIER PERCENTILE CALCULATOR
 * Calculates XP thresholds based on user distribution and updates sbt_thresholds.
 * Path: .agents/scripts/tier-calculator.js
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Default Configuration: Used if system_settings is empty
const DEFAULT_TIERS = [
    { level: 5, name: 'Diamond', percentile: 0.99, minXP: 10000 },
    { level: 4, name: 'Platinum', percentile: 0.95, minXP: 5000 },
    { level: 3, name: 'Gold', percentile: 0.90, minXP: 2500 },
    { level: 2, name: 'Silver', percentile: 0.75, minXP: 1000 },
    { level: 1, name: 'Bronze', percentile: 0, minXP: 0 }
];

async function updateThresholds() {
    console.log('📈 [Tier Calculator] Calculating dynamic thresholds...');

    // 0. Fetch Config from DB
    const { data: configRecord } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'tier_config')
        .single();
    
    const TIERS = configRecord?.value?.tiers || DEFAULT_TIERS;
    console.log('⚙️ Using Tier Configuration:', configRecord ? 'Database' : 'Default Scripts');

    // 1. Fetch all user XP
    const { data: users, error } = await supabase
        .from('user_profiles')
        .select('total_xp')
        .order('total_xp', { ascending: true });

    if (error) {
        console.error('❌ Error fetching users:', error.message);
        return;
    }

    const totalUsers = users.length;
    console.log(`📊 Total Users: ${totalUsers}`);

    const xpVols = users.map(u => u.total_xp);

    // 2. Calculate thresholds for each tier
    const updates = TIERS.map(tier => {
        let threshold = tier.minXP;

        if (totalUsers >= 10) { // Only use percentile if we have enough users
            const index = Math.floor(totalUsers * tier.percentile);
            const percentileValue = xpVols[index] || 0;
            // Use the higher value between absolute floor and percentile
            threshold = Math.max(tier.minXP, percentileValue);
        }

        console.log(`🔹 Tier ${tier.name} (Lvl ${tier.level}): Threshold set to ${threshold} XP`);

        return {
            level: tier.level,
            min_xp: threshold,
            tier_name: tier.name
        };
    });

    // 3. Update sbt_thresholds table
    const { error: updateError } = await supabase
        .from('sbt_thresholds')
        .upsert(updates, { onConflict: 'level' });

    if (updateError) {
        console.error('❌ Error updating sbt_thresholds:', updateError.message);
    } else {
        console.log('✅ sbt_thresholds updated successfully.');
    }
}

updateThresholds();
