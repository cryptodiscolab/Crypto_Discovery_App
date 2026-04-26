
// global_ghost_claim_audit.cjs — Global Ghost Claim Audit & Recovery
// Scans ALL wallets in user_profiles for missing activity logs
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = false; // false = langsung recover semua ghost claims

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
);

async function auditWallet(wallet) {
  // Ambil semua claims
  const { data: claims, error: claimsErr } = await supabase
    .from('user_task_claims')
    .select('*')
    .ilike('wallet_address', wallet);

  if (claimsErr || !claims?.length) return { wallet, ghosts: [] };

  // Ambil semua logs
  const { data: logs } = await supabase
    .from('user_activity_logs')
    .select('tx_hash, metadata')
    .ilike('wallet_address', wallet);

  const loggedTxHashes = new Set((logs || []).map(l => l.tx_hash).filter(Boolean));
  const loggedTaskIds  = new Set((logs || []).map(l => l.metadata?.task_id).filter(Boolean));

  const ghosts = claims.filter(c => {
    const hasTx   = c.target_id && loggedTxHashes.has(c.target_id);
    const hasTask = loggedTaskIds.has(c.task_id);
    return !hasTx && !hasTask;
  });

  return { wallet, ghosts, totalClaims: claims.length };
}

async function recover(wallet, ghosts) {
  const logsToInsert = ghosts.map(claim => ({
    wallet_address: wallet.toLowerCase(),
    category: 'XP',
    activity_type: claim.platform === 'blockchain' ? 'Daily Claim' : 'Task Claim',
    description: claim.platform === 'blockchain'
      ? `[RECOVERED] Earned ${claim.xp_earned} XP from Daily Bonus`
      : `[RECOVERED] Claimed ${claim.xp_earned} XP for ${claim.task_id}`,
    value_amount: claim.xp_earned,
    value_symbol: 'XP',
    tx_hash: claim.target_id || null,
    metadata: {
      task_id: claim.task_id,
      source: 'global_ghost_recovery_script',
      original_claimed_at: claim.claimed_at,
    },
    created_at: claim.claimed_at,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('user_activity_logs')
    .insert(logsToInsert)
    .select();

  if (insertErr) return { success: false, error: insertErr.message };
  return { success: true, count: inserted.length };
}

async function main() {
  console.log('\n🌐 GLOBAL GHOST CLAIM AUDIT');
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE RECOVERY'}`);
  console.log('   Scanning all wallets...\n');

  // Ambil semua wallet dari user_profiles
  const { data: profiles, error: profilesErr } = await supabase
    .from('user_profiles')
    .select('wallet_address, total_xp, tier')
    .order('total_xp', { ascending: false });

  if (profilesErr) {
    console.error('❌ Gagal mengambil user_profiles:', profilesErr.message);
    process.exit(1);
  }

  console.log(`👥 Total akun ditemukan: ${profiles.length}\n`);

  let totalGhosts = 0;
  let totalRecovered = 0;
  const report = [];

  for (const profile of profiles) {
    const { wallet, ghosts, totalClaims } = await auditWallet(profile.wallet_address);

    if (ghosts.length > 0) {
      totalGhosts += ghosts.length;
      const short = wallet.slice(0, 10) + '...' + wallet.slice(-6);

      console.log(`⚠️  ${short} — XP: ${profile.total_xp} | Tier: ${profile.tier}`);
      console.log(`    Total Claims: ${totalClaims} | Ghost Claims: ${ghosts.length}`);
      ghosts.forEach(g => {
        console.log(`    → task_id: ${g.task_id.slice(0,8)}... | xp: ${g.xp_earned} | ${g.claimed_at?.slice(0,10)}`);
      });

      if (!DRY_RUN) {
        const result = await recover(wallet, ghosts);
        if (result.success) {
          totalRecovered += result.count;
          console.log(`    ✅ Recovered ${result.count} log(s)`);
        } else {
          console.log(`    ❌ Recovery failed: ${result.error}`);
        }
      }

      report.push({ wallet, xp: profile.total_xp, tier: profile.tier, ghostCount: ghosts.length });
      console.log();
    }
  }

  // Summary
  console.log('═'.repeat(55));
  console.log(`\n📊 AUDIT SUMMARY`);
  console.log(`   Total akun di-scan : ${profiles.length}`);
  console.log(`   Akun dengan ghost  : ${report.length}`);
  console.log(`   Total ghost claims : ${totalGhosts}`);
  if (!DRY_RUN) {
    console.log(`   Total log dipulihkan: ${totalRecovered}`);
  }

  if (report.length === 0) {
    console.log('\n🎉 Semua akun bersih! Tidak ada Ghost Claims.\n');
  } else {
    console.log('\n📋 Daftar akun yang terdampak:');
    console.table(report.map(r => ({
      wallet: r.wallet.slice(0,10)+'...'+r.wallet.slice(-6),
      xp: r.xp,
      tier: r.tier,
      ghosts: r.ghostCount,
      status: DRY_RUN ? 'NOT RECOVERED' : 'RECOVERED ✅'
    })));
  }
  console.log();
}

main().catch(console.error);
