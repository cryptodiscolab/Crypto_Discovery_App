const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * ECOSYSTEM RECOVERY UTILITY - RESTORE USER PARITY
 * 
 * Usage:
 *   node scripts/debug/recover-deadlocked-user.cjs <WALLET_ADDRESS> [--execute]
 * 
 * Example:
 *   node scripts/debug/recover-deadlocked-user.cjs 0x52260c30697674a7c837feb2af21bbf3606795c8
 *   node scripts/debug/recover-deadlocked-user.cjs 0x52260c30697674a7c837feb2af21bbf3606795c8 --execute
 */

function cleanAddr(addr) {
    if (!addr) return '';
    return addr.trim().toLowerCase();
}

async function main() {
    const args = process.argv.slice(2);
    const rawWallet = args.find(arg => arg.startsWith('0x'));
    const shouldExecute = args.includes('--execute');
    const isDryRun = !shouldExecute;

    if (!rawWallet) {
        console.error('❌ Error: Target wallet address is required.');
        console.log('\nUsage:');
        console.log('  node scripts/debug/recover-deadlocked-user.cjs <WALLET_ADDRESS> [--execute]');
        console.log('\nExample:');
        console.log('  node scripts/debug/recover-deadlocked-user.cjs 0x52260c30697674a7C837FEB2af21bBf3606795C8');
        console.log('  node scripts/debug/recover-deadlocked-user.cjs 0x52260c30697674a7C837FEB2af21bBf3606795C8 --execute');
        process.exit(1);
    }

    const wallet = cleanAddr(rawWallet);
    const walletRegex = /^0x[a-f0-9]{40}$/;
    if (!walletRegex.test(wallet)) {
        console.error(`❌ Error: Invalid EVM wallet address format: "${rawWallet}"`);
        process.exit(1);
    }

    const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Error: Missing Supabase credentials in env (VITE_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY).');
        process.exit(1);
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('====================================================');
    console.log('🛡️  ECOSYSTEM RECOVERY UTILITY: USER PARITY RESTORATION');
    console.log(`📡 Target User : ${wallet}`);
    console.log(`🧪 Execution   : ${isDryRun ? 'DRY-RUN (Simulated)' : 'PRODUCTION (Mutating)'}`);
    console.log('====================================================');
    
    // Fetch current DB profile state
    const { data: profile, error: pErr } = await supabase
        .from('user_profiles')
        .select('total_xp, last_onchain_xp, streak_count, last_streak_claim')
        .eq('wallet_address', wallet)
        .maybeSingle();

    if (pErr) {
        console.error('❌ Error fetching user profile:', pErr);
        process.exit(1);
    }

    if (!profile) {
        console.error(`❌ Error: User profile for "${wallet}" not found in database.`);
        process.exit(1);
    }

    console.log('\n📊 Current Database State:');
    console.log(JSON.stringify(profile, null, 2));

    const totalXp = profile.total_xp || 0;
    const lastOnChainXp = profile.last_onchain_xp || 0;

    if (totalXp < lastOnChainXp) {
        const recoveryAmount = lastOnChainXp - totalXp;
        console.log(`\n⚠️  [DEADLOCK DETECTED] total_xp (${totalXp}) < last_onchain_xp (${lastOnChainXp}).`);
        console.log(`🔄 Recovery calculation: +${recoveryAmount} XP required.`);

        if (!shouldExecute) {
            console.log('\n🔬 [DRY-RUN] Simulation successful. The following actions would be executed:');
            console.log(`   1. Run RPC: fn_increment_xp(p_wallet: "${wallet}", p_amount: ${recoveryAmount})`);
            console.log(`   2. Insert User Activity Log: category "XP", type "Parity Recovery" for +${recoveryAmount} XP.`);
            console.log('   3. Re-run with --execute only after reviewing the simulated delta.');
            console.log('🏁 [DRY-RUN] No database modifications were applied.');
            return;
        }

        console.log('\n🚀 Executing live recovery RPC fn_increment_xp...');
        const { error: rpcErr } = await supabase.rpc('fn_increment_xp', {
            p_wallet: wallet,
            p_amount: recoveryAmount
        });

        if (rpcErr) {
            console.error('❌ Error executing fn_increment_xp RPC:', rpcErr);
            process.exit(1);
        }

        console.log('✅ RPC executed successfully! Logging recovery history...');

        const { error: logErr } = await supabase.from('user_activity_logs').insert({
            wallet_address: wallet,
            category: 'XP',
            activity_type: 'Parity Recovery',
            description: `Ecosystem Parity Recovery: Restored +${recoveryAmount} XP from under-sync.`,
            value_amount: recoveryAmount,
            value_symbol: 'XP',
            tx_hash: null,
            metadata: {
                recovery_type: 'deadlock_recovery_utility',
                timestamp_iso: new Date().toISOString()
            }
        });

        if (logErr) {
            console.error('⚠️  Warning: Error inserting activity log:', logErr);
        } else {
            console.log('✅ Activity log inserted successfully.');
        }

        // Fetch and display updated database state
        const { data: updatedProfile } = await supabase
            .from('user_profiles')
            .select('total_xp, last_onchain_xp')
            .eq('wallet_address', wallet)
            .maybeSingle();

        console.log('\n🎉 Updated Database State after Recovery:');
        console.log(JSON.stringify(updatedProfile, null, 2));
        console.log('\n🏁 ✅ SUCCESS: User parity restored successfully.');
    } else {
        console.log('\n✅ State OK: No under-sync deadlock detected. total_xp is already sync-aligned with onchain values.');
    }
}

main().catch(err => {
    console.error('❌ Fatal execution error:', err);
    process.exit(1);
});
