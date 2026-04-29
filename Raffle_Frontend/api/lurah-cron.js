import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

// --- CONFIG ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CRON_SECRET = process.env.CRON_SECRET;

const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS || process.env.VITE_MASTER_X_ADDRESS_SEPOLIA;
const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA;
const RAFFLE_ADDRESS = process.env.VITE_RAFFLE_ADDRESS_SEPOLIA;

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL)
});

export default async function handler(req, res) {
    // 1. Security Check
    const authHeader = req.headers['authorization'];
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("🛰️ [Live Lurah] Starting automated audit...");
    const auditResults = {
        timestamp: new Date().toISOString(),
        status: "HEALTHY",
        alerts: []
    };

    try {
        // 2. Database Check
        const { error: dbError } = await supabase.from('system_health').select('count', { count: 'exact', head: true }).limit(1);
        if (dbError) {
            auditResults.status = "CRITICAL";
            auditResults.alerts.push(`DB Error: ${dbError.message}`);
        }

        // 3. Contract Checks
        const contracts = [
            { name: "MasterX", address: MASTER_X_ADDRESS },
            { name: "DailyApp", address: DAILY_APP_ADDRESS },
            { name: "Raffle", address: RAFFLE_ADDRESS }
        ];

        for (const contract of contracts) {
            if (!contract.address) {
                auditResults.alerts.push(`Config Error: Missing address for ${contract.name}`);
                auditResults.status = "DEGRADED";
                continue;
            }
            try {
                await publicClient.getBytecode({ address: contract.address });
            } catch (e) {
                auditResults.status = "CRITICAL";
                auditResults.alerts.push(`Blockchain Error: ${contract.name} (${contract.address.substring(0,6)}) unreachable.`);
            }
        }

        // 4. Parity Check (Lightweight Sampling)
        // Check if top 1 user XP is synced
        const { data: topUser } = await supabase.from('user_profiles').select('wallet_address, total_xp').order('total_xp', { ascending: false }).limit(1).single();
        if (topUser) {
            try {
                const masterStats = await publicClient.readContract({
                    address: MASTER_X_ADDRESS,
                    abi: [{ name: 'users', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'points', type: 'uint256' }, { name: 't1', type: 'uint64' }, { name: 't2', type: 'uint32' }, { name: 'tier', type: 'uint8' }] }],
                    functionName: 'users',
                    args: [topUser.wallet_address]
                });
                const onChainXP = Number(masterStats[0]);
                if (Math.abs(onChainXP - topUser.total_xp) > 5000) { // Threshold for "Critical Drift"
                    auditResults.status = "DEGRADED";
                    auditResults.alerts.push(`Parity Drift Detected: User ${topUser.wallet_address.substring(0,6)} has high XP mismatch.`);
                }
            } catch (e) {
                console.warn("Parity check skipped:", e.message);
            }
        }

        // 5. Update Heartbeat
        await supabase.from('system_health').upsert({
            service_key: 'lurah_ekosistem',
            status: auditResults.status.toLowerCase(),
            last_heartbeat: new Date().toISOString(),
            last_error: auditResults.alerts.join(' | ') || null
        }, { onConflict: 'service_key' });

        // 6. Proactive Telegram Alert (Only if NOT Healthy)
        if (auditResults.status !== "HEALTHY" && BOT_TOKEN && CHAT_ID) {
            const icon = auditResults.status === "CRITICAL" ? "🔴" : "🟡";
            const message = `${icon} **LURAH LIVE ALERT**\n\n` +
                            `Status: \`${auditResults.status}\`\n` +
                            `Alerts:\n- ${auditResults.alerts.join('\n- ')}\n\n` +
                            `👉 [Admin Dashboard](https://crypto-disco-raffle.vercel.app/admin)`;
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' })
            });
        }

        return res.status(200).json(auditResults);

    } catch (err) {
        console.error("Lurah Cron Fatal Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
