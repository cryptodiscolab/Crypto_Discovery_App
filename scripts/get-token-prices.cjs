const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../Raffle_Frontend/.env') });

async function main() {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Missing Supabase credentials');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Tokens to track
    const tokens = [
        { symbol: 'ETH', address: '0x4200000000000000000000000000000000000006' }, // Wrapped ETH on Base
        { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }, // USDC on Base
        { symbol: 'CREATOR', address: '0x3ba0c1fa4d6f2f758b8fb222b063b8f6969dafb4' } // Creator Token on Base
    ];

    console.log('🚀 Fetching prices from DexScreener...');

    const prices = {};

    for (const token of tokens) {
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`);
            const data = await response.json();
            
            if (data.pairs && data.pairs.length > 0) {
                // Find highest liquidity pair or just first
                const priceUsd = parseFloat(data.pairs[0].priceUsd);
                prices[token.symbol] = priceUsd;
                console.log(`✅ ${token.symbol}: $${priceUsd}`);
            } else if (token.symbol === 'USDC') {
                prices[token.symbol] = 1.0; // Hard fallback for stable
                console.log(`✅ ${token.symbol}: $1.00 (fallback)`);
            } else {
                console.warn(`⚠️ No pairs found for ${token.symbol}`);
                prices[token.symbol] = 0;
            }
        } catch (err) {
            console.error(`❌ Error fetching ${token.symbol}:`, err.message);
        }
    }

    // Save to system_settings
    const { error } = await supabase
        .from('system_settings')
        .upsert({ 
            key: 'token_prices_usd', 
            value: prices 
        }, { onConflict: 'key' });

    if (error) {
        console.error('❌ Failed to update system_settings:', error.message);
    } else {
        console.log('✅ token_prices_usd updated in system_settings.');
    }
}

main();
