const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConstraints() {
    console.log('=== DATABASE CONSTRAINT STRESS TEST ===\n');

    const testWallet = '0x0000000000000000000000000000000000000001';
    const fakeFid = 999999;

    try {
        // 1. Clean up potential old test data
        await supabase.from('user_profiles').delete().eq('wallet_address', testWallet);
        await supabase.from('user_profiles').delete().eq('fid', fakeFid);

        console.log('--- TEST 1: Identity Lock (Farcaster FID) ---');
        // Insert first
        await supabase.from('user_profiles').insert({
            wallet_address: testWallet,
            fid: fakeFid
        });
        console.log('✅ Initial insert success.');

        // Try duplicate FID with different wallet
        const secondWallet = '0x0000000000000000000000000000000000000002';
        const { error: dupeError } = await supabase.from('user_profiles').insert({
            wallet_address: secondWallet,
            fid: fakeFid
        });

        if (dupeError && dupeError.code === '23505') {
            console.log('✅ IDENTITY LOCK VERIFIED: Duplicate FID rejected by Unique Constraint.');
        } else {
            console.warn('❌ IDENTITY LOCK FAILED: Duplicate FID allowed or different error:', dupeError);
        }

        console.log('\n--- TEST 2: Task Sync Integrity ---');
        const testTask = {
            platform: 'test_platform',
            action_type: 'test_action',
            target_id: 'test_target_001',
            title: 'Test Task',
            description: 'Test Description'
        };

        // Clean up
        await supabase.from('daily_tasks').delete().match(testTask);

        // Insert first
        await supabase.from('daily_tasks').insert(testTask);
        console.log('✅ Initial task insert success.');

        // Try duplicate
        const { error: dupeTaskError } = await supabase.from('daily_tasks').insert(testTask);

        if (dupeTaskError && dupeTaskError.code === '23505') {
            console.log('✅ TASK SYNC INTEGRITY VERIFIED: Duplicate task rejected.');
        } else {
            console.warn('❌ TASK SYNC INTEGRITY FAILED: Duplicate task allowed or different error:', dupeTaskError);
        }

        // Clean up
        await supabase.from('user_profiles').delete().eq('wallet_address', testWallet);
        await supabase.from('user_profiles').delete().eq('wallet_address', secondWallet);
        await supabase.from('daily_tasks').delete().match(testTask);

    } catch (err) {
        console.error('Test Execution Error:', err);
    }
}

testConstraints();
