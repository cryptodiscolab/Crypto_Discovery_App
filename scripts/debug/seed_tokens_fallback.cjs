const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../Raffle_Frontend/.env') });

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Missing Supabase credentials in .env');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const tokens = [
        {
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            name: 'Native Ether',
            decimals: 18,
            is_active: true
        },
        {
            address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            is_active: true
        },
        {
            address: '0x3ba0c1fa4d6f2f758b8fb222b063b8f6969dafb4',
            symbol: 'CREATOR',
            name: 'Creator Token',
            decimals: 18,
            is_active: true
        }
    ];

    console.log('🚀 Setting allowed_tokens (fallback) in system_settings...');

    const { error } = await supabase
        .from('system_settings')
        .upsert({ 
            key: 'whitelisted_tokens_json', 
            value: tokens 
        }, { onConflict: 'key' });

    if (error) {
        console.error('❌ Failed to update system_settings:', error.message);
    } else {
        console.log('✅ whitelisted_tokens_json updated in system_settings.');
    }
}

main();
