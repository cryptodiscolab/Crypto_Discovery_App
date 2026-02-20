import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

// ── Config ─────────────────────────────────────────────────────
const RPC_URL = process.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const MASTER_X = process.env.NEXT_PUBLIC_MASTER_X_ADDRESS || "0x09b672B7B23ae226d80cD60777Ce7751fEbdd461";
const DAILY_APP = process.env.NEXT_PUBLIC_DAILY_APP_ADDRESS || "0x9BdE662649A9C080E96086f70Ed2e5BDa091E653";
const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Max blocks per scan (hindari timeout Vercel 10s)
const MAX_BLOCK_RANGE = 5000;

// ── ABIs (event signatures saja) ───────────────────────────────
const MASTER_X_ABI = [
    "event PointsAwarded(address indexed user, uint256 points, string reason)",
];
const DAILY_APP_ABI = [
    "event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp)",
];

// ── UUID deterministik dari seed ───────────────────────────────
function makeId(seed: string): string {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
    return [
        hash.slice(2, 10),
        hash.slice(10, 14),
        hash.slice(14, 18),
        hash.slice(18, 22),
        hash.slice(22, 34),
    ].join("-");
}

// ── GET handler ────────────────────────────────────────────────
export async function GET(request: Request) {
    // 1) Auth check — tolak akses tanpa secret
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        // 2) Baca last synced block
        const { data: state } = await supabase
            .from("sync_state")
            .select("last_synced_block")
            .eq("id", "main")
            .single();

        const lastBlock = state?.last_synced_block ?? 0;
        const latestBlock = await provider.getBlockNumber();

        if (latestBlock <= lastBlock) {
            return NextResponse.json({
                status: "no_new_blocks",
                lastBlock,
                latestBlock,
            });
        }

        // Batasi range agar tidak timeout
        const fromBlock = lastBlock + 1;
        const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, latestBlock);

        // 3) Setup contracts
        const masterX = new ethers.Contract(MASTER_X, MASTER_X_ABI, provider);
        const dailyApp = new ethers.Contract(DAILY_APP, DAILY_APP_ABI, provider);

        // 4) Fetch events secara paralel
        const [pointEvents, taskEvents] = await Promise.all([
            masterX.queryFilter("PointsAwarded", fromBlock, toBlock),
            dailyApp.queryFilter("TaskCompleted", fromBlock, toBlock),
        ]);

        const rows: Record<string, unknown>[] = [];

        // 5a) Process PointsAwarded events
        for (const ev of pointEvents) {
            const log = ev as ethers.EventLog;
            const [user, points, reason] = log.args;
            rows.push({
                id: makeId(`MASTERX_${log.transactionHash}_${log.index}`),
                wallet_address: (user as string).toLowerCase(),
                task_id: "12e123f5-0ded-4ca1-af04-e8b6924823e2",
                xp_earned: Number(points),
                claimed_at: new Date().toISOString(),
                tx_hash: log.transactionHash,
                source: `MasterX:${reason}`,
            });
        }

        // 5b) Process TaskCompleted events
        for (const ev of taskEvents) {
            const log = ev as ethers.EventLog;
            const [user, taskId, reward, timestamp] = log.args;
            rows.push({
                id: makeId(`DAILYAPP_${log.transactionHash}_${log.index}`),
                wallet_address: (user as string).toLowerCase(),
                task_id: "885535d2-4c5c-4a80-9af5-36666192c244",
                xp_earned: Number(reward),
                claimed_at: new Date(Number(timestamp) * 1000).toISOString(),
                tx_hash: log.transactionHash,
                source: `DailyApp:task_${taskId}`,
            });
        }

        // 6) Batch upsert ke Supabase
        if (rows.length > 0) {
            const { error } = await supabase
                .from("user_task_claims")
                .upsert(rows, { onConflict: "id" });

            if (error) {
                console.error("Supabase upsert error:", error.message);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        // 7) Update sync state
        await supabase
            .from("sync_state")
            .upsert({ id: "main", last_synced_block: toBlock, updated_at: new Date().toISOString() });

        return NextResponse.json({
            status: "ok",
            scanned: `${fromBlock} → ${toBlock}`,
            events_found: rows.length,
            points_events: pointEvents.length,
            task_events: taskEvents.length,
            remaining: latestBlock - toBlock,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Cron sync error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
