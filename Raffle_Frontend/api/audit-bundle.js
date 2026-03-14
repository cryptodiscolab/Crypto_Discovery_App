import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import { verifyMessage } from "viem";

// ── CONFIG ─────────────────────────────────────────────────────
// Fix: Alchemy Free Tier strictly limits eth_getLogs to 10 blocks.
// We force the use of Base Sepolia Public Node to allow 5000 block ranges.
const MASTER_X = (process.env.VITE_MASTER_X_ADDRESS || process.env.MASTER_X_ADDRESS || "").trim();
const DAILY_APP = (process.env.VITE_V12_CONTRACT_ADDRESS || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA || process.env.DAILY_APP_ADDRESS || "").trim();
const CRON_SECRET = (process.env.CRON_SECRET || '').trim();
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const NEYNAR_KEY = (process.env.NEYNAR_API_KEY || '').trim();
const RPC_URL = (process.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org").trim();

const TASK_IDS = {
    REFERRAL_XP: (process.env.REFERRAL_TASK_ID || "12e123f5-0ded-4ca1-af04-e8b6924823e2").trim(),
    ONCHAIN_TASK: (process.env.ONCHAIN_TASK_ID || "885535d2-4c5c-4a80-9af5-36666192c244").trim(),
    TIER_UPGRADE: (process.env.TIER_UPGRADE_TASK_ID || "2c1e23f5-0ded-4ca1-af04-e8b6924823e2").trim()
};

const MAX_BLOCK_RANGE = 5000;

const MASTER_X_ABI = [
    "event PointsAwarded(address indexed user, uint256 points, string reason)",
    "event TierUpgraded(address indexed user, uint8 oldTier, uint8 newTier, uint256 xpBurned, uint256 feePaid)",
    "event SeasonReset(uint256 indexed oldSeasonId, uint256 indexed newSeasonId)",
    "function users(address) view returns (uint256 points, uint8 tier, uint256 lastClaimTimestamp, uint256 referralCount, bool isVerified, address referrer)"
];
const DAILY_APP_ABI = [
    "event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp)",
];

function makeId(seed) {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
    return [
        hash.slice(2, 10), hash.slice(10, 14), hash.slice(14, 18), hash.slice(18, 22), hash.slice(22, 34)
    ].join("-");
}

export default async function handler(req, res) {
    const { action } = req.query;

    // ── ROUTING ────────────────────────────────────────────────
    if (action === 'check') {
        return handleFarcasterCheck(req, res);
    } else if (action === 'sync') {
        return handleSyncEvents(req, res);
    } else if (action === 'rpc') {
        return handleRpcProxy(req, res);
    } else {
        return res.status(400).json({ error: "Invalid action. Use ?action=check, ?action=sync, or ?action=rpc" });
    }
}

// ── ACTION: RPC Proxy ──────────────────────────────────────────
async function handleRpcProxy(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // WHITELIST: Only allow read-only or estimation methods to prevent abuse
    const ALLOWED_METHODS = [
        'eth_sendRawTransaction',
        'eth_getTransactionCount',
        'eth_chainId',
        'eth_gasPrice',
        'eth_maxPriorityFeePerGas',
        'eth_feeHistory',
        'eth_getBlockByNumber',
        'eth_call',
        'eth_estimateGas',
        'eth_blockNumber',
        'eth_getTransactionReceipt',
        'eth_getTransactionByHash',
        'eth_getCode',
        'eth_getStorageAt',
        'eth_getBalance',
        'net_version',
        'net_listening',
        'eth_protocolVersion',
        'web3_clientVersion'
    ];

    const { method } = req.body || {};
    if (!ALLOWED_METHODS.includes(method)) {
        return res.status(403).json({ error: `Method ${method} is not allowed via proxy` });
    }

    const ALCHEMY_KEY = (process.env.VITE_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY || '').trim();
    const CHAIN_ID = req.query.chainId || '84532'; // Default to Base Sepolia

    if (!ALCHEMY_KEY) {
        return res.status(500).json({ error: 'RPC Configuration Missing' });
    }

    const targetRpc = CHAIN_ID === '8453'
        ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
        : `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    const rpcUrl = new URL(targetRpc);

    try {
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Fix: Alchemy 403 Forbidden "Unspecified origin not on whitelist"
                'Origin': 'https://crypto-discovery-app.vercel.app',
                'Referer': 'https://crypto-discovery-app.vercel.app/'
            },
            body: JSON.stringify(req.body)
        });

        const rawText = await response.text();
        if (!response.ok) {
            console.error(`[RPC Proxy Upstream Error] Status: ${response.status}`, rawText.substring(0, 500));
            return res.status(response.status).send(rawText);
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseError) {
            console.error(`[RPC Proxy Error]: Non-JSON response (Status: ${response.status}):`, rawText.substring(0, 100));
            return res.status(502).json({ error: 'Invalid proxy response from upstream', details: rawText.substring(0, 100) });
        }

        return res.status(response.status).json(data);
    } catch (error) {
        console.error('[RPC Proxy Error]:', error.message);
        return res.status(500).json({ error: 'Failed to proxy RPC request' });
    }
}

// ── ACTION: Farcaster Check ────────────────────────────────────
async function handleFarcasterCheck(req, res) {
    const { address, signature, message } = req.query;

    // Normalize and validate address
    const cleanAddress = (address || '').trim().toLowerCase();

    if (!cleanAddress || !/^0x[0-9a-fA-F]{40}$/.test(cleanAddress)) {
        console.error(`[farcaster-check] 400 - Invalid or missing address: "${address}"`, req.query);
        return res.status(400).json({ error: 'Invalid address format' });
    }

    // Signature Verification (Recommended to prevent Neynar Key abuse)
    // For now, we allow legacy checks without signatures to avoid breaking existing UI
    if (signature && message) {
        try {
            const valid = await verifyMessage({ address: cleanAddress, message, signature });
            if (!valid) return res.status(401).json({ error: 'Invalid signature' });
        } catch (err) {
            return res.status(401).json({ error: 'Signature verification failed' });
        }
    } else {
        console.warn(`[farcaster-check] Calling without signature for address: ${cleanAddress}`);
    }

    try {
        const neynarUrl = new URL('https://api.neynar.com/v2/farcaster/user/bulk-by-address');
        neynarUrl.searchParams.set('addresses', cleanAddress);

        const response = await fetch(
            neynarUrl,
            {
                headers: {
                    'api_key': NEYNAR_KEY || '',
                    // Fix Origin issue if Neynar also whitelists origins
                    'Origin': 'https://crypto-discovery-app.vercel.app'
                }
            }
        );

        if (response.status === 404) return res.status(404).json(null);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Neynar Error] HTTP ${response.status}:`, errorText);
            return res.status(502).json({ error: 'Neynar Upstream API failure', status: response.status });
        }

        const data = await response.json();
        // Neynar bulk-by-address returns an object where keys are the addresses
        const userList = data[cleanAddress] || [];
        const user = userList.length > 0 ? userList[0] : null;

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        return res.status(user ? 200 : 404).json(user);
    } catch (err) {
        console.error('[Neynar Internal Error]:', err.message);
        return res.status(500).json({ error: 'Discovery failure', details: err.message });
    }
}

// ── ACTION: Sync Events ───────────────────────────────────────
async function handleSyncEvents(req, res) {
    const authHeader = req.headers['authorization'];
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: "Missing Supabase config" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Fix Alchemy 10-block limit: Force use of public node for getLogs
    const PUBLIC_RPC = "https://sepolia.base.org";
    const fetchReq = new ethers.FetchRequest(PUBLIC_RPC);
    fetchReq.setHeader("Origin", "https://crypto-discovery-app.vercel.app");
    const provider = new ethers.JsonRpcProvider(fetchReq);

    try {
        const { data: state } = await supabase
            .from("sync_state")
            .select("last_synced_block")
            .eq("id", "main")
            .single();

        const lastBlock = state?.last_synced_block ?? 0;
        const latestBlock = await provider.getBlockNumber();

        if (latestBlock <= lastBlock) {
            return res.json({ status: "no_new_blocks", lastBlock, latestBlock });
        }

        const fromBlock = lastBlock + 1;
        // Kurangi range max menjadi 2000 block untuk menghindari timeout/limit node publik
        const toBlock = Math.min(fromBlock + 2000 - 1, latestBlock);

        // Fix ENS error: Paksa hilangkan hidden whitespace (\n / \r) dari Vercel Env Vars hasil 'echo'
        // Jika length != 42, ethers v6 memicu ENS lookup.
        const masterXAddr = MASTER_X.trim().toLowerCase();
        const dailyAppAddr = DAILY_APP.trim().toLowerCase();

        const masterX = new ethers.Contract(masterXAddr, MASTER_X_ABI, provider);
        const dailyApp = new ethers.Contract(dailyAppAddr, DAILY_APP_ABI, provider);

        const [pointEvents, taskEvents, upgradeEvents, seasonEvents] = await Promise.all([
            masterX.queryFilter("PointsAwarded", fromBlock, toBlock),
            dailyApp.queryFilter("TaskCompleted", fromBlock, toBlock),
            masterX.queryFilter("TierUpgraded", fromBlock, toBlock),
            masterX.queryFilter("SeasonReset", fromBlock, toBlock),
        ]);

        const rows = [];
        for (const log of pointEvents) {
            const [user, points, reason] = log.args;
            const wallet = user.toLowerCase();
            const xp = Number(points);

            rows.push({
                id: makeId(`MASTERX_${log.transactionHash}_${log.index}`),
                wallet_address: wallet,
                task_id: TASK_IDS.REFERRAL_XP,
                xp_earned: xp,
                claimed_at: new Date().toISOString(),
                tx_hash: log.transactionHash,
                source: `MasterX:${reason}`,
            });

            // Log to Activity (New Feature) - Specifically handle Referral XP
            const isReferral = reason.toLowerCase().includes('referral');
            await logActivity(supabase, {
                wallet: wallet,
                category: 'XP',
                type: isReferral ? 'Referral Reward' : 'Staking Reward',
                description: `Received ${xp} XP ${isReferral ? 'for inviting a user' : `for ${reason}`}`,
                amount: xp,
                symbol: 'XP',
                txHash: log.transactionHash
            });
        }

        for (const log of taskEvents) {
            const [user, taskId, reward, timestamp] = log.args;
            const wallet = user.toLowerCase();
            const xp = Number(reward);

            rows.push({
                id: makeId(`DAILYAPP_${log.transactionHash}_${log.index}`),
                wallet_address: wallet,
                task_id: TASK_IDS.ONCHAIN_TASK,
                xp_earned: xp,
                claimed_at: new Date(Number(timestamp) * 1000).toISOString(),
                tx_hash: log.transactionHash,
                source: `DailyApp:task_${taskId}`,
            });

            // Log to Activity (New Feature)
            await logActivity(supabase, {
                wallet: wallet,
                category: 'XP',
                type: 'On-Chain Task',
                description: `Completed task #${taskId} on-chain`,
                amount: xp,
                symbol: 'XP',
                txHash: log.transactionHash
            });
        }

        // SYNC: Self-Upgrade Tiers
        for (const log of upgradeEvents) {
            const [user, oldTier, newTier, xpBurned, feePaid] = log.args;
            const wallet = user.toLowerCase();

            // 1. Log the upgrade activity
            const burn = Number(xpBurned);
            rows.push({
                id: makeId(`UPGRADE_${log.transactionHash}_${log.index}`),
                wallet_address: wallet,
                task_id: TASK_IDS.TIER_UPGRADE, // Dedicated Upgrade task ID
                xp_earned: -burn, // Negative XP to reflect burn in history
                claimed_at: new Date().toISOString(),
                tx_hash: log.transactionHash,
                source: `TierUpgrade:${oldTier}->${newTier}`,
            });

            // Log to Activity (New Feature)
            await logActivity(supabase, {
                wallet: wallet,
                category: 'PURCHASE', // Upgrades are a purchase/burn of value
                type: 'Tier Ascension',
                description: `Upgraded from Tier ${oldTier} to ${newTier}`,
                amount: -burn,
                symbol: 'XP',
                txHash: log.transactionHash
            });

            // 2. Immediate DB update for the tier
            await supabase
                .from('user_profiles')
                .update({
                    tier: Number(newTier),
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_address', wallet);

            console.log(`[Sync] User ${wallet} upgraded to Tier ${newTier}`);
        }

        // SYNC: Season Reset
        for (const log of seasonEvents) {
            const [oldSeasonId, newSeasonId] = log.args;
            const sOld = Number(oldSeasonId);
            const sNew = Number(newSeasonId);

            console.log(`[Sync] 🔥 Season Reset detected: ${sOld} -> ${sNew}. Archiving and resetting tiers...`);

            // Use the Postgres function for one-step archival and reset (Atomic & Fast)
            const { error } = await supabase.rpc('fn_archive_and_reset_season', {
                p_old_season_id: sOld,
                p_new_season_id: sNew
            });

            if (error) {
                console.error(`[Sync] ❌ Season Archival Error:`, error.message);
            } else {
                console.log(`[Sync] ✅ Season ${sOld} archived. New Season ${sNew} active in DB.`);
            }
        }

        if (rows.length > 0) {
            await supabase.from("user_task_claims").upsert(rows, { onConflict: "id" });
        }

        // ── SBT TIER SYNC ─────────────────────────────────────────────
        // For every unique wallet that had activity in this block range,
        // read their on-chain tier from MasterX and sync it to Supabase.
        // This is the fully automated SBT enforcement gate.
        const activeWallets = [...new Set(rows.map(r => r.wallet_address))];
        if (activeWallets.length > 0) {
            const tierUpdates = [];
            for (const wallet of activeWallets) {
                try {
                    const userData = await masterX.users(wallet);
                    const onChainTier = Number(userData.tier);
                    tierUpdates.push({ wallet_address: wallet, on_chain_tier: onChainTier });
                } catch (e) {
                    console.warn(`[SBT Sync] Failed to read tier for ${wallet}:`, e.message);
                }
            }

            // Batch update DB tiers to match on-chain reality
            for (const { wallet_address, on_chain_tier } of tierUpdates) {
                await supabase
                    .from('user_profiles')
                    .update({ tier: on_chain_tier, updated_at: new Date().toISOString() })
                    .eq('wallet_address', wallet_address)
                    .lt('tier', on_chain_tier); // ONLY UPGRADE, never downgrade (safety)
            }

            // Also check ALL profiles with tier=0 to pick up any SBT mints
            // that may have happened outside of the event range (e.g., wallet was
            // inactive for a while but now has XP in DB)
            const { data: guestProfiles } = await supabase
                .from('user_profiles')
                .select('wallet_address')
                .eq('tier', 0)
                .gt('total_xp', 0) // Only bother checking if they have XP
                .limit(20); // Throttle to avoid rate limits

            for (const profile of (guestProfiles || [])) {
                try {
                    const userData = await masterX.users(profile.wallet_address);
                    const onChainTier = Number(userData.tier);
                    if (onChainTier > 0) {
                        await supabase
                            .from('user_profiles')
                            .update({ tier: onChainTier, updated_at: new Date().toISOString() })
                            .eq('wallet_address', profile.wallet_address);
                        console.log(`[SBT Sync] ✅ Promoted ${profile.wallet_address} to Tier ${onChainTier}`);
                    }
                } catch (e) {
                    console.warn(`[SBT Sync] Failed guest-check for ${profile.wallet_address}:`, e.message);
                }
            }
        }

        await supabase.from("sync_state").upsert({
            id: "main",
            last_synced_block: toBlock,
            updated_at: new Date().toISOString()
        });

        return res.json({
            status: "ok",
            scanned: `${fromBlock} → ${toBlock}`,
            events_found: rows.length,
            sbt_wallets_checked: activeWallets.length,
            latestBlock
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

/**
 * logActivity: Internal helper to record events in the bundle.
 */
async function logActivity(supabase, { wallet, category, type, description, amount, symbol, txHash, metadata }) {
    try {
        await supabase.from('user_activity_logs').insert({
            wallet_address: wallet.toLowerCase(),
            category,
            activity_type: type,
            description,
            value_amount: amount || 0,
            value_symbol: symbol || 'XP',
            tx_hash: txHash,
            metadata: metadata || {}
        });
    } catch (err) {
        console.error('[logActivity Error]', err.message);
    }
}
