require('dotenv').config();
const hre = require('hardhat');

const V15 = '0x0D6f339795EeA5129461388F25dE4f87e92b8DA2';

async function main() {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all users
    const { data: users } = await supabase
        .from('user_profiles')
        .select('wallet_address, total_xp, tier')
        .order('total_xp', { ascending: false });

    if (!users || users.length === 0) { console.log('No users.'); return; }

    console.log(`🚀 Migrating ${users.length} users to V15...`);

    const v15 = await hre.ethers.getContractAt('DailyAppV15', V15);

    const addresses = users.map(u => u.wallet_address);
    const stats = users.map(u => ({
        points: BigInt(u.total_xp || 0),
        totalTasksCompleted: 0n,
        referralCount: 0n,
        currentTier: u.tier || 0,
        tasksForReferralProgress: 0n,
        lastDailyBonusClaim: 0n,
        isBlacklisted: false
    }));
    const maxSyncedXp = users.map(u => BigInt(u.total_xp || 0));

    console.log('Users:', addresses.map((a, i) => `${a.slice(0,10)}... = ${users[i].total_xp} XP (tier ${users[i].tier})`));

    const tx = await v15.batchMigrateUsers(addresses, stats, maxSyncedXp);
    console.log('⏳ TX:', tx.hash);
    await tx.wait();
    console.log('✅ Migration complete!');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
