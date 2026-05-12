import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    rpcClient,
    isMainnet,
    MASTER_X_ADDRESS,
    DAILY_APP_ADDRESS,
    RAFFLE_ADDRESS,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    getEnv
} from './constants';

// Move initialization inside handler to prevent top-level invocation failures
let supabase: ReturnType<typeof createClient> | null = null;
const getSupabase = () => {
    if (supabase) return supabase;
    const url = SUPABASE_URL;
    const key = SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error(`Missing Supabase Configuration: URL=${!!url}, KEY=${!!key}`);
    }
    supabase = createClient(url, key);
    return supabase;
};

const CRON_SECRET = getEnv('CRON_SECRET', '');
const AUDIT_TIMEOUT_MS = 8000; // 8s total function limit
const INDIVIDUAL_TASK_TIMEOUT_MS = 2500; // 2.5s per task to allow parallel completion

interface AuditResults {
    timestamp: string;
    status: "HEALTHY" | "DEGRADED" | "CRITICAL";
    alerts: string[];
    checks_performed: string[];
    duration?: number;
    error?: string;
}

/**
 * Executes a task with an individual timeout and error boundary
 */
async function runWithTimeout<T>(name: string, promise: Promise<T>, timeoutMs: number, results: AuditResults): Promise<void> {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`TIMEOUT_${name.toUpperCase().replace(/\s/g, '_')}`)), timeoutMs)
    );

    try {
        await Promise.race([promise, timeoutPromise]);
        results.checks_performed.push(name);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.status = msg.startsWith('TIMEOUT') ? "DEGRADED" : "CRITICAL";
        results.alerts.push(`${name}: ${msg}`);
        console.error(`[Lurah Audit] ${name} failed:`, msg);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();
    const authHeader = req.headers['authorization'];

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        // Force initialization check
        getSupabase();
    } catch (initErr: any) {
        return res.status(500).json({ 
            error: "Initialization Failed", 
            message: initErr.message,
            env_status: {
                has_url: !!SUPABASE_URL,
                has_key: !!SUPABASE_SERVICE_ROLE_KEY,
                has_secret: !!CRON_SECRET
            }
        });
    }

    const auditResults: AuditResults = {
        timestamp: new Date().toISOString(),
        status: "HEALTHY",
        alerts: [],
        checks_performed: []
    };

    try {
        // Run audit tasks in parallel with individual boundaries
        await Promise.allSettled([
            // 1. Database Health Check
            runWithTimeout("Database Connect", (async () => {
                const { error } = await getSupabase().from('system_settings').select('key', { count: 'exact', head: true }).limit(1);
                if (error) throw error;
            })(), INDIVIDUAL_TASK_TIMEOUT_MS, auditResults),

            // 2. Blockchain Connectivity Check
            runWithTimeout("Blockchain Connectivity", (async () => {
                const contracts = [
                    { name: "MasterX", address: MASTER_X_ADDRESS },
                    { name: "DailyApp", address: DAILY_APP_ADDRESS },
                    { name: "Raffle", address: RAFFLE_ADDRESS }
                ].filter(c => c.address && c.address !== '[RESERVED]' && c.address.startsWith('0x'));

                if (contracts.length === 0) return; // Skip if no valid addresses
                await Promise.all(contracts.map(async (c) => {
                    await rpcClient.getBytecode({ address: c.address as `0x${string}` });
                }));
            })(), INDIVIDUAL_TASK_TIMEOUT_MS, auditResults),

            // 3. Parity & State Audit
            runWithTimeout("Parity & State Audit", (async () => {
                // Check XP Parity for Top User
                const { data: topUser } = await (getSupabase() as any).from('user_profiles')
                    .select('wallet_address, total_xp')
                    .order('total_xp', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const typedTopUser = topUser as { wallet_address: string; total_xp: number | null } | null;

                if (typedTopUser && MASTER_X_ADDRESS && MASTER_X_ADDRESS !== '[RESERVED]') {
                    const masterStats = await rpcClient.readContract({
                        address: MASTER_X_ADDRESS as `0x${string}`,
                        abi: [{ name: 'users', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'points', type: 'uint256' }, { name: 'lastClaimTimestamp', type: 'uint64' }, { name: 'referralCount', type: 'uint32' }, { name: 'tier', type: 'uint8' }, { name: 'isVerified', type: 'bool' }, { name: 'referrer', type: 'address' }, { name: 'lastUpdateSeasonId', type: 'uint32' }] }],
                        functionName: 'users',
                        args: [typedTopUser.wallet_address as `0x${string}`]
                    }) as any[];
                    
                    const onchainXp = Number(masterStats[0]);
                    const dbXp = Number(typedTopUser.total_xp || 0);
                    const drift = Math.abs(onchainXp - dbXp);
                    
                    if (drift > 10000) {
                        auditResults.alerts.push(`🚨 XP Drift: User ${typedTopUser.wallet_address.slice(0,6)} mismatch ${drift.toLocaleString()}`);
                        if (auditResults.status !== "CRITICAL") auditResults.status = "DEGRADED";
                    }
                }

                // Check for Stuck Campaigns
                const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
                const { data: stuck } = await getSupabase().from('campaigns')
                    .select('id')
                    .eq('is_verified_payment', true)
                    .eq('status', 'pending')
                    .lt('created_at', oneHourAgo);

                if (stuck && stuck.length > 0) {
                    if (auditResults.status === "HEALTHY") auditResults.status = "DEGRADED";
                    auditResults.alerts.push(`🟠 Found ${stuck.length} stuck missions`);
                }
            })(), INDIVIDUAL_TASK_TIMEOUT_MS * 2, auditResults) // Parity gets more time
        ]);

        // Global Timeout Guard for the whole function (to ensure we always save heartbeat)
        const runtime = Date.now() - startTime;
        if (runtime > AUDIT_TIMEOUT_MS) {
            auditResults.status = "DEGRADED";
            auditResults.alerts.push("CRON_RUNTIME_LIMIT_EXCEEDED");
        }

        // Update Global Health State (Essential Heartbeat)
        try {
            await (getSupabase() as any).from('system_health').upsert({
                service_key: 'lurah_ekosistem',
                status: auditResults.status.toLowerCase(),
                last_heartbeat: new Date().toISOString(),
                last_error: auditResults.alerts.join(' | ') || null
            }, { onConflict: 'service_key' });
        } catch (dbErr) {
            console.error("Failed to update heartbeat:", dbErr);
        }

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
        const errorMessage = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ 
            ...auditResults, 
            status: "CRITICAL",
            error: errorMessage,
            duration: Date.now() - startTime 
        });
    }
}
