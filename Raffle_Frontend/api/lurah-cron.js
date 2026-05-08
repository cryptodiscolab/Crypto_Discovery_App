import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';

// --- CONFIG ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CRON_SECRET = process.env.CRON_SECRET;

// [v3.59.2] Resiliency & Timeout Configuration
const TIMEOUT_LIMIT = 9000; // 9 seconds to stay safe within Vercel's 10s hobby limit
const VERCEL_ENV = process.env.VERCEL_ENV || 'production';

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
    const startTime = Date.now();
    
    // 1. Security Check
    const authHeader = req.headers['authorization'];
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn("🔐 [Live Lurah] Unauthorized access attempt.");
        return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("🛰️ [Live Lurah] Starting automated audit cycle...");
    const auditResults = {
        timestamp: new Date().toISOString(),
        status: "HEALTHY",
        alerts: [],
        checks_performed: []
    };

    try {
        // --- 2. PARALLEL EXECUTION PIPELINE ---
        // We use Promise.all to maximize performance and avoid sequential blocking
        const tasks = [
            // TASK A: Database Integrity
            (async () => {
                const { error: dbError } = await supabase.from('system_health').select('count', { count: 'exact', head: true }).limit(1);
                if (dbError) {
                    auditResults.status = "CRITICAL";
                    auditResults.alerts.push(`DB Error: ${dbError.message}`);
                }
                auditResults.checks_performed.push("Database Connect");
            })(),

            // TASK B: Blockchain Accessibility (Parallel)
            (async () => {
                const contracts = [
                    { name: "MasterX", address: MASTER_X_ADDRESS },
                    { name: "DailyApp", address: DAILY_APP_ADDRESS },
                    { name: "Raffle", address: RAFFLE_ADDRESS }
                ];

                await Promise.all(contracts.map(async (contract) => {
                    if (!contract.address || contract.address === '[RESERVED]') {
                        auditResults.alerts.push(`Config Warning: ${contract.name} address is ${contract.address}`);
                        return;
                    }
                    try {
                        // Auto-Retry Logic (Optimized for parallel execution)
                        for (let attempt = 1; attempt <= 2; attempt++) {
                            try {
                                await publicClient.getBytecode({ address: contract.address });
                                break;
                            } catch (err) {
                                if (attempt === 2) throw err;
                                await new Promise(res => setTimeout(res, 500));
                            }
                        }
                    } catch (e) {
                        auditResults.status = "CRITICAL";
                        auditResults.alerts.push(`Blockchain Error: ${contract.name} unreachable.`);
                    }
                }));
                auditResults.checks_performed.push("Blockchain Connectivity");
            })(),

            // TASK C: Parity & Stuck Mission Checks
            (async () => {
                // Check top user XP parity
                const { data: topUser } = await supabase.from('user_profiles').select('wallet_address, total_xp').order('total_xp', { ascending: false }).limit(1).single();
                if (topUser) {
                    try {
                        const masterStats = await publicClient.readContract({
                            address: MASTER_X_ADDRESS,
                            abi: [{ name: 'users', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'points', type: 'uint256' }, { name: 'lastClaimTimestamp', type: 'uint64' }, { name: 'referralCount', type: 'uint32' }, { name: 'tier', type: 'uint8' }, { name: 'isVerified', type: 'bool' }, { name: 'referrer', type: 'address' }, { name: 'lastUpdateSeasonId', type: 'uint32' }] }],
                            functionName: 'users',
                            args: [topUser.wallet_address]
                        });
                        const onChainXP = Number(masterStats[0]);
                        const drift = Math.abs(onChainXP - topUser.total_xp);
                        if (drift > 10000) {
                            auditResults.status = "CRITICAL";
                            auditResults.alerts.push(`🚨 XP Drift: User ${topUser.wallet_address.substring(0,6)} mismatch ${drift.toLocaleString()}`);
                        }
                    } catch (e) { console.warn("XP Parity Check Failed:", e.message); }
                }

                // Check for stuck missions (>1hr pending with verified payment)
                try {
                    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
                    const { data: stuck } = await supabase.from('campaigns').select('id').eq('is_verified_payment', true).eq('status', 'pending').lt('created_at', oneHourAgo);
                    if (stuck?.length > 0) {
                        if (auditResults.status === "HEALTHY") auditResults.status = "DEGRADED";
                        auditResults.alerts.push(`🟠 Found ${stuck.length} stuck missions pending >1hr.`);
                    }
                } catch (e) { console.warn("Stuck Mission Check Failed:", e.message); }
                auditResults.checks_performed.push("Parity & State Audit");
            })()
        ];

        // Race against timeout to ensure we ALWAYS return a response
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("AUDIT_TIMEOUT")), TIMEOUT_LIMIT)
        );

        await Promise.race([Promise.all(tasks), timeoutPromise]);

        // 3. Finalize Heartbeat
        await supabase.from('system_health').upsert({
            service_key: 'lurah_ekosistem',
            status: auditResults.status.toLowerCase(),
            last_heartbeat: new Date().toISOString(),
            last_error: auditResults.alerts.join(' | ') || null
        }, { onConflict: 'service_key' });

        // 4. Telegram Alert (Non-Healthy Only)
        if (auditResults.status !== "HEALTHY" && BOT_TOKEN && CHAT_ID) {
            const icon = auditResults.status === "CRITICAL" ? "🔴" : "🟡";
            const message = `${icon} **LURAH ALERT [${VERCEL_ENV}]**\n\n` +
                            `Status: \`${auditResults.status}\`\n` +
                            `Alerts:\n- ${auditResults.alerts.join('\n- ')}`;
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' })
            }).catch(e => console.error("Telegram fail:", e.message));
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [Live Lurah] Audit complete in ${duration}ms. Status: ${auditResults.status}`);
        return res.status(200).json({ ...auditResults, execution_time_ms: duration });

    } catch (err) {
        const isTimeout = err.message === "AUDIT_TIMEOUT";
        console.error(`❌ [Live Lurah] ${isTimeout ? "Timeout" : "Fatal Error"}:`, err.message);
        
        const partialResults = {
            ...auditResults,
            status: isTimeout ? "DEGRADED" : "CRITICAL",
            error: err.message,
            note: isTimeout ? "Partial audit returned due to execution limit." : "Audit aborted."
        };

        return res.status(isTimeout ? 200 : 500).json(partialResults);
    }
}

