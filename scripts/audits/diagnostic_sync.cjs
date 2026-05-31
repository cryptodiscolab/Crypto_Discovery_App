const { createPublicClient, http } = require('viem');
const { base, baseSepolia } = require('viem/chains');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load Environment Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const CHAIN_ID = process.env.VITE_CHAIN_ID || '84532';
const isMainnet = CHAIN_ID === '8453';

const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS || process.env.VITE_DAILY_APP_CONTRACT || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Missing Supabase credentials in .env");
  process.exit(1);
}
if (!DAILY_APP_ADDRESS) {
  console.error("❌ Error: Missing DAILY_APP_ADDRESS or VITE_V12_CONTRACT_ADDRESS_SEPOLIA in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const rpcClient = createPublicClient({
  chain: isMainnet ? base : baseSepolia,
  transport: http(ALCHEMY_API_KEY ? `https://${isMainnet ? 'base-mainnet' : 'base-sepolia'}.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : undefined)
});

// Minimal ABI required for checks
const DAILY_APP_USER_STATS_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "userStats",
    "outputs": [
      { "internalType": "uint256", "name": "points", "type": "uint256" },
      { "internalType": "uint256", "name": "streakCount", "type": "uint256" },
      { "internalType": "uint256", "name": "lastActionTime", "type": "uint256" },
      { "internalType": "uint8", "name": "currentTier", "type": "uint8" },
      { "internalType": "uint256", "name": "totalBonusEarned", "type": "uint256" },
      { "internalType": "uint256", "name": "totalPointsSpent", "type": "uint256" },
      { "internalType": "bool", "name": "isActive", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function runAudit() {
  const walletArg = process.argv[2];
  if (!walletArg) {
    console.error("Usage: node diagnostic_sync.js <wallet_address>");
    process.exit(1);
  }
  
  const cleanWallet = walletArg.toLowerCase();
  console.log(`\n🔍 [AUDIT] Memulai pemeriksaan integritas data untuk: ${cleanWallet}`);
  console.log(`📡 Jaringan: ${isMainnet ? 'Base Mainnet' : 'Base Sepolia'}\n`);

  try {
    // 1. Ambil State dari DB (Supabase)
    const { data: dbUser, error: dbError } = await supabase
      .from('user_profiles')
      .select('tier, total_xp, last_onchain_xp, streak_count, last_streak_claim')
      .eq('wallet_address', cleanWallet)
      .maybeSingle();

    if (dbError) throw dbError;
    if (!dbUser) {
      console.error(`❌ User ${cleanWallet} tidak ditemukan di database.`);
      return;
    }

    console.log(`\n=== 📊 STATE DATABASE (SUPABASE) ===`);
    console.log(`- Tier: ${dbUser.tier}`);
    console.log(`- Total XP: ${dbUser.total_xp}`);
    console.log(`- Last On-Chain XP (Watermark): ${dbUser.last_onchain_xp}`);
    console.log(`- Streak Count: ${dbUser.streak_count}`);
    console.log(`- Last Streak Claim: ${dbUser.last_streak_claim}`);

    // 2. Ambil State dari Smart Contract (SOT)
    console.log(`\n⏳ Fetching data dari Smart Contract...`);
    const contractStats = await rpcClient.readContract({
      address: DAILY_APP_ADDRESS,
      abi: DAILY_APP_USER_STATS_ABI,
      functionName: 'userStats',
      args: [cleanWallet]
    });

    const onChainPoints = Number(contractStats[0]);
    const onChainTier = Number(contractStats[3]);

    console.log(`\n=== ⛓️ STATE SMART CONTRACT (SOT) ===`);
    console.log(`- Tier: ${onChainTier}`);
    console.log(`- Total XP (Points): ${onChainPoints}`);

    // 3. Rekonsiliasi & Deteksi Drift
    console.log(`\n=== 🚨 HASIL REKONSILIASI ===`);
    const drift = [];

    // TIER CHECK
    if (onChainTier !== dbUser.tier) {
      drift.push(`❌ TIER MISMATCH | Chain: ${onChainTier} vs DB: ${dbUser.tier}`);
    } else {
      console.log(`✅ TIER OK`);
    }

    // WATERMARK CHECK
    if (onChainPoints !== (dbUser.last_onchain_xp || 0)) {
      drift.push(`❌ ONCHAIN XP WATERMARK LAG | Chain XP: ${onChainPoints} vs DB Watermark: ${dbUser.last_onchain_xp || 0}`);
    } else {
      console.log(`✅ ONCHAIN XP WATERMARK OK`);
    }
    
    // OFFLINE XP DRIFT CHECK
    // total_xp seharusnya >= last_onchain_xp (karena task off-chain ditambah di atasnya)
    if (dbUser.total_xp < (dbUser.last_onchain_xp || 0)) {
       drift.push(`❌ XP UNDER-SYNC DETECTED | Total XP (${dbUser.total_xp}) lebih rendah dari onchain watermark (${dbUser.last_onchain_xp})`);
    } else {
       console.log(`✅ OFFLINE XP LOGIC OK`);
    }

    if (drift.length === 0) {
      console.log(`\n✅ STATUS: KEDUA SISTEM SINKRON SEMPURNA (PERFECT PARITY)`);
    } else {
      console.log(`\n⚠️ STATUS: DITEMUKAN STATE DRIFT (OUT OF SYNC)`);
      drift.forEach(d => console.log(`  -> ${d}`));
      console.log(`\n💡 SOLUSI: User harus melakukan login atau daily claim agar "handleXpSync" memicu proses self-healing watermark.`);
    }
  } catch (error) {
    console.error(`\n❌ ERROR saat menjalankan audit:`, error.message);
  }
}

runAudit();
