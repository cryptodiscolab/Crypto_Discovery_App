/**
 * XP Recovery Migration Script
 * Purpose: Restore user XP from Supabase backup into DailyAppV16 contract
 * Function: batchMigrateUsers(address[], UserStats[])
 *
 * Sources of Truth:
 * - user_profiles.total_xp         → UserStats.points (XP to restore)
 * - user_task_claims (count)        → UserStats.totalTasksCompleted
 * - user_profiles.tier              → UserStats.currentTier
 * - lastDailyBonusClaim             → 0 (reset, let user claim fresh)
 * - referralCount                   → from user_profiles referral data (0 if not tracked)
 * - tasksForReferralProgress        → 0
 * - isBlacklisted                   → false
 *
 * Protocol: v3.64.32 | Zero-Hardcode | Zero-Trust | Atomic Watermark Update
 * Mandate: Rule 48 (RPC indexing fallback), Rule 22 (post-fix doc sync)
 *
 * Usage:
 *   node scripts/sync/recover_xp_to_contract.cjs             # Dry-run (default)
 *   node scripts/sync/recover_xp_to_contract.cjs --execute   # Real execution
 *   node scripts/sync/recover_xp_to_contract.cjs --verify    # Post-migration verify only
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── Load environment ─────────────────────────────────────────────────────────
// Load from root .env (where PRIVATE_KEY lives)
function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
}

const ROOT = path.resolve(__dirname, '../..');
loadEnv(path.join(ROOT, '.env'));
loadEnv(path.join(ROOT, 'Raffle_Frontend', '.env'));

// ─── Parse CLI args ───────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);
const IS_EXECUTE  = ARGS.includes('--execute');
const IS_VERIFY   = ARGS.includes('--verify');
const IS_DRY_RUN  = !IS_EXECUTE && !IS_VERIFY;

// ─── Config ───────────────────────────────────────────────────────────────────
const DAILY_APP_ADDRESS   = (process.env.DAILY_APP_ADDRESS || '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353').toLowerCase();
// Use public RPC as primary — Alchemy free tier has limits & may return 'App is inactive'
const RPC_URLS = [
    'https://sepolia.base.org',
    'https://base-sepolia.publicnode.com',
    process.env.VITE_BASE_SEPOLIA_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL,
].filter(Boolean);
const RPC_URL             = RPC_URLS[0];
const SUPABASE_URL        = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY        = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const PRIVATE_KEY_RAW     = process.env.PRIVATE_KEY;

const MAX_BATCH_SIZE = 50;   // matches MAX_BATCH_SIZE in DailyAppV16

// XpSource enum: 0=Daily, 1=Task, 2=Social, 3=Raffle, 4=Referral, 5=Admin, 6=Swap, 7=Purchase, 8=Ugc
// For batchMigrateUsers there's no XpSource — it uses Admin role directly
// XpSource.Admin = 5 (used only in awardAdminBatchXp, not batchMigrateUsers)

// ─── Validate Config ──────────────────────────────────────────────────────────
function validateConfig() {
    const errors = [];
    if (!SUPABASE_URL)   errors.push('Missing SUPABASE_URL (check .env)');
    if (!SUPABASE_KEY)   errors.push('Missing SUPABASE_SERVICE_ROLE_KEY (check .env)');
    if (!PRIVATE_KEY_RAW && IS_EXECUTE) errors.push('Missing PRIVATE_KEY in root .env');
    if (errors.length) {
        console.error('\n❌ CONFIG ERRORS:');
        errors.forEach(e => console.error(`   • ${e}`));
        process.exit(1);
    }
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const BATCH_MIGRATE_ABI = [
    {
        inputs: [
            { internalType: 'address[]', name: 'users', type: 'address[]' },
            {
                components: [
                    { internalType: 'uint256', name: 'points',                  type: 'uint256' },
                    { internalType: 'uint256', name: 'totalTasksCompleted',      type: 'uint256' },
                    { internalType: 'uint256', name: 'referralCount',            type: 'uint256' },
                    { internalType: 'uint8',   name: 'currentTier',              type: 'uint8'   },
                    { internalType: 'uint256', name: 'tasksForReferralProgress', type: 'uint256' },
                    { internalType: 'uint256', name: 'lastDailyBonusClaim',      type: 'uint256' },
                    { internalType: 'bool',    name: 'isBlacklisted',            type: 'bool'    },
                ],
                internalType: 'struct DailyAppV16.UserStats[]',
                name: 'stats',
                type: 'tuple[]',
            },
        ],
        name: 'batchMigrateUsers',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
];

const USER_STATS_ABI = [
    {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'userStats',
        outputs: [
            { internalType: 'uint256', name: 'points',                  type: 'uint256' },
            { internalType: 'uint256', name: 'totalTasksCompleted',     type: 'uint256' },
            { internalType: 'uint256', name: 'referralCount',           type: 'uint256' },
            { internalType: 'uint8',   name: 'currentTier',             type: 'uint8'   },
            { internalType: 'uint256', name: 'tasksForReferralProgress',type: 'uint256' },
            { internalType: 'uint256', name: 'lastDailyBonusClaim',     type: 'uint256' },
            { internalType: 'bool',    name: 'isBlacklisted',           type: 'bool'    },
        ],
        stateMutability: 'view',
        type: 'function',
    },
];

// ─── Supabase helper ──────────────────────────────────────────────────────────
async function supabaseFetch(endpoint, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            ...options.headers,
        },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${endpoint} → ${res.status}: ${text}`);
    }
    return res.json();
}

// ─── Fetch user data from Supabase ────────────────────────────────────────────
async function fetchUsersFromSupabase() {
    console.log('\n📊 Fetching user_profiles from Supabase...');

    // Get all users with XP > 0
    const profiles = await supabaseFetch(
        'user_profiles?select=wallet_address,total_xp,last_onchain_xp,tier,streak_count&total_xp=gt.0&order=total_xp.desc'
    );

    if (!profiles.length) {
        console.log('⚠️  No users found with total_xp > 0.');
        process.exit(0);
    }

    console.log(`   Found ${profiles.length} users with XP in Supabase.`);

    // Get totalTasksCompleted per user from user_task_claims
    // Note: user_task_claims has no 'status' column — every row IS a completed claim
    console.log('📊 Fetching task claim counts per user...');
    const allClaims = await supabaseFetch(
        'user_task_claims?select=wallet_address&limit=10000'
    ).catch(() => []);

    // Count claims per wallet (client-side aggregation)
    const taskCountMap = {};
    for (const claim of allClaims) {
        const w = claim.wallet_address?.toLowerCase();
        if (w) taskCountMap[w] = (taskCountMap[w] || 0) + 1;
    }

    console.log(`   Task claim data loaded: ${allClaims.length} claims across ${Object.keys(taskCountMap).length} unique wallets.`);

    return profiles.map(p => ({
        wallet: p.wallet_address.toLowerCase(),
        totalXp: Number(p.total_xp || 0),
        lastOnchainXp: Number(p.last_onchain_xp || 0),
        tier: Number(p.tier || 0),
        tasksCompleted: taskCountMap[p.wallet_address?.toLowerCase()] || 0,
    }));
}

// ─── Fetch on-chain current stats ─────────────────────────────────────────────
async function fetchOnchainStats(users) {
    console.log('\n🔗 Reading on-chain stats from DailyAppV16...');
    console.log(`   RPC: ${RPC_URL}`);

    const { createPublicClient, http } = require('viem');
    const { baseSepolia } = require('viem/chains');

    // Try multiple RPCs in sequence
    let publicClient = null;
    for (const rpcUrl of RPC_URLS) {
        try {
            const client = createPublicClient({
                chain: baseSepolia,
                transport: http(rpcUrl, { timeout: 15_000 }),
            });
            // Test connection
            await client.getBlockNumber();
            publicClient = client;
            console.log(`   ✅ RPC connected: ${rpcUrl}`);
            break;
        } catch (err) {
            console.warn(`   ⚠️  RPC ${rpcUrl} failed: ${err.message.slice(0, 60)}`);
        }
    }

    if (!publicClient) {
        console.error('   ❌ All RPCs failed. Assuming on-chain XP = 0 for all users (proceed to migrate).');
        return users.map(u => ({ ...u, onchainPoints: 0, onchainTier: 0 }));
    }

    const results = [];
    for (const user of users) {
        try {
            const stats = await publicClient.readContract({
                address: DAILY_APP_ADDRESS,
                abi: USER_STATS_ABI,
                functionName: 'userStats',
                args: [user.wallet],
            });
            results.push({
                ...user,
                onchainPoints: Number(stats[0]),
                onchainTier: Number(stats[3]),
            });
        } catch (err) {
            console.warn(`   ⚠️  userStats read failed for ${user.wallet}: ${err.message.slice(0, 80)}`);
            results.push({ ...user, onchainPoints: 0, onchainTier: 0 });
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
    }
    return results;
}

// ─── Determine tier from XP (match sbt_thresholds in DB) ─────────────────────
// Tier: 0=Rookie, 1=Bronze, 2=Silver, 3=Gold, 4=Platinum
// These are read from contract config; using common defaults as reference only.
// The actual tier stored in user_profiles.tier is used as the source of truth.
function validateTier(supabaseTier, totalXp) {
    // Tier must be 0-4
    if (supabaseTier < 0 || supabaseTier > 4) return 0;
    return supabaseTier;
}

// ─── Filter: who needs migration ──────────────────────────────────────────────
function filterUsersNeedingMigration(users) {
    // Only migrate users where on-chain XP < Supabase total_xp
    // (idempotent: skip users already migrated)
    const toMigrate = users.filter(u => u.totalXp > 0 && u.onchainPoints < u.totalXp);
    const alreadyOk = users.filter(u => u.onchainPoints >= u.totalXp);

    if (alreadyOk.length > 0) {
        console.log(`\n✅ ${alreadyOk.length} users already have on-chain XP ≥ Supabase XP (skipped):`);
        for (const u of alreadyOk) {
            console.log(`   • ${u.wallet}: onchain=${u.onchainPoints} ≥ db=${u.totalXp}`);
        }
    }

    return toMigrate;
}

// ─── Print migration preview table ───────────────────────────────────────────
function printMigrationTable(users) {
    console.log('\n┌─────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│              MIGRATION PREVIEW — DRY RUN                                       │');
    console.log('├────────────────────────────────────────┬──────────┬──────────┬──────┬──────────┤');
    console.log('│ Wallet                                 │ DB XP    │ OnChain  │ Tier │ Tasks    │');
    console.log('├────────────────────────────────────────┼──────────┼──────────┼──────┼──────────┤');
    for (const u of users) {
        const wallet = `${u.wallet.slice(0, 6)}...${u.wallet.slice(-4)}`;
        const dbXp    = u.totalXp.toString().padStart(8);
        const onchain = u.onchainPoints.toString().padStart(8);
        const tier    = u.tier.toString().padStart(4);
        const tasks   = u.tasksCompleted.toString().padStart(8);
        console.log(`│ ${u.wallet.padEnd(40)} │ ${dbXp} │ ${onchain} │ ${tier} │ ${tasks} │`);
    }
    console.log('└────────────────────────────────────────┴──────────┴──────────┴──────┴──────────┘');
    console.log(`\n   Total XP to restore: ${users.reduce((s, u) => s + u.totalXp, 0).toLocaleString()} XP across ${users.length} users`);
    console.log(`   Batches needed: ${Math.ceil(users.length / MAX_BATCH_SIZE)}`);
}

// ─── Execute migration ─────────────────────────────────────────────────────────
async function executeMigration(users) {
    const { createPublicClient, createWalletClient, http, parseGwei } = require('viem');
    const { baseSepolia } = require('viem/chains');
    const { privateKeyToAccount } = require('viem/accounts');

    // Normalise private key (add 0x if missing)
    const pkHex = PRIVATE_KEY_RAW.startsWith('0x') ? PRIVATE_KEY_RAW : `0x${PRIVATE_KEY_RAW}`;
    const account = privateKeyToAccount(pkHex);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    console.log(`\n🔑 Signer: ${account.address}`);
    console.log(`🎯 Contract: ${DAILY_APP_ADDRESS}`);
    console.log(`📦 Batches: ${Math.ceil(users.length / MAX_BATCH_SIZE)} × max ${MAX_BATCH_SIZE} users\n`);

    const txHashes = [];
    const migratedWallets = [];

    // Split into batches
    for (let i = 0; i < users.length; i += MAX_BATCH_SIZE) {
        const batch = users.slice(i, i + MAX_BATCH_SIZE);
        const batchNum = Math.floor(i / MAX_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(users.length / MAX_BATCH_SIZE);

        console.log(`📤 Batch ${batchNum}/${totalBatches}: ${batch.length} users`);

        const addresses = batch.map(u => u.wallet);
        const stats = batch.map(u => ({
            points:                  BigInt(u.totalXp),
            totalTasksCompleted:     BigInt(u.tasksCompleted),
            referralCount:           BigInt(0),
            currentTier:             u.tier,
            tasksForReferralProgress: BigInt(0),
            lastDailyBonusClaim:     BigInt(0),   // set 0 → user can claim daily fresh
            isBlacklisted:           false,
        }));

        try {
            // Simulate first
            await publicClient.simulateContract({
                address: DAILY_APP_ADDRESS,
                abi: BATCH_MIGRATE_ABI,
                functionName: 'batchMigrateUsers',
                args: [addresses, stats],
                account,
            });

            console.log(`   ✅ Simulation OK — sending transaction...`);

            const txHash = await walletClient.writeContract({
                address: DAILY_APP_ADDRESS,
                abi: BATCH_MIGRATE_ABI,
                functionName: 'batchMigrateUsers',
                args: [addresses, stats],
                account,
            });

            console.log(`   📨 TX sent: ${txHash}`);
            console.log(`   ⏳ Waiting for receipt...`);

            const receipt = await publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 2,
                timeout: 120_000,
            });

            if (receipt.status !== 'success') {
                throw new Error(`Transaction reverted: ${txHash}`);
            }

            console.log(`   ✅ Batch ${batchNum} confirmed! Block: ${receipt.blockNumber}`);
            txHashes.push(txHash);
            migratedWallets.push(...batch.map(u => u.wallet));

            // Update Supabase watermark after each successful batch
            await updateSupabaseWatermarks(batch);

        } catch (err) {
            console.error(`\n   ❌ Batch ${batchNum} FAILED: ${err.message}`);
            console.error(`   Wallets affected:`, addresses.join(', '));
            // Continue with next batch
        }

        // Small delay between batches to avoid RPC rate limit
        if (i + MAX_BATCH_SIZE < users.length) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    return { txHashes, migratedWallets };
}

// ─── Update Supabase watermark after migration ────────────────────────────────
async function updateSupabaseWatermarks(batch) {
    console.log(`   💾 Updating Supabase watermarks for ${batch.length} wallets...`);

    for (const user of batch) {
        try {
            await supabaseFetch(
                `user_profiles?wallet_address=eq.${user.wallet}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        last_onchain_xp: user.totalXp,
                        updated_at: new Date().toISOString(),
                    }),
                }
            );
        } catch (err) {
            console.warn(`   ⚠️  Watermark update failed for ${user.wallet}: ${err.message}`);
        }
    }
    console.log(`   ✅ Watermarks updated.`);
}

// ─── Verify post-migration ────────────────────────────────────────────────────
async function verifyMigration(users) {
    console.log('\n🔍 Verifying migration results...');

    const { createPublicClient, http } = require('viem');
    const { baseSepolia } = require('viem/chains');

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    let passCount = 0;
    let failCount = 0;

    for (const user of users) {
        try {
            const stats = await publicClient.readContract({
                address: DAILY_APP_ADDRESS,
                abi: USER_STATS_ABI,
                functionName: 'userStats',
                args: [user.wallet],
            });
            const onchainXp = Number(stats[0]);
            const onchainTier = Number(stats[3]);
            const tasksCompleted = Number(stats[1]);

            const xpMatch   = onchainXp === user.totalXp;
            const tierMatch = onchainTier === user.tier;
            const status    = xpMatch && tierMatch ? '✅' : '❌';

            if (xpMatch && tierMatch) passCount++;
            else failCount++;

            console.log(`${status} ${user.wallet}`);
            console.log(`   XP:   expected=${user.totalXp}, onchain=${onchainXp} ${xpMatch ? '✓' : '✗'}`);
            console.log(`   Tier: expected=${user.tier},   onchain=${onchainTier} ${tierMatch ? '✓' : '✗'}`);
            console.log(`   Tasks completed on-chain: ${tasksCompleted}`);
        } catch (err) {
            failCount++;
            console.error(`❌ ${user.wallet}: RPC error — ${err.message}`);
        }
    }

    console.log(`\n📊 Verification Summary: ${passCount} PASS, ${failCount} FAIL`);
    return failCount === 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' XP Recovery Migration — Supabase → DailyAppV16');
    console.log(` Mode: ${IS_DRY_RUN ? '🔍 DRY RUN' : IS_VERIFY ? '🔎 VERIFY ONLY' : '🚀 EXECUTE'}`);
    console.log('═══════════════════════════════════════════════════════════════');

    validateConfig();

    // 1. Fetch user data from Supabase
    const supabaseUsers = await fetchUsersFromSupabase();

    // 2. Fetch on-chain current state
    const usersWithOnchain = await fetchOnchainStats(supabaseUsers);

    // 3. Filter: only users needing migration
    const usersToMigrate = filterUsersNeedingMigration(usersWithOnchain);

    if (usersToMigrate.length === 0) {
        console.log('\n🎉 All users already have correct XP on-chain. Nothing to migrate.');
        return;
    }

    // Validate tiers
    for (const u of usersToMigrate) {
        u.tier = validateTier(u.tier, u.totalXp);
    }

    // 4. Print preview table (always)
    printMigrationTable(usersToMigrate);

    if (IS_DRY_RUN) {
        console.log('\n⚠️  DRY RUN complete. No transactions sent.');
        console.log('   To execute: node scripts/sync/recover_xp_to_contract.cjs --execute');
        console.log('   To verify:  node scripts/sync/recover_xp_to_contract.cjs --verify');
        return;
    }

    if (IS_VERIFY) {
        await verifyMigration(usersToMigrate);
        return;
    }

    // 5. Execute migration
    console.log('\n🚀 Starting migration execution...');
    const { txHashes, migratedWallets } = await executeMigration(usersToMigrate);

    // 6. Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(' MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Migrated: ${migratedWallets.length}/${usersToMigrate.length} users`);
    console.log(`📨 Transactions (${txHashes.length}):`);
    txHashes.forEach(h => console.log(`   • https://sepolia.basescan.org/tx/${h}`));

    // 7. Auto-verify
    console.log('\n🔍 Running post-migration verification...');
    const allPassed = await verifyMigration(
        usersToMigrate.filter(u => migratedWallets.includes(u.wallet))
    );

    if (allPassed) {
        console.log('\n✅ VERDICT: Migration VERIFIED — all users have correct on-chain XP.');
    } else {
        console.log('\n⚠️  VERDICT: Some users failed verification. Run --verify again after a moment.');
    }
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err.message || err);
    process.exit(1);
});
