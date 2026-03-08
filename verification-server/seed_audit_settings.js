/**
 * SEED AUDIT SETTINGS
 * Initializes dynamic thresholds for Lurah Ekosistem (Autonomous Sentinel)
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const auditSettings = {
    xp_anomaly_threshold: 5000,          // XP earned in single task
    sybil_lookback_days: 7,             // Days to check for repeat social ID usage
    sybil_wallet_threshold: 1,           // Max wallets per social ID (exclusive)
    audit_interval_hours: 24,            // How often the cron should analyze
    telegram_notifications: true,        // Enable/Disable auto-reporting
    ai_model: "gemini-2.0-flash",       // Standard model
    security_level: "high"               // Zero-trust policy enforcement
};

async function seed() {
    console.log('🌱 Seeding Audit Settings...');

    const { data, error } = await supabase
        .from('system_settings')
        .upsert({
            key: 'audit_settings',
            value: auditSettings,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) {
        console.error('❌ Error seeding audit_settings:', error.message);
    } else {
        console.log('✅ Audit Settings seeded successfully!');
        console.log(JSON.stringify(auditSettings, null, 2));
    }
}

seed();
