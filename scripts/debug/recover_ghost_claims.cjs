
// recover_ghost_claims.cjs — Manual Ghost Claim Recovery
// Finds user_task_claims that have NO matching user_activity_logs entry
// and writes the missing log entries WITHOUT re-adding XP.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const WALLET = '0x52260C30697674A7C837feb2Af21BbF3606795C8';
const DRY_RUN = false; // Set ke true untuk hanya preview, tanpa menyimpan ke DB

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
);

async function main() {
  console.log(`\n🛠️  Ghost Claim Recovery — wallet: ${WALLET}`);
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '⚡ LIVE (will write to DB)'}\n`);

  // 1. Ambil semua task claims milik wallet ini
  const { data: claims, error: claimsErr } = await supabase
    .from('user_task_claims')
    .select('*')
    .ilike('wallet_address', WALLET)
    .order('claimed_at', { ascending: false });

  if (claimsErr) {
    console.error('❌ Gagal mengambil task claims:', claimsErr.message);
    process.exit(1);
  }
  console.log(`📋 Total task claims ditemukan: ${claims.length}`);

  // 2. Ambil semua activity logs yang punya tx_hash atau metadata.task_id
  const { data: logs, error: logsErr } = await supabase
    .from('user_activity_logs')
    .select('id, tx_hash, metadata, created_at, activity_type')
    .ilike('wallet_address', WALLET);

  if (logsErr) {
    console.error('❌ Gagal mengambil activity logs:', logsErr.message);
    process.exit(1);
  }
  console.log(`📝 Total activity logs ditemukan: ${logs.length}\n`);

  // Buat set dari tx_hash dan task_id yang sudah ada di logs
  const loggedTxHashes = new Set(logs.map(l => l.tx_hash).filter(Boolean));
  const loggedTaskIds  = new Set(
    logs
      .map(l => l.metadata?.task_id)
      .filter(Boolean)
  );

  // 3. Identifikasi Ghost Claims
  const ghosts = claims.filter(claim => {
    const hasTxHash = claim.target_id && loggedTxHashes.has(claim.target_id);
    const hasTaskId = loggedTaskIds.has(claim.task_id);
    return !hasTxHash && !hasTaskId;
  });

  if (ghosts.length === 0) {
    console.log('✅ Tidak ada Ghost Claims ditemukan. Semua klaim sudah punya Activity Log.\n');
    return;
  }

  console.log(`⚠️  Ditemukan ${ghosts.length} Ghost Claim(s) tanpa Activity Log:\n`);
  ghosts.forEach((g, i) => {
    console.log(`  [${i + 1}] task_id: ${g.task_id}`);
    console.log(`       xp_earned: ${g.xp_earned} | platform: ${g.platform || 'off-chain'}`);
    console.log(`       claimed_at: ${g.claimed_at}`);
    console.log(`       target_id (tx_hash): ${g.target_id || 'N/A'}\n`);
  });

  if (DRY_RUN) {
    console.log('🔍 DRY RUN — Tidak ada perubahan yang disimpan.');
    return;
  }

  // 4. Tulis Activity Log yang hilang (TANPA tambah XP lagi)
  const logsToInsert = ghosts.map(claim => ({
    wallet_address: WALLET.toLowerCase(),
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
      source: 'ghost_claim_recovery_script',
      original_claimed_at: claim.claimed_at,
    },
    created_at: claim.claimed_at,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('user_activity_logs')
    .insert(logsToInsert)
    .select();

  if (insertErr) {
    console.error('❌ Gagal menyimpan recovery logs:', insertErr.message);
    process.exit(1);
  }

  console.log(`✅ Berhasil memulihkan ${inserted.length} Activity Log(s):\n`);
  inserted.forEach((l, i) => {
    console.log(`  [${i + 1}] ID: ${l.id}`);
    console.log(`       type: ${l.activity_type} | xp: ${l.value_amount} | task_id: ${l.metadata?.task_id}`);
    console.log(`       created_at (restored): ${l.created_at}\n`);
  });

  // 5. Tampilkan XP terbaru (verifikasi tidak ada perubahan)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('total_xp, tier')
    .ilike('wallet_address', WALLET)
    .single();

  console.log(`\n📊 XP Verification (setelah recovery):`);
  console.log(`   total_xp : ${profile?.total_xp} (tidak berubah — XP sudah ada)`);
  console.log(`   tier     : ${profile?.tier}`);
  console.log('\n🎯 Ghost Claim Recovery selesai. Tidak ada XP ganda.\n');
}

main().catch(console.error);
