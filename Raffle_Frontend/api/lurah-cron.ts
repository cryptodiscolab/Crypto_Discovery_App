import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    rpcClient,
    isMainnet,
    MASTER_X_ADDRESS,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    getEnv
} from './constants';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = getEnv('CRON_SECRET', '');
const AUDIT_TIMEOUT_MS = 8000; // 8s audit limit to fit within Vercel 10s Hobby limit

interface AuditResults {
    timestamp: string;
    status: "HEALTHY" | "DEGRADED" | "CRITICAL";
    alerts: string[];
    checks_performed: string[];
    duration?: number;
    error?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();
    const authHeader = req.headers['authorization'];

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const auditResults: AuditResults = {
        timestamp: new Date().toISOString(),
        status: "HEALTHY",
        alerts: [],
        checks_performed: []
    };

    let timeoutId: NodeJS.Timeout | undefined;

    try {
        const tasks = [
            // 1. Database Health Check
            (async () => {
                const { error } = await supabase.from('system_health').select('count', { count: 'exact', head: true }).limit(1);
                if (error) {
                    auditResults.status = "CRITICAL";
                    auditResults.alerts.push(`DB Error: ${error.message}`);
                }
                auditResults.checks_performed.push("Database Connect");
            })(),

            // 2. Blockchain Connectivity Check
            (async () => {
                const contracts = [
                    { name: "MasterX", address: MASTER_X_ADDRESS },
                    { name: "DailyApp", address: DAILY_APP_ADDRESS },
                    { name: "Raffle", address: RAFFLE_ADDRESS }
                ];

                await Promise.all(contracts.map(async (c) => {
                    if (!c.address || c.address === '[RESERVED]') return;
                    try {
                        await rpcClient.getBytecode({ address: c.address as `0x${string}` });
                    } catch (e) {
                        auditResults.status = "CRITICAL";
                        auditResults.alerts.push(`Blockchain Error: ${c.name} unreachable`);
                    }
                }));
                auditResults.checks_performed.push("Blockchain Connectivity");
            })(),

            // 3. Parity & State Audit
            (async () => {
                // Check XP Parity for Top User
                const { data: topUser } = await supabase.from('user_profiles')
                    .select('wallet_address, total_xp')
                    .order('total_xp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (topUser && MASTER_X_ADDRESS && MASTER_X_ADDRESS !== '[RESERVED]') {
                    try {
                        const masterStats = await rpcClient.readContract({
                            address: MASTER_X_ADDRESS as `0x${string}`,
                            abi: [{ name: 'users', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'points', type: 'uint256' }, { name: 'lastClaimTimestamp', type: 'uint64' }, { name: 'referralCount', type: 'uint32' }, { name: 'tier', type: 'uint8' }, { name: 'isVerified', type: 'bool' }, { name: 'referrer', type: 'address' }, { name: 'lastUpdateSeasonId', type: 'uint32' }] }],
                            functionName: 'users',
                            args: [topUser.wallet_address as `0x${string}`]
                        }) as any[];
                        
                        // SAFE BIGINT ARITHMETIC: Convert to Number after extraction
                        const onchainXp = Number(masterStats[0]);
                        const dbXp = Number(topUser.total_xp || 0);
                        const drift = Math.abs(onchainXp - dbXp);
                        
                        if (drift > 10000) {
                            auditResults.status = "CRITICAL";
                            auditResults.alerts.push(`🚨 XP Drift: User ${topUser.wallet_address.slice(0,6)} mismatch ${drift.toLocaleString()}`);
                        }
                    } catch (e: unknown) { 
                        const msg = e instanceof Error ? e.message : String(e);
                        console.warn("Parity check failed:", msg); 
                    }
                }

                // Check for Stuck Campaigns
                const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
                const { data: stuck } = await supabase.from('campaigns')
                    .select('id')
                    .eq('is_verified_payment', true)
                    .eq('status', 'pending')
                    .lt('created_at', oneHourAgo);

                if (stuck && stuck.length > 0) {
                    if (auditResults.status === "HEALTHY") auditResults.status = "DEGRADED";
                    auditResults.alerts.push(`🟠 Found ${stuck.length} stuck missions`);
                }
                auditResults.checks_performed.push("Parity & State Audit");
            })()
        ];

        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("AUDIT_TIMEOUT")), AUDIT_TIMEOUT_MS);
        });

        await Promise.race([Promise.all(tasks), timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);

        // Update Global Health State
        await supabase.from('system_health').upsert({
            service_key: 'lurah_ekosistem',
            status: auditResults.status.toLowerCase(),
            last_heartbeat: new Date().toISOString(),
            last_error: auditResults.alerts.join(' | ') || null
        }, { onConflict: 'service_key' });

        // Telegram Alerts (Non-blocking)
        if (auditResults.status !== "HEALTHY" && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            const icon = auditResults.status === "CRITICAL" ? "🔴" : "🟡";
            const text = `${icon} **LURAH ALERT**\n\nStatus: \`${auditResults.status}\`\nAlerts:\n- ${auditResults.alerts.join('\n- ')}`;
            fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
            }).catch(() => {});
        }

        return res.status(200).json({ ...auditResults, duration: Date.now() - startTime });

    } catch (err: unknown) {
        if (timeoutId) clearTimeout(timeoutId);
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isTimeout = errorMessage === "AUDIT_TIMEOUT";
        
        return res.status(isTimeout ? 200 : 500).json({ 
            ...auditResults, 
            status: isTimeout ? auditResults.status : "CRITICAL",
            error: errorMessage,
            duration: Date.now() - startTime 
        });
    }
}
