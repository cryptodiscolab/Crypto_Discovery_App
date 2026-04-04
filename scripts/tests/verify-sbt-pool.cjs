/**
 * ============================================================
 * CRYPTO DISCO — SBT Pool State Verifier (v3.41.1)
 * ============================================================
 * Lightweight READ-ONLY script. No writes, no gas.
 * Shows the full pool state and per-tier distribution.
 * 
 * Usage: node scripts/tests/verify-sbt-pool.cjs
 * ============================================================
 */

require('dotenv').config();
const { createPublicClient, http, formatEther } = require('viem');
const { baseSepolia } = require('viem/chains');

const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS;
const RPC_URL          = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

if (!MASTER_X_ADDRESS || MASTER_X_ADDRESS === '[RESERVED]') {
    console.error('❌ MASTER_X_ADDRESS not set in .env');
    process.exit(1);
}

const ABI = [
    { name: 'totalSBTPoolBalance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'totalLockedRewards',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'lastDistributeTimestamp', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'accRewardPerShare',   type: 'function', stateMutability: 'view', inputs: [{ type: 'uint8' }], outputs: [{ type: 'uint256' }] },
    { name: 'bronzeHolders',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
    { name: 'silverHolders',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
    { name: 'goldHolders',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
    { name: 'platinumHolders',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
    { name: 'diamondHolders',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
    { name: 'bronzeWeight',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'silverWeight',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'goldWeight',          type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'platinumWeight',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'diamondWeight',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'owner',               type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'opsShare',            type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'sbtPoolShare',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'ownerShare',          type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'DISTRIBUTE_INTERVAL_SEC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

const PRECISION = 1_000_000_000_000_000_000n; // 1e18

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

async function r(fn, args = []) {
    return publicClient.readContract({ address: MASTER_X_ADDRESS, abi: ABI, functionName: fn, args });
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  📊 SBT POOL STATE VERIFIER (v3.41.1)                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(`📜 Contract: ${MASTER_X_ADDRESS}`);
    console.log(`📡 RPC     : ${RPC_URL}\n`);

    // Batch reads
    const [
        poolBalance, lockedRewards, lastDist,
        bH, sH, gH, pH, dH,
        bW, sW, gW, pW, dW,
        owner, opsShare, sbtShare, ownerShare, interval,
        accB, accS, accG, accP, accD
    ] = await Promise.all([
        r('totalSBTPoolBalance'), r('totalLockedRewards'), r('lastDistributeTimestamp'),
        r('bronzeHolders'), r('silverHolders'), r('goldHolders'), r('platinumHolders'), r('diamondHolders'),
        r('bronzeWeight'), r('silverWeight'), r('goldWeight'), r('platinumWeight'), r('diamondWeight'),
        r('owner'), r('opsShare'), r('sbtPoolShare'), r('ownerShare'), r('DISTRIBUTE_INTERVAL_SEC'),
        r('accRewardPerShare', [1]), r('accRewardPerShare', [2]), r('accRewardPerShare', [3]),
        r('accRewardPerShare', [4]), r('accRewardPerShare', [5]),
    ]);

    const lastDistTs = lastDist > 0n ? new Date(Number(lastDist) * 1000).toISOString() : 'Never';
    const nextDistTs = lastDist > 0n
        ? new Date((Number(lastDist) + Number(interval)) * 1000).toISOString()
        : 'Now eligible';

    // Revenue share
    const totalShares = Number(ownerShare) + Number(opsShare) + Number(sbtShare);
    const sbtPct  = totalShares > 0 ? ((Number(sbtShare) / totalShares) * 100).toFixed(1) : 'N/A';
    const opsPct  = totalShares > 0 ? ((Number(opsShare) / totalShares) * 100).toFixed(1) : 'N/A';
    const ownPct  = totalShares > 0 ? ((Number(ownerShare) / totalShares) * 100).toFixed(1) : 'N/A';

    // Per-holder claimable estimate
    const estPerHolder = (accReward, holders) => {
        if (holders === 0 || accReward === 0n) return '0';
        return formatEther(accReward / PRECISION);
    };

    console.log('━━━ POOL OVERVIEW ━━━');
    console.log(`  Total SBT Pool     : ${formatEther(poolBalance)} ETH`);
    console.log(`  Total Locked Rwds  : ${formatEther(lockedRewards)} ETH`);
    console.log(`  Last Distribution  : ${lastDistTs}`);
    console.log(`  Next Eligible      : ${nextDistTs}`);
    console.log(`  Distribute Interval: ${Number(interval)}s (${(Number(interval) / 3600).toFixed(1)}h)\n`);

    console.log('━━━ REVENUE SPLIT ━━━');
    console.log(`  Owner  : ${ownPct}% | Ops : ${opsPct}% | SBT Pool : ${sbtPct}%\n`);

    console.log('━━━ TIER HOLDERS & WEIGHTS ━━━');
    const tiers = [
        { name: 'Diamond',  id: 5, holders: Number(dH), weight: dW, acc: accD },
        { name: 'Platinum', id: 4, holders: Number(pH), weight: pW, acc: accP },
        { name: 'Gold',     id: 3, holders: Number(gH), weight: gW, acc: accG },
        { name: 'Silver',   id: 2, holders: Number(sH), weight: sW, acc: accS },
        { name: 'Bronze',   id: 1, holders: Number(bH), weight: bW, acc: accB },
    ];

    let allEmpty = true;
    for (const t of tiers) {
        const perHolder = estPerHolder(t.acc, t.holders);
        const hasHolders = t.holders > 0;
        if (hasHolders) allEmpty = false;
        console.log(`  ${t.name.padEnd(10)} | Holders: ${String(t.holders).padStart(4)} | Weight: ${String(Number(t.weight)).padStart(5)} | accReward/Share: ${t.acc.toString().padStart(20)} | Est. per holder: ${perHolder} ETH`);
    }

    console.log('\n━━━ DIAGNOSTICS ━━━');
    const poolEmpty     = poolBalance === 0n;
    const noHolders     = allEmpty;
    const neverDist     = lastDist === 0n;

    if (poolEmpty)  console.log('  ⚠️  Pool has 0 ETH — fund via raffle ticket purchases');
    if (noHolders)  console.log('  ⚠️  Zero SBT holders across all tiers — upgradeTier() needed first');
    if (neverDist)  console.log('  ⚠️  distributeRevenue() has NEVER been called — owner must trigger it');
    if (!poolEmpty && !noHolders && !neverDist) {
        console.log('  ✅ Pool funded, holders exist, distribution occurred — normal state');
    }

    const overallOk = !poolEmpty && !noHolders && !neverDist;
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║  ${overallOk ? '✅ VERDICT: POOL PIPELINE OPERATIONAL' : '⚠️  VERDICT: ACTION REQUIRED (see diagnostics above)'}  `);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main().catch(err => {
    console.error('Fatal verifier error:', err);
    process.exit(1);
});
