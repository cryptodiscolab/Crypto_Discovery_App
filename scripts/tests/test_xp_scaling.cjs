const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testScaling() {
    console.log('--- [v3.41.2] XP HYBRID SCALING STRESS TEST ---');
    
    const testWallet = '0x000000000000000000000000000000000000dEaD';
    const baseReward = 500; // Standard task like raffle_buy

    // 1. Setup Test User (Bronze, 0 XP)
    const { error: upErr } = await supabase.from('user_profiles').upsert({
        wallet_address: testWallet.toLowerCase(),
        total_xp: 0,
        tier: 1 // 1 = Bronze
    });
    if (upErr) throw new Error(`Setup failed: ${upErr.message}`);

    console.log(`\n[Scenario 1] NEW USER (Bronze, 0 XP)`);
    const { error: rpcErr } = await supabase.rpc('fn_increment_xp', { p_wallet: testWallet, p_amount: baseReward });
    if (rpcErr) throw new Error(`RPC failed: ${rpcErr.message}`);

    const { data: res1, error: selErr } = await supabase.from('user_profiles').select('total_xp').eq('wallet_address', testWallet.toLowerCase()).maybeSingle(); // v3.42.2
    if (selErr) throw new Error(`Selection failed: ${selErr.message}`);
    if (!res1) throw new Error('Profile not found after upsert');
    console.log(`Base: ${baseReward} | Result: ${res1.total_xp} XP`);

    // 2. Advance User to Diamond (15,000 XP)
    await supabase.from('user_profiles').update({
        total_xp: 15000,
        tier: 5 // 5 = Diamond
    }).eq('wallet_address', testWallet.toLowerCase());

    console.log(`\n[Scenario 2] WHALE USER (Diamond, 15,000 XP)`);
    await supabase.rpc('fn_increment_xp', { p_wallet: testWallet.not_exists_path ? 'ERROR' : testWallet, p_amount: baseReward });
    const { data: res2 } = await supabase.from('user_profiles').select('total_xp').eq('wallet_address', testWallet.toLowerCase()).maybeSingle(); // v3.42.2
    const delta = res2.total_xp - 15000;
    console.log(`Base: ${baseReward} | Result: +${delta} XP (Expected: Significant reduction, no Underdog bonus)`);

    // 3. Test Minimum Floor (5 XP)
    console.log(`\n[Scenario 3] MINIMUM FLOOR TEST (Tiny Reward)`);
    const tinyReward = 1; 
    await supabase.rpc('fn_increment_xp', { p_wallet: testWallet, p_amount: tinyReward });
    const { data: res3 } = await supabase.from('user_profiles').select('total_xp').eq('wallet_address', testWallet.toLowerCase()).maybeSingle(); // v3.42.2
    const floorDelta = res3.total_xp - res2.total_xp;
    console.log(`Base: ${tinyReward} | Result: +${floorDelta} XP (Expected: 5 XP Floor)`);

    // Clean up
    await supabase.from('user_profiles').delete().eq('wallet_address', testWallet.toLowerCase());
    console.log('\n--- TEST COMPLETE ---');
}

testScaling().catch(console.error);
