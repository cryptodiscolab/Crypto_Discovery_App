/**
 * force_onchain_sync.cjs
 * Force synchronizes the Database state (Supabase) to strictly match the Smart Contract (On-Chain SOT)
 * for all registered users in user_profiles.
 *
 * Usage: node scripts/sync/force_onchain_sync.cjs
 */
const { createPublicClient, http } = require('viem');
const { base, baseSepolia } = require('viem/chains');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

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
  console.error("❌ Error: Missing contract address in .env");
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
      { "internalType": "uint256", "name": "totalTasksCompleted", "type": "uint256" },
      { "internalType": "uint256", "name": "referralCount", "type": "uint256" },
      { "internalType": "uint8", "name": "currentTier", "type": "uint8" },
      { "internalType": "uint256", "name": "totalBonusEarned", "type": "uint256" },
      { "internalType": "uint256", "name": "totalPointsSpent", "type": "uint256" },
      { "internalType": "bool", "name": "isActive", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function syncAllUsers() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  FORCE ON-CHAIN SYNC: Database ↔ Smart Contract (SOT)    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`📡 Contract: ${DAILY_APP_ADDRESS}`);
  console.log(`🔌 Chain:    ${isMainnet ? 'Base Mainnet' : 'Base Sepolia'}`);

  try {
    // 1. Ambil semua user dari database
    const { data: users, error: dbError } = await supabase
      .from('user_profiles')
      .select('wallet_address, total_xp, last_onchain_xp, tier');

    if (dbError) throw dbError;
    if (!users || users.length === 0) {
      console.log("ℹ️ Tidak ada user yang ditemukan di database.");
      return;
    }

    console.log(`\nChecking & syncing all ${users.length} users...`);
    console.log("--------------------------------------------------");

    let correctedUsers = 0;
    
    for (const user of users) {
      const cleanWallet = user.wallet_address.toLowerCase();
      console.log(`👤 User: ${cleanWallet}`);

      try {
        let contractStats;
        // Auto-retry up to 3 times for RPC timeouts
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            contractStats = await rpcClient.readContract({
              address: DAILY_APP_ADDRESS,
              abi: DAILY_APP_USER_STATS_ABI,
              functionName: 'userStats',
              args: [cleanWallet]
            });
            break;
          } catch (rpcErr) {
            if (attempt === 3) throw rpcErr;
            console.log(`  - ⚠️ RPC lag. Retrying (${attempt}/3)...`);
            await new Promise(res => setTimeout(res, 1500));
          }
        }

        const onChainPoints = Number(contractStats[0]);
        const onChainTier = Number(contractStats[3]);

        console.log(`  - DB Status:     XP: ${user.total_xp} | Watermark: ${user.last_onchain_xp || 0} | Tier: ${user.tier}`);
        console.log(`  - On-Chain SOT:  XP: ${onChainPoints} | Tier: ${onChainTier}`);

        // Cek jika ada drift
        const hasDrift = onChainPoints !== user.last_onchain_xp || onChainTier !== user.tier || user.total_xp < onChainPoints;

        if (hasDrift) {
          console.log(`  - 🚨 DRIFT DETECTED. Syncing DB -> Contract State...`);
          
          // Force DB values to match on-chain SOT
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              total_xp: onChainPoints,       // Set total XP to match on-chain points (since on-chain points is the SOT)
              last_onchain_xp: onChainPoints, // Sync high watermark
              tier: onChainTier,             // Sync tier
              updated_at: new Date().toISOString()
            })
            .eq('wallet_address', cleanWallet);

          if (updateError) {
            console.error(`  - ❌ Gagal update DB:`, updateError.message);
          } else {
            console.log(`  - ✅ DB SUCCESSFULLY ALIGNED WITH ON-CHAIN SOT`);
            correctedUsers++;
          }
        } else {
          console.log(`  - ✅ FULLY SYNCED`);
        }
      } catch (err) {
        console.error(`  - ❌ Gagal mendapatkan data untuk ${cleanWallet}:`, err.message);
      }
      console.log('');
    }

    console.log("=== SUMMARY ===");
    console.log(`Total Users Checked: ${users.length}`);
    console.log(`Total Users Repaired / Synced: ${correctedUsers}`);
  } catch (error) {
    console.error("❌ Critical Error in sync daemon:", error.message);
  }
}

syncAllUsers();
