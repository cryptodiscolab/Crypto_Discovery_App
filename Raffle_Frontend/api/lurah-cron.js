import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';

// --- CONFIG ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CRON_SECRET = process.env.CRON_SECRET;

// [v3.59.0] Dynamic network switcher (mirrors admin-bundle.js pattern)
const CHAIN_ID = (process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '84532').trim();
const isMainnet = CHAIN_ID === '8453';

const MASTER_X_ADDRESS = isMainnet
    ? (process.env.VITE_MASTER_X_ADDRESS || process.env.MASTER_X_ADDRESS)
    : (process.env.MASTER_X_ADDRESS || process.env.VITE_MASTER_X_ADDRESS_SEPOLIA);
const DAILY_APP_ADDRESS = isMainnet
    ? (process.env.VITE_V12_CONTRACT_ADDRESS || process.env.DAILY_APP_ADDRESS)
    : (process.env.DAILY_APP_ADDRESS || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA);
const RAFFLE_ADDRESS = isMainnet
    ? (process.env.VITE_RAFFLE_ADDRESS || process.env.RAFFLE_ADDRESS)
    : process.env.VITE_RAFFLE_ADDRESS_SEPOLIA;

const RPC_URL = isMainnet
    ? (process.env.VITE_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org')
    : (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const publicClient = createPublicClient({
    chain: isMainnet ? base : baseSepolia,
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
                // Auto-Retry Logic
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        await publicClient.getBytecode({ address: contract.address });
                        break;
                    } catch (err) {
                        if (attempt === 3) throw err;
                        await new Promise(res => setTimeout(res, 1500));
                    }
                }
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
                let masterStats;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        masterStats = await publicClient.readContract({
                            address: MASTER_X_ADDRESS,
                            abi: [{ name: 'users', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'points', type: 'uint256' }, { name: 'lastClaimTimestamp', type: 'uint64' }, { name: 'referralCount', type: 'uint32' }, { name: 'tier', type: 'uint8' }, { name: 'isVerified', type: 'bool' }, { name: 'referrer', type: 'address' }, { name: 'lastUpdateSeasonId', type: 'uint32' }] }],
                            functionName: 'users',
                            args: [topUser.wallet_address]
                        });
                        break;
                    } catch (err) {
                        if (attempt === 3) throw err;
                        await new Promise(res => setTimeout(res, 1500));
                    }
                }
                const onChainXP = Number(masterStats[0]);
                const drift = Math.abs(onChainXP - topUser.total_xp);

                // [v3.59.0] Enhanced XP Drift Grading
                if (drift > 10000) {
                    auditResults.status = "CRITICAL";
                    auditResults.alerts.push(`🚨 CRITICAL XP Drift: User ${topUser.wallet_address.substring(0,6)} has ${drift.toLocaleString()} XP mismatch (on-chain: ${onChainXP.toLocaleString()} vs DB: ${topUser.total_xp.toLocaleString()}).`);
                } else if (drift > 5000) {
                    if (auditResults.status === "HEALTHY") auditResults.status = "DEGRADED";
                    auditResults.alerts.push(`⚠️ XP Drift Detected: User ${topUser.wallet_address.substring(0,6)} has ${drift.toLocaleString()} XP mismatch.`);
                }
            } catch (e) {
                console.warn("Parity check skipped (RPC Failure):", e.message);
            }
        }

        // 5. [v3.59.0] Stuck Mission Detector
        // Missions with is_verified_payment=true but status='pending' for >1 hour
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data: stuckMissions, error: smErr } = await supabase
                .from('campaigns')
                .select('id, title, created_at, sponsor_address')
                .eq('is_verified_payment', true)
                .eq('status', 'pending')
                .lt('created_at', oneHourAgo);

            if (!smErr && stuckMissions && stuckMissions.length > 0) {
                if (auditResults.status === "HEALTHY") auditResults.status = "DEGRADED";
                const missionList = stuckMissions.map(m => `"${m.title}" (ID: ${String(m.id).substring(0,8)})`).join(', ');
                auditResults.alerts.push(`🟠 Stuck Missions [${stuckMissions.length}]: Payment verified but still pending >1hr: ${missionList}. Admin action required.`);
            }
        } catch (e) {
            console.warn("Stuck mission check failed:", e.message);
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
