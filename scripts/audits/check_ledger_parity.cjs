require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http, getAddress } = require('viem');
const { base } = require('viem/chains');

// Config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rbgzwhsdqnhwrwimjjfm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RPC_URL = process.env.VITE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const resolveAddr = (a, b, c) => {
    const list = [a, b, c];
    for (const addr of list) {
        if (addr && addr !== '[RESERVED]' && addr.startsWith('0x')) return addr;
    }
    return null;
};

const MASTER_X_ADDRESS = resolveAddr(process.env.MASTER_X_ADDRESS, process.env.VITE_MASTER_X_ADDRESS, process.env.VITE_MASTER_X_ADDRESS_SEPOLIA);
const DAILY_APP_ADDRESS = resolveAddr(process.env.DAILY_APP_ADDRESS, process.env.VITE_V12_CONTRACT_ADDRESS, process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA);

if (!MASTER_X_ADDRESS || !DAILY_APP_ADDRESS) {
    console.error("❌ ERROR: Could not resolve contract addresses (found [RESERVED] or missing).");
    process.exit(1);
}

console.log(`📡 Auditing MASTER_X: ${MASTER_X_ADDRESS}`);
console.log(`📡 Auditing DAILY_APP: ${DAILY_APP_ADDRESS}`);

if (!SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is missing.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL)
});

// Minimal ABIs
const MASTER_X_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "users",
        "outputs": [
            {"internalType": "uint256", "name": "points", "type": "uint256"},
            {"internalType": "uint64", "name": "lastClaimTimestamp", "type": "uint64"},
            {"internalType": "uint32", "name": "referralCount", "type": "uint32"},
            {"internalType": "uint8", "name": "tier", "type": "uint8"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const DAILY_APP_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "uint256", "name": "index", "type": "uint256"}
        ],
        "name": "tokenOfOwnerByIndex",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

async function checkParity() {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║  📊 LEDGER PARITY AUDIT (DB ↔ CONTRACT) v3.59.1         ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    try {
        // 1. Fetch Users with XP or Tiers
        const { data: profiles, error } = await supabase
            .from('user_profiles')
            .select('wallet_address, total_xp, tier')
            .or('total_xp.gt.0,tier.gt.0')
            .limit(50); // Sample for audit

        if (error) throw error;
        console.log(`Found ${profiles.length} active users in DB. Auditing parity...\n`);

        console.log(`  WALLET                          │ DB XP   │ CHAIN XP│ DB TIER │ CHAIN TIER │ SBT?`);
        console.log(`  ` + "─".repeat(78));

        let issues = 0;

        for (const p of profiles) {
            const wallet = getAddress(p.wallet_address);
            
            // A. Check MasterX
            const onChainUser = await publicClient.readContract({
                address: MASTER_X_ADDRESS,
                abi: MASTER_X_ABI,
                functionName: 'users',
                args: [wallet]
            });

            const onChainXP = Number(onChainUser[0]);
            const onChainTier = Number(onChainUser[3]);

            // B. Check SBT Ownership (Balance of DailyApp NFT)
            const sbtBalance = await publicClient.readContract({
                address: DAILY_APP_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'balanceOf',
                args: [wallet]
            });

            const hasSBT = Number(sbtBalance) > 0;
            
            // C. Compare
            const xpDrift = Math.abs(p.total_xp - onChainXP);
            const tierMatch = (p.tier === onChainTier);
            const gatingOk = (p.tier === 0 || hasSBT); // Tier 0 doesn't need SBT, others do

            const statusXP = xpDrift === 0 ? '✅' : (xpDrift < 100 ? '⚠️' : '❌');
            const statusTier = tierMatch ? '✅' : '❌';
            const statusGating = gatingOk ? '✅' : '❌';

            if (xpDrift > 0 || !tierMatch || !gatingOk) issues++;

            console.log(`  ${wallet.substring(0, 10)}...${wallet.substring(38)} │ ${String(p.total_xp).padStart(7)} │ ${String(onChainXP).padStart(7)} ${statusXP} │ ${String(p.tier).padStart(7)} │ ${String(onChainTier).padStart(10)} ${statusTier} │ ${hasSBT ? 'YES' : ' NO '} ${statusGating}`);
        }

        console.log(`\n  ` + "─".repeat(78));
        if (issues === 0) {
            console.log(`\n  ✅ SUCCESS: Ledger parity is perfect for sampled users.`);
        } else {
            console.log(`\n  ⚠️  WARNING: Found ${issues} inconsistencies. Use admin sync tools.`);
        }

    } catch (err) {
        console.error("❌ Audit failed:", err.message);
    }
}

checkParity();
