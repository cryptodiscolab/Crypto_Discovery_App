
// check_wallet_claim.cjs — Schema-aware audit script
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const WALLET = '0x52260C30697674A7C837feb2Af21BbF3606795C8';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
);

async function getColumns(table) {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: table }).catch(() => ({ data: null, error: 'no rpc' }));
  // fallback: just select * limit 1
  const { data: sample } = await supabase.from(table).select('*').limit(1);
  if (sample?.[0]) return Object.keys(sample[0]);
  return [];
}

async function main() {
  console.log(`\n🔍 Auditing wallet: ${WALLET}\n`);

  // --- Detect schema ---
  const profileSample = await supabase.from('user_profiles').select('*').limit(1);
  const claimSample   = await supabase.from('user_task_claims').select('*').limit(1);
  const logSample     = await supabase.from('user_activity_logs').select('*').limit(1);

  console.log('📌 user_profiles columns:', profileSample.data?.[0] ? Object.keys(profileSample.data[0]).join(', ') : 'N/A');
  console.log('📌 user_task_claims columns:', claimSample.data?.[0] ? Object.keys(claimSample.data[0]).join(', ') : 'N/A');
  console.log('📌 user_activity_logs columns:', logSample.data?.[0] ? Object.keys(logSample.data[0]).join(', ') : 'N/A');

  // --- 1. User Profile ---
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('wallet_address', WALLET)
    .single();

  if (profileErr) {
    console.error('\n❌ Profile error:', profileErr.message);
  } else {
    console.log('\n👤 USER PROFILE:');
    console.log(JSON.stringify(profile, null, 2));
  }

  // --- 2. Task Claims ---
  const { data: claims, error: claimsErr } = await supabase
    .from('user_task_claims')
    .select('*')
    .ilike('wallet_address', WALLET)
    .order('id', { ascending: false })
    .limit(10);

  if (claimsErr) {
    console.error('\n❌ Claims error:', claimsErr.message);
  } else {
    console.log(`\n📋 TASK CLAIMS (last ${claims?.length || 0}):`);
    if (claims?.length) {
      claims.forEach(c => console.log(JSON.stringify(c)));
    } else {
      console.log('  → No claims found.');
    }
  }

  // --- 3. Activity Logs ---
  const { data: logs, error: logsErr } = await supabase
    .from('user_activity_logs')
    .select('*')
    .ilike('wallet_address', WALLET)
    .order('id', { ascending: false })
    .limit(10);

  if (logsErr) {
    console.error('\n❌ Activity logs error:', logsErr.message);
  } else {
    console.log(`\n📝 ACTIVITY LOGS (last ${logs?.length || 0}):`);
    if (logs?.length) {
      logs.forEach(l => console.log(JSON.stringify(l)));
    } else {
      console.log('  → No activity logs found.');
    }
  }

  console.log('\n✅ Audit complete.\n');
}

main().catch(console.error);
