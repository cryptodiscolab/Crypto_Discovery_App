require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const V15 = '0x0D6f339795EeA5129461388F25dE4f87e92b8DA2';
const MASTER_X = process.env.VITE_MASTER_X_ADDRESS_SEPOLIA;

const rpc = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org')
});

const USER_STATS_ABI = [{
    name: 'userStats', type: 'function', stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [
        { type: 'uint256', name: 'points' },
        { type: 'uint256', name: 'totalTasksCompleted' },
        { type: 'uint256', name: 'referralCount' },
        { type: 'uint8', name: 'currentTier' },
        { type: 'uint256', name: 'tasksForReferralProgress' },
        { type: 'uint256', name: 'lastDailyBonusClaim' },
        { type: 'bool', name: 'isBlacklisted' }
    ]
}];

const MASTER_X_ABI = [{
    name: 'users', type: 'function', stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [
        { type: 'uint256', name: 'points' },
        { type: 'uint64', name: 'lastClaimTimestamp' },
        { type: 'uint32', name: 'referralCount' },
        { type: 'uint8', name: 'tier' },
        { type: 'bool', name: 'isVerified' },
        { type: 'address', name: 'referrer' },
        { type: 'uint32', name: 'lastUpdateSeasonId' }
    ]
}];

async function main() {
    console.log('🔍 XP DRIFT AUDIT: Database vs On-Chain\n');

    const { data: users } = await supabase
        .from('user_profiles')
        .select('wallet_address, total_xp, tier, display_name')
        .order('total_xp', { ascending: false });

    if (!users || users.length === 0) { console.log('No users found.'); return; }

    console.log(`${'USER'.padEnd(20)} | ${'DB XP'.padStart(8)} | ${'V15 XP'.padStart(8)} | ${'MX XP'.padStart(8)} | ${'DB TIER'.padStart(7)} | ${'V15 TIER'.padStart(8)} | ${'MX TIER'.padStart(7)} | DRIFT`);
    console.log('-'.repeat(110));

    let totalDrift = 0;
    let driftCount = 0;

    for (const u of users) {
        try {
            const [v15Stats, mxStats] = await Promise.all([
                rpc.readContract({ address: V15, abi: USER_STATS_ABI, functionName: 'userStats', args: [u.wallet_address] }),
                rpc.readContract({ address: MASTER_X, abi: MASTER_X_ABI, functionName: 'users', args: [u.wallet_address] })
            ]);

            const v15Xp = Number(v15Stats[0]);
            const v15Tier = Number(v15Stats[3]);
            const mxXp = Number(mxStats[0]);
            const mxTier = Number(mxStats[3]);
            const dbXp = u.total_xp || 0;
            const dbTier = u.tier || 0;

            const drift = dbXp - v15Xp;
            const status = drift === 0 ? '✅' : drift > 0 ? `⚠️ +${drift}` : `🔴 ${drift}`;

            if (drift !== 0) { totalDrift += Math.abs(drift); driftCount++; }

            const name = (u.display_name || u.wallet_address.slice(0, 10)).padEnd(20);
            console.log(`${name} | ${String(dbXp).padStart(8)} | ${String(v15Xp).padStart(8)} | ${String(mxXp).padStart(8)} | ${String(dbTier).padStart(7)} | ${String(v15Tier).padStart(8)} | ${String(mxTier).padStart(7)} | ${status}`);
        } catch (err) {
            console.log(`${u.wallet_address.slice(0, 20).padEnd(20)} | ERROR: ${err.message.slice(0, 50)}`);
        }
    }

    console.log('-'.repeat(110));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Users with Drift: ${driftCount}`);
    console.log(`   Total XP Drift: ${totalDrift}`);
    console.log(`   Status: ${driftCount === 0 ? '✅ PERFECTLY SYNCED' : '⚠️ DRIFT DETECTED — migration needed'}`);
}

main().catch(e => console.error('❌', e.message));
