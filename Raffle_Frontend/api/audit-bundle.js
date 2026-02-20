import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

// ── CONFIG ─────────────────────────────────────────────────────
// Fix: Alchemy Free Tier strictly limits eth_getLogs to 10 blocks.
// We force the use of Base Sepolia Public Node to allow 5000 block ranges.
const RPC_URL = "https://sepolia.base.org";
const MASTER_X = process.env.NEXT_PUBLIC_MASTER_X_ADDRESS || "0x09b672B7B23ae226d80cD60777Ce7751fEbdd461";
const DAILY_APP = process.env.NEXT_PUBLIC_DAILY_APP_ADDRESS || "0x9BdE662649A9C080E96086f70Ed2e5BDa091E653";
const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NEYNAR_KEY = process.env.NEYNAR_API_KEY;

const MAX_BLOCK_RANGE = 5000;

const MASTER_X_ABI = [
    "event PointsAwarded(address indexed user, uint256 points, string reason)",
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
    } else {
        return res.status(400).json({ error: "Invalid action. Use ?action=check or ?action=sync" });
    }
}

// ── ACTION: Farcaster Check ────────────────────────────────────
async function handleFarcasterCheck(req, res) {
    const { address } = req.query;

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid address' });
    }

    const normalizedAddress = address.toLowerCase();

    try {
        const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${normalizedAddress}`,
            {
                headers: { 'api_key': NEYNAR_KEY || '' }
            }
        );

        if (response.status === 404) return res.status(404).json(null);
        if (!response.ok) return res.status(502).json({ error: 'Upstream API failure' });

        const data = await response.json();
        const userList = data[normalizedAddress] || [];
        const user = userList.length > 0 ? userList[0] : null;

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json(user);
    } catch (err) {
        return res.status(500).json({ error: err.message });
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

    // Fix Alchemy 403 Forbidden: Send whitelisted Origin header
    const fetchReq = new ethers.FetchRequest(RPC_URL);
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

        const [pointEvents, taskEvents] = await Promise.all([
            masterX.queryFilter("PointsAwarded", fromBlock, toBlock),
            dailyApp.queryFilter("TaskCompleted", fromBlock, toBlock),
        ]);

        const rows = [];
        for (const log of pointEvents) {
            const [user, points, reason] = log.args;
            rows.push({
                id: makeId(`MASTERX_${log.transactionHash}_${log.index}`),
                wallet_address: user.toLowerCase(),
                task_id: "12e123f5-0ded-4ca1-af04-e8b6924823e2",
                xp_earned: Number(points),
                claimed_at: new Date().toISOString(),
                tx_hash: log.transactionHash,
                source: `MasterX:${reason}`,
            });
        }

        for (const log of taskEvents) {
            const [user, taskId, reward, timestamp] = log.args;
            rows.push({
                id: makeId(`DAILYAPP_${log.transactionHash}_${log.index}`),
                wallet_address: user.toLowerCase(),
                task_id: "885535d2-4c5c-4a80-9af5-36666192c244",
                xp_earned: Number(reward),
                claimed_at: new Date(Number(timestamp) * 1000).toISOString(),
                tx_hash: log.transactionHash,
                source: `DailyApp:task_${taskId}`,
            });
        }

        if (rows.length > 0) {
            await supabase.from("user_task_claims").upsert(rows, { onConflict: "id" });
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
            latestBlock
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
