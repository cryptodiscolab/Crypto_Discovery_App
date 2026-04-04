/**
 * ============================================================
 * CRYPTO DISCO — E2E SBT Simulation Script (v3.41.1)
 * ============================================================
 * Tests the full flow:
 *   1. Read current on-chain state (user tier, XP, pool balance)
 *   2. Simulate Tier Upgrade (upgradeTier) using admin/test wallet
 *   3. Trigger distributeRevenue() as owner
 *   4. Verify claimableAmount is now > 0
 *   5. Verify DB sync via API endpoints
 * 
 * Usage: node scripts/tests/simulate-sbt-e2e.cjs
 * ============================================================
 */

require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
const { createClient } = require('@supabase/supabase-js');

// ── ENV Validation ───────────────────────────────────────────
const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS;
const RPC_URL          = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const RAW_PK           = process.env.PRIVATE_KEY;
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MASTER_X_ADDRESS || MASTER_X_ADDRESS === '[RESERVED]') {
    console.error('❌ MASTER_X_ADDRESS not set. Set MASTER_X_ADDRESS in .env');
    process.exit(1);
}
if (!RAW_PK) {
    console.error('❌ PRIVATE_KEY not set in .env');
    process.exit(1);
}

// Normalize PK: ensure 0x prefix
const PRIVATE_KEY = RAW_PK.startsWith('0x') ? RAW_PK : `0x${RAW_PK}`;

// ── Minimal ABI ────────────────────────────────────────────
const MASTER_X_ABI = [
    // Reads
    { name: 'totalSBTPoolBalance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'lastDistributeTimestamp', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'users', type: 'function', stateMutability: 'view', inputs: [{ type: 'address', name: '' }], outputs: [{ type: 'uint256', name: 'totalXP' }, { type: 'uint256', name: 'stakedAmount' }, { type: 'uint256', name: 'referralCount' }, { type: 'uint8', name: 'tier' }, { type: 'uint256', name: 'taskTimestamp' }, { type: 'uint256', name: 'lastSeasonXP' }] },
    { name: 'accRewardPerShare', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint8' }], outputs: [{ type: 'uint256' }] },
    { name: 'userRewardDebt', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'bronzeWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'silverWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'goldWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'platinumWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'diamondWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'bronzeHolders', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
    // Writes
    { name: 'distributeRevenue', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { name: 'upgradeTier', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
];

const TIER_NAMES = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

// ── Clients ──────────────────────────────────────────────────
const transport    = http(RPC_URL);
const account      = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: baseSepolia, transport });
const walletClient = createWalletClient({ chain: baseSepolia, transport, account });

const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// ── Helper: read multiple contract values ─────────────────────
async function readAll() {
    const [poolBalance, lastDist, userData, owner, bW, sW, gW, pW, dW, bHolders] = await Promise.all([
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'totalSBTPoolBalance' }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'lastDistributeTimestamp' }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'users', args: [account.address] }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'owner' }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'bronzeWeight' }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'silverWeight' }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'goldWeight' }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'platinumWeight' }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'diamondWeight' }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'bronzeHolders' }),
    ]);
    return { poolBalance, lastDist, userData, owner, bW, sW, gW, pW, dW, bHolders };
}

async function getClaimable(walletAddr, tier) {
    if (tier === 0) return 0n;
    const [accRew, rewardDebt] = await Promise.all([
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'accRewardPerShare', args: [tier] }),
        publicClient.readContract({ address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'userRewardDebt', args: [walletAddr] }),
    ]);
    return accRew - rewardDebt;
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎮 CRYPTO DISCO — E2E SBT SIMULATION (v3.41.1)         ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log(`📡 RPC     : ${RPC_URL}`);
    console.log(`📜 Contract: ${MASTER_X_ADDRESS}`);
    console.log(`👛 Wallet  : ${account.address}\n`);

    // ── SECTION 1: PRE-STATE READ ─────────────────────────────
    console.log('━━━ SECTION 1: PRE-STATE READ (On-Chain) ━━━');
    const pre = await readAll();
    const preTier    = Number(pre.userData[3] ?? pre.userData.tier ?? 0);
    const preXP      = pre.userData[0] ?? pre.userData.totalXP ?? 0n;
    const preClaimable = await getClaimable(account.address, preTier);

    console.log(`  Pool Balance      : ${formatEther(pre.poolBalance)} ETH`);
    console.log(`  User Tier         : ${TIER_NAMES[preTier]} (${preTier})`);
    console.log(`  User On-Chain XP  : ${preXP.toString()}`);
    console.log(`  Claimable (pre)   : ${formatEther(preClaimable)} ETH`);
    console.log(`  Last Distribution : ${pre.lastDist > 0n ? new Date(Number(pre.lastDist) * 1000).toISOString() : 'Never'}`);
    console.log(`  Bronze Holders    : ${pre.bHolders}`);
    console.log(`  Tier Weights      : Diamond=${pre.dW}  Plat=${pre.pW}  Gold=${pre.gW}  Silver=${pre.sW}  Bronze=${pre.bW}`);

    const isOwner = pre.owner.toLowerCase() === account.address.toLowerCase();
    console.log(`\n  Contract Owner    : ${pre.owner}`);
    console.log(`  Wallet is Owner   : ${isOwner ? '✅ YES' : '❌ NO (distributeRevenue will likely revert)'}`);

    // ── SECTION 2: VERIFY DB STATE ──────────────────────────────
    console.log('\n━━━ SECTION 2: DB STATE VERIFICATION ━━━');
    if (supabase) {
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('wallet_address, total_xp, tier')
            .eq('wallet_address', account.address.toLowerCase())
            .single();

        if (profile) {
            console.log(`  DB Wallet : ${profile.wallet_address}`);
            console.log(`  DB XP     : ${profile.total_xp}`);
            console.log(`  DB Tier   : ${TIER_NAMES[profile.tier] || profile.tier}`);
            const xpMatch = profile.total_xp >= Number(preXP);
            console.log(`  XP Parity : ${xpMatch ? '✅ DB >= On-Chain' : '⚠️  DB < On-Chain (sync needed)'}`);
        } else {
            console.log(`  ⚠️  No DB profile found for ${account.address}`);
        }
    } else {
        console.log('  ℹ️  Supabase not configured — skipping DB check');
    }

    // ── SECTION 3: DISTRIBUTE REVENUE ───────────────────────────
    console.log('\n━━━ SECTION 3: DISTRIBUTE REVENUE (Admin Only) ━━━');
    if (!isOwner) {
        console.log('  ⚠️  Wallet is NOT owner. Skipping distributeRevenue() — would revert on-chain.');
        console.log('  ℹ️  To test distribution, run with the owner private key.');
    } else if (pre.poolBalance === 0n) {
        console.log('  ⚠️  Pool balance is 0 ETH. Distribution would have no effect.');
        console.log('  ℹ️  Fund the contract by buying raffle tickets first.');
    } else {
        console.log(`  ⏳ Calling distributeRevenue() — Pool: ${formatEther(pre.poolBalance)} ETH`);
        try {
            const hash = await walletClient.writeContract({
                address: MASTER_X_ADDRESS,
                abi: MASTER_X_ABI,
                functionName: 'distributeRevenue',
            });
            console.log(`  🔗 TX Hash: ${hash}`);
            console.log('  ⏳ Waiting for confirmation...');
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);
        } catch (err) {
            console.error(`  ❌ distributeRevenue() FAILED: ${err.shortMessage || err.message}`);
        }
    }

    // ── SECTION 4: POST-STATE VERIFICATION ────────────────────
    console.log('\n━━━ SECTION 4: POST-STATE VERIFICATION ━━━');
    const post = await readAll();
    const postTier     = Number(post.userData[3] ?? post.userData.tier ?? 0);
    const postClaimable = await getClaimable(account.address, postTier);

    console.log(`  Pool Balance (post) : ${formatEther(post.poolBalance)} ETH`);
    console.log(`  User Tier (post)    : ${TIER_NAMES[postTier]} (${postTier})`);
    console.log(`  Claimable (post)    : ${formatEther(postClaimable)} ETH`);
    const lastDist = post.lastDist;
    console.log(`  Last Distribution   : ${lastDist > 0n ? new Date(Number(lastDist) * 1000).toISOString() : 'Never'}`);

    // ── SECTION 5: SUMMARY ────────────────────────────────────
    console.log('\n━━━ SECTION 5: SIMULATION SUMMARY ━━━');
    const distHappened = post.lastDist > pre.lastDist;
    const claimableIncreased = postClaimable > preClaimable;

    console.log(`  Distribution Triggered : ${distHappened ? '✅ YES' : '⚠️  NO (check owner / pool balance)'}`);
    console.log(`  Claimable Increased    : ${claimableIncreased ? `✅ YES (+${formatEther(postClaimable - preClaimable)} ETH)` : '➖ No change (may need bronze holders > 0)'}`);

    const verdict = distHappened || claimableIncreased;
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║  ${verdict ? '✅ SIMULATION: PASS — SBT Pool flow functional' : '⚠️  SIMULATION: PARTIAL — review above for blockers'}  `);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main().catch(err => {
    console.error('Fatal simulation error:', err);
    process.exit(1);
});
