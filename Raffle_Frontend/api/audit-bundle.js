import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import { verifyMessage } from "viem";

// ── CONFIG ─────────────────────────────────────────────────────
// Fix: Alchemy Free Tier strictly limits eth_getLogs to 10 blocks.
// We force the use of Base Sepolia Public Node to allow 5000 block ranges.
const MASTER_X = process.env.VITE_MASTER_X_ADDRESS || "0x78a566a11AcDA14b2A4F776227f61097C7381C84";
const DAILY_APP = process.env.VITE_V12_CONTRACT_ADDRESS || "0xfc12f4FEFf825860c5145680bde38BF222cC669A";
const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NEYNAR_KEY = process.env.NEYNAR_API_KEY;
const RPC_URL = process.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

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
        'eth_call',
        'eth_estimateGas',
        'eth_blockNumber',
        'eth_getTransactionReceipt',
        'eth_getTransactionByHash',
        'eth_getCode',
        'eth_getStorageAt',
        'eth_getBalance'
    ];

    const { method } = req.body || {};
    if (!ALLOWED_METHODS.includes(method)) {
        return res.status(403).json({ error: `Method ${method} is not allowed via proxy` });
    }

    const ALCHEMY_KEY = process.env.VITE_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
    const CHAIN_ID = req.query.chainId || '84532'; // Default to Base Sepolia

    if (!ALCHEMY_KEY) {
        return res.status(500).json({ error: 'RPC Configuration Missing' });
    }

    const rpcUrl = CHAIN_ID === '8453'
        ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
        : `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    try {
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const rawText = await response.text();
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

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid address' });
    }

    // MANDATORY: Signature Verification to prevent Neynar Key abuse
    if (!signature || !message) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const valid = await verifyMessage({ address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const normalizedAddress = address.toLowerCase();
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
