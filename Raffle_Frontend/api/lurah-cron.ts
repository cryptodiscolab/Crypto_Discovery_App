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
const TIMEOUT_LIMIT = 9000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();
    const authHeader = req.headers['authorization'];

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const auditResults: any = {
        timestamp: new Date().toISOString(),
        status: "HEALTHY",
        alerts: [],
        checks_performed: []
    };

    try {
        const tasks = [
            (async () => {
                const { error } = await supabase.from('system_health').select('count', { count: 'exact', head: true }).limit(1);
                if (error) {
                    auditResults.status = "CRITICAL";
                    auditResults.alerts.push(`DB Error: ${error.message}`);
                }
                auditResults.checks_performed.push("Database Connect");
            })(),

            (async () => {
                const contracts = [
                    { name: "MasterX", address: MASTER_X_ADDRESS },
                    { name: "DailyApp", address: isMainnet ? getEnv('VITE_V12_CONTRACT_ADDRESS') : getEnv('DAILY_APP_ADDRESS') },
                    { name: "Raffle", address: isMainnet ? getEnv('VITE_RAFFLE_ADDRESS') : getEnv('VITE_RAFFLE_ADDRESS_SEPOLIA') }
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

            (async () => {
                const { data: topUser } = await supabase.from('user_profiles').select('wallet_address, total_xp').order('total_xp', { ascending: false }).limit(1).maybeSingle();
                if (topUser) {
                    try {
                        const masterStats: any = await rpcClient.readContract({
                            address: MASTER_X_ADDRESS as `0x${string}`,
                            abi: [{ name: 'users', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'points', type: 'uint256' }, { name: 'lastClaimTimestamp', type: 'uint64' }, { name: 'referralCount', type: 'uint32' }, { name: 'tier', type: 'uint8' }, { name: 'isVerified', type: 'bool' }, { name: 'referrer', type: 'address' }, { name: 'lastUpdateSeasonId', type: 'uint32' }] }],
                            functionName: 'users',
                            args: [topUser.wallet_address]
                        });
                        const drift = Math.abs(Number(masterStats[0]) - topUser.total_xp);
                        if (drift > 10000) {
                            auditResults.status = "CRITICAL";
                            auditResults.alerts.push(`🚨 XP Drift: User ${topUser.wallet_address.slice(0,6)} mismatch ${drift}`);
                        }
                    } catch (e: any) { console.warn("Parity failed:", e.message); }
                }

                const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
                const { data: stuck } = await supabase.from('campaigns').select('id').eq('is_verified_payment', true).eq('status', 'pending').lt('created_at', oneHourAgo);
                if (stuck && stuck.length > 0) {
                    if (auditResults.status === "HEALTHY") auditResults.status = "DEGRADED";
                    auditResults.alerts.push(`🟠 Found ${stuck.length} stuck missions`);
                }
                auditResults.checks_performed.push("Parity & State Audit");
            })()
        ];

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AUDIT_TIMEOUT")), TIMEOUT_LIMIT));
        await Promise.race([Promise.all(tasks), timeoutPromise]);

        await supabase.from('system_health').upsert({
            service_key: 'lurah_ekosistem',
            status: auditResults.status.toLowerCase(),
            last_heartbeat: new Date().toISOString(),
            last_error: auditResults.alerts.join(' | ') || null
        }, { onConflict: 'service_key' });

        if (auditResults.status !== "HEALTHY" && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            const icon = auditResults.status === "CRITICAL" ? "🔴" : "🟡";
            const text = `${icon} **LURAH ALERT**\n\nStatus: \`${auditResults.status}\`\nAlerts:\n- ${auditResults.alerts.join('\n- ')}`;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
            }).catch(() => {});
        }

        return res.status(200).json({ ...auditResults, duration: Date.now() - startTime });
    } catch (err: any) {
        return res.status(err.message === "AUDIT_TIMEOUT" ? 200 : 500).json({ ...auditResults, error: err.message });
    }
}
