
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedEcosystem() {
    console.log('🚀 Seeding Ecosystem Settings (Lurah Phase 2)...');

    const settings = [
        { key: 'eth_usd_price_feed', value: '0x4aDC67696bA383F43fD60604633031d935f9584b' },
        { key: 'treasury_multisig', value: '0xAfB7C7E711418EFD744f74B4D92c2b91B9668fAa' },
        { key: 'max_gas_price_gwei', value: 100 },
        { key: 'raffle_ticket_price_usdc', value: 0.15 },
        { key: 'sponsorship_listing_fee_usdc', value: 1.0 },
        { key: 'daily_claim_cooldown_sec', value: 86400 },
        { key: 'referral_active_threshold', value: 500 },
        { key: 'referral_bonus_percent', value: 10 }
    ];

    for (const s of settings) {
        const { error } = await supabase.from('system_settings').upsert(s, { onConflict: 'key' });
        if (error) {
            console.error(`❌ Error seeding ${s.key}:`, error.message);
        } else {
            console.log(`✅ Seeded ${s.key}: ${JSON.stringify(s.value)}`);
        }
    }

    console.log('✅ Seeding complete.');
}

seedEcosystem();
