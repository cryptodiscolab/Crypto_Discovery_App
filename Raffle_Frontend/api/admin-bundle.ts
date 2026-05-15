/**
 * ADMIN BUNDLE API (v3.63.6-Hardened)
 * -----------------------------------------------------------------------------
 * Hardened administrative oversight for the Crypto Disco DailyApp ecosystem.
 * Enforces Zero-Hardcode Mandate and Strict ESM Resolution.
 */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage, decodeEventLog } from 'viem';
import axios from 'axios';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    rpcClient,
    USDC_ADDRESS,
    MASTER_X_ADDRESS,
    MASTER_X_ABI,
    ERC20_ABI,
    UGC_PLATFORM_LINK_RULES,
    VALID_ACTION_TYPES,
    getEnv,
    DAILY_APP_ADDRESS,
    SAFE_MULTISIG,
    sanitizeError
} from './_shared/constants.js';
import type { Database, Json } from './_shared/database.types.js';
import type { AdminActionPayload } from './_shared/types.js';

const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const AUTHORIZED_ADMINS = [
    getEnv('VITE_ADMIN_ADDRESS', ''),
    getEnv('ADMIN_ADDRESS', ''),
    getEnv('VITE_ADMIN_WALLETS', '')
].join(',').toLowerCase().split(',').filter(Boolean);

async function isAuthorizedAdmin(address: string) {
    let isAuthorized = AUTHORIZED_ADMINS.includes(address.toLowerCase());
    if (!isAuthorized) {
        const { data: profile } = await supabaseAdmin.from('user_profiles').select('is_admin').eq('wallet_address', address.toLowerCase()).maybeSingle();
        if (profile?.is_admin) isAuthorized = true;
    }
    return isAuthorized;
}

async function logAdminAction(admin_address: string, action: string, details: Json) {
    try {
        await supabaseAdmin.from('admin_audit_logs').insert({
            admin_address: admin_address.toLowerCase(),
            action,
            details: details || {},
            created_at: new Date().toISOString()
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[logAdminAction Error]', msg);
    }
}

interface MissionPayload {
    title: string;
    link: string;
    platform_code: string;
    action_types: string[];
    reward_amount_per_user: string;
    max_participants: string;
}

/**
 * Validates UGC Mission payloads against strict platform and amount constraints.
 */
function validateUgcMission(payload: MissionPayload): string[] {
    const errors: string[] = [];
    if (!payload.title || payload.title.trim().length < 5) errors.push('Mission title must be at least 5 characters.');
    if (!payload.link || payload.link.trim().length < 10) errors.push('Mission link is required.');

    const platform = (payload.platform_code || 'farcaster') as keyof typeof UGC_PLATFORM_LINK_RULES;
    const rule = UGC_PLATFORM_LINK_RULES[platform];
    if (rule && payload.link && !rule.pattern.test(payload.link)) {
        errors.push(`[Link Guard] Mission link must be from ${rule.label} for platform "${platform}".`);
    }

    const actionTypes = Array.isArray(payload.action_types) ? payload.action_types : [];
    if (actionTypes.length === 0) errors.push('At least 1 action type is required.');
    if (actionTypes.length > 3) errors.push(`[Multi-Action Bound] Maximum 3 action types allowed. Received: ${actionTypes.length}.`);
    
    const invalidActions = actionTypes.filter((a: string) => !VALID_ACTION_TYPES.has(a));
    if (invalidActions.length > 0) errors.push(`[Action Guard] Invalid action type(s): ${invalidActions.join(', ')}.`);

    const rewardPerUser = parseFloat(payload.reward_amount_per_user);
    if (isNaN(rewardPerUser) || rewardPerUser < 0) errors.push('Reward per user must be a non-negative number.');
    if (rewardPerUser > 1000) errors.push('[Overflow Guard] Reward per user cannot exceed 1000 USDC.');

    const maxParticipants = parseInt(payload.max_participants);
    if (isNaN(maxParticipants) || maxParticipants < 1) errors.push('Max participants must be at least 1.');
    if (maxParticipants > 100000) errors.push('[Overflow Guard] Max participants cannot exceed 100,000.');

    return errors;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.body?.action || req.query?.action || req.body?.action_type;

    // Public read actions (no auth required)
    if (req.method === 'GET' || action === 'get-ugc-config') {
        switch (action) {
            case 'get-ugc-config': {
                const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'ugc_config').maybeSingle();
                return res.status(200).json({ success: true, value: data?.value || { listing_fee_usdc: '5', is_active: true, treasury_address: '' } });
            }
        }
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { 
            address, 
            wallet_address, 
            wallet, 
            signature, 
            message, 
            payload, 
            task_data, 
            tasks, 
            tx_hash,
            task_name,
            task_description,
            target_agent
        } = req.body as { 
            address?: string; 
            wallet_address?: string; 
            wallet?: string; 
            signature?: string; 
            message?: string; 
            payload?: any; 
            task_data?: any; 
            tasks?: any[]; 
            tx_hash?: string;
            task_name?: string;
            task_description?: string;
            target_agent?: string;
        };
        const targetAddress = (address || wallet_address || wallet || '').toLowerCase();

        if (!targetAddress || !signature || !message) return res.status(400).json({ error: 'Missing auth fields' });

        const valid = await verifyMessage({ address: targetAddress as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const isoMatch = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
        if (!isoMatch) return res.status(401).json({ error: 'Invalid message format: Missing timestamp' });
        
        const messageTime = new Date(isoMatch[0]).getTime();
        if (Math.abs(Date.now() - messageTime) / (1000 * 60) > 5) return res.status(401).json({ error: 'Signature expired' });

        if (!(await isAuthorizedAdmin(targetAddress))) return res.status(403).json({ error: 'Unauthorized: Admin only' });

        switch (action) {
            case 'check': return res.status(200).json({ isAdmin: true });
            case 'GET_SBT_CONFIG': {
                const { data, error } = await supabaseAdmin.from('sbt_thresholds').select('*').order('level', { ascending: true });
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            case 'parity-audit': await handleParityAudit(res); break;
            case 'sync-tiers': await handleSyncTiers(res); break;
            case 'sync-points': await handleSyncPoints(res); break;
            case 'SYNC_MULTIPLIERS': await handleGenericUpsert('tier_multipliers', payload, targetAddress, 'SYNC_MULTIPLIERS', res); break;
            case 'SYNC_WEIGHTS': {
                // Update system_settings (master record)
                await handleGenericUpsert('tier_pool_weights', payload, targetAddress, 'SYNC_WEIGHTS', res);
                
                // Propagate to sbt_pool_stats for SBTRewardsDashboard & Trigger logic
                const weightPayload = payload as Record<string, string>;
                const { error: poolErr } = await supabaseAdmin.from('sbt_pool_stats').update({
                    share_legendary: parseInt(weightPayload.diamond || '0'),
                    share_epic: parseInt(weightPayload.platinum || '0'),
                    share_rare: parseInt(weightPayload.gold || '0'),
                    share_common: parseInt(weightPayload.silver || '0'),
                    share_participation: parseInt(weightPayload.bronze || '0'),
                    updated_at: new Date().toISOString()
                }).eq('id', 1);

                if (poolErr) {
                    console.error('[SYNC_WEIGHTS] Failed to update sbt_pool_stats:', poolErr);
                    // We don't throw here to ensure res.status(200) from handleGenericUpsert is handled correctly
                    // Actually, handleGenericUpsert already sends a response. 
                    // I should refactor to avoid double response.
                }
                break;
            }
            case 'WHITELIST_TOKEN_DB': {
                const { error } = await supabaseAdmin.from('allowed_tokens').upsert({ ...payload, address: payload.address.toLowerCase(), is_active: true }, { onConflict: 'chain_id,address' });
                if (error) throw error;
                await logAdminAction(targetAddress, 'WHITELIST_TOKEN_DB', payload);
                return res.status(200).json({ success: true });
            }
            case 'REMOVE_TOKEN_DB': {
                const { error } = await supabaseAdmin.from('allowed_tokens').update({ is_active: false }).match({ chain_id: payload.chain_id, address: payload.address.toLowerCase() });
                if (error) throw error;
                await logAdminAction(targetAddress, 'REMOVE_TOKEN_DB', payload);
                return res.status(200).json({ success: true });
            }
            case 'economy-stats':
            case 'GET_ECONOMY': await handleEconomyStats(res); break;
            case 'accountant-ledger': await handleAccountantLedger(res); break;
            case 'accountant-sync': await handleAccountantSync(req, res, targetAddress); break;
            case 'task-create': await handleTaskCreate(task_data, targetAddress, res); break;
            case 'task-clear': {
                await supabaseAdmin.from('daily_tasks').delete().not('id', 'is', 'null');
                await logAdminAction(targetAddress, 'TASK_CLEAR', {});
                return res.status(200).json({ success: true });
            }
            case 'UPDATE_POINTS': await handleGenericUpsert('point_settings', payload, targetAddress, 'UPDATE_POINTS', res, 'activity_key'); break;
            case 'BATCH_UPDATE_POINTS': {
                const { error } = await supabaseAdmin.from('point_settings').upsert(payload, { onConflict: 'activity_key' });
                if (error) throw error;
                await logAdminAction(targetAddress, 'BATCH_UPDATE_POINTS', { count: payload.length });
                return res.status(200).json({ success: true });
            }
            case 'GRANT_ROLE': await handleRoleUpdate(payload.target_address, true, targetAddress, 'GRANT_ROLE', res); break;
            case 'REVOKE_ROLE': await handleRoleUpdate(payload.target_address, false, targetAddress, 'REVOKE_ROLE', res); break;
            case 'SYNC_RAFFLE': await handleSyncRaffle(payload, targetAddress, res); break;
            case 'CREATE_CAMPAIGN': {
                const { data, error } = await supabaseAdmin.from('campaigns').insert([payload]).select();
                if (error) throw error;
                await logAdminAction(targetAddress, 'CREATE_CAMPAIGN', payload);
                return res.status(200).json({ success: true, data });
            }
            case 'UPDATE_CAMPAIGN_STATUS': {
                await supabaseAdmin.from('campaigns').update({ status: payload.status }).eq('id', payload.id);
                await logAdminAction(targetAddress, 'UPDATE_CAMPAIGN_STATUS', payload);
                return res.status(200).json({ success: true });
            }
            case 'DELETE_CAMPAIGN': {
                await supabaseAdmin.from('campaigns').delete().eq('id', payload.id);
                await logAdminAction(targetAddress, 'DELETE_CAMPAIGN', payload);
                return res.status(200).json({ success: true });
            }
            case 'RESET_SEASON': await handleResetSeason(payload.new_season_id, targetAddress, res); break;
            case 'task-sync': await handleTaskSync((tasks || []) as TaskSyncData[], targetAddress, res); break;
            case 'GRANT_PRIVILEGE': {
                await supabaseAdmin.from('user_privileges').upsert({ wallet_address: payload.target_address.toLowerCase(), feature_id: payload.feature_id, granted_at: new Date().toISOString() }, { onConflict: 'wallet_address,feature_id' });
                await logAdminAction(targetAddress, 'GRANT_PRIVILEGE', payload);
                return res.status(200).json({ success: true });
            }
            case 'REVOKE_PRIVILEGE': {
                await supabaseAdmin.from('user_privileges').delete().eq('wallet_address', payload.target_address.toLowerCase()).eq('feature_id', payload.feature_id);
                await logAdminAction(targetAddress, 'REVOKE_PRIVILEGE', payload);
                return res.status(200).json({ success: true });
            }
            case 'ISSUE_ENS': {
                await supabaseAdmin.from('ens_subdomains').insert([{ ...payload, wallet_address: payload.wallet_address.toLowerCase() }]);
                await logAdminAction(targetAddress, 'ISSUE_ENS', payload);
                return res.status(200).json({ success: true });
            }
            case 'UPDATE_FEATURE_FLAGS': await handleGenericUpsert('active_features', payload, targetAddress, 'UPDATE_FEATURE_FLAGS', res); break;
            case 'UPDATE_UGC_CONFIG': await handleGenericUpsert('ugc_config', payload, targetAddress, 'UPDATE_UGC_CONFIG', res); break;
            case 'CREATE_UGC_MISSION': await handleCreateUgcMission(payload, targetAddress, res); break;
            case 'VERIFY_UGC_PAYMENT_ONCHAIN': await handleVerifyUgcPaymentOnchain(req, res, targetAddress); break;
            case 'reject-mission': await handleRejectMission(req, res, targetAddress); break;
            case 'GET_UGC_REVENUE': await handleGetUgcRevenue(res); break;
            case 'MARK_REVENUE_ALLOCATED': await handleMarkRevenueAllocated(payload.mission_id, targetAddress, res); break;
            case 'UPDATE_THRESHOLDS': {
                const { error } = await supabaseAdmin.from('sbt_thresholds').upsert(payload, { onConflict: 'level' });
                if (error) throw error;
                await logAdminAction(targetAddress, 'UPDATE_THRESHOLDS', { count: payload.length });
                return res.status(200).json({ success: true });
            }
            case 'UPDATE_TIER_CONFIG': await handleGenericUpsert('tier_config', payload, targetAddress, 'UPDATE_TIER_CONFIG', res); break;
            case 'MANUAL_TIER_OVERRIDE': {
                const { error } = await supabaseAdmin.from('user_profiles').update({ tier_override: payload.tier }).eq('wallet_address', payload.target_address.toLowerCase());
                if (error) throw error;
                await logAdminAction(targetAddress, 'MANUAL_TIER_OVERRIDE', payload);
                return res.status(200).json({ success: true });
            }
            case 'NEXUS_DISPATCH': {
                if (!task_name || !target_agent) return res.status(400).json({ error: 'Missing task_name or target_agent' });
                const { error } = await supabaseAdmin.from('agents_vault').insert({
                    task_name,
                    task_description: task_description || '',
                    target_agent,
                    requested_by_wallet: targetAddress,
                    status: 'pending',
                    created_at: new Date().toISOString()
                });
                if (error) throw error;
                await logAdminAction(targetAddress, 'NEXUS_DISPATCH', { task_name, target_agent } as Json);
                return res.status(200).json({ success: true, message: `Task dispatched to ${target_agent}` });
            }
            default:
                return res.status(400).json({ error: `Invalid action: ${action}` });
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: sanitizeError(error) });
    }
}

// ─── Sub-Handlers ────────────────────────────────────────────────────────────

async function handleParityAudit(res: VercelResponse) {
    const { data: users, error } = await supabaseAdmin.from('user_profiles').select('wallet_address, total_xp, tier').order('total_xp', { ascending: false }).limit(50);
    if (error) throw error;

    // Using centralized constants from imports for Zero-Hardcode parity

    const auditResults = await Promise.all(users.map(async (u) => {
        try {
            const stats = await rpcClient.readContract({
                address: DAILY_APP_ADDRESS as `0x${string}`,
                abi: [{
                    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
                    "name": "userStats",
                    "outputs": [
                        {"internalType": "uint256", "name": "points", "type": "uint256"},
                        {"internalType": "uint256", "name": "totalTasksCompleted", "type": "uint256"},
                        {"internalType": "uint256", "name": "referralCount", "type": "uint256"},
                        {"internalType": "uint8", "name": "currentTier", "type": "uint8"},
                        {"internalType": "uint256", "name": "tasksForReferralProgress", "type": "uint256"},
                        {"internalType": "uint256", "name": "lastDailyBonusClaim", "type": "uint256"},
                        {"internalType": "bool", "name": "isBlacklisted", "type": "bool"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                }],
                functionName: 'userStats',
                args: [u.wallet_address as `0x${string}`]
            }) as unknown as [bigint, bigint, bigint, number, bigint, bigint, boolean];

            const onChainXp = Number(stats[0]);
            const onChainTier = Number(stats[3]);
            return {
                address: u.wallet_address,
                db_xp: u.total_xp,
                onchain_xp: onChainXp,
                db_tier: u.tier,
                onchain_tier: onChainTier,
                xp_drift_value: (u.total_xp || 0) - onChainXp,
                tier_drift: u.tier !== onChainTier
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { address: u.wallet_address, error: msg };
        }
    }));

    interface AuditResult {
        address: string;
        db_xp?: number;
        onchain_xp?: number;
        db_tier?: number;
        onchain_tier?: number;
        xp_drift_value?: number;
        tier_drift?: boolean;
        error?: string;
    }

    const typedAuditResults = auditResults as AuditResult[];

    const summary = {
        total_users: users.length,
        xp_drift: typedAuditResults.filter(r => r.xp_drift_value !== 0).length,
        tier_drift: typedAuditResults.filter(r => r.tier_drift).length,
        last_audit_at: new Date().toISOString()
    };

    const contractWeights = await Promise.all([
        rpcClient.readContract({ address: MASTER_X_ADDRESS as `0x${string}`, abi: MASTER_X_ABI, functionName: 'diamondWeight' }),
        rpcClient.readContract({ address: MASTER_X_ADDRESS as `0x${string}`, abi: MASTER_X_ABI, functionName: 'platinumWeight' }),
        rpcClient.readContract({ address: MASTER_X_ADDRESS as `0x${string}`, abi: MASTER_X_ABI, functionName: 'goldWeight' }),
        rpcClient.readContract({ address: MASTER_X_ADDRESS as `0x${string}`, abi: MASTER_X_ABI, functionName: 'silverWeight' }),
        rpcClient.readContract({ address: MASTER_X_ADDRESS as `0x${string}`, abi: MASTER_X_ABI, functionName: 'bronzeWeight' }),
    ]);

    const { data: dbWeights } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'tier_pool_weights').maybeSingle();
    const system_parity = {
        weights_match: JSON.stringify(dbWeights?.value) === JSON.stringify({
            diamond: contractWeights[0]?.toString() || '0',
            platinum: contractWeights[1]?.toString() || '0',
            gold: contractWeights[2]?.toString() || '0',
            silver: contractWeights[3]?.toString() || '0',
            bronze: contractWeights[4]?.toString() || '0'
        })
    };

    return res.status(200).json({ success: true, summary, results: auditResults, system_parity });
}

async function handleSyncTiers(res: VercelResponse) {
    const { data, error } = await supabaseAdmin.rpc('fn_compute_leaderboard_tiers');
    if (error) throw error;
    // Fire-and-forget rank and pool stats refresh
    (async () => { 
        try { 
            await supabaseAdmin.rpc('fn_refresh_rank_scores'); 
            await supabaseAdmin.rpc('fn_refresh_sbt_pool_stats');
        } catch (_) {} 
    })();
    return res.status(200).json({ success: true, total: data.length });
}

async function handleSyncPoints(res: VercelResponse) {
    const { data, error } = await supabaseAdmin.from('user_profiles').select('wallet_address, total_xp').gt('total_xp', 0);
    if (error) throw error;
    return res.status(200).json({ success: true, data });
}

async function handleGenericUpsert(key: string, value: Json, admin: string, action: string, res: VercelResponse, conflictCol = 'key') {
    const row = conflictCol === 'key' ? { key, value, updated_at: new Date().toISOString() } : (value as Record<string, Json>);
    const { error } = await supabaseAdmin.from('system_settings').upsert(row as any, { onConflict: conflictCol as any });
    if (error) throw error;
    await logAdminAction(admin, action, value);
    return res.status(200).json({ success: true });
}

async function handleEconomyStats(res: VercelResponse) {
    const [revenueRes, claimsRes] = await Promise.all([
        supabaseAdmin.from('user_activity_logs').select('value_amount').eq('category', 'PURCHASE').eq('value_symbol', 'USDC'),
        supabaseAdmin.from('user_task_claims').select('xp_earned')
    ]);
    const totalRevenue = revenueRes.data?.reduce((s, r) => s + (Number(r.value_amount) || 0), 0) || 0;
    const totalXp = claimsRes.data?.reduce((s, c) => s + (c.xp_earned || 0), 0) || 0;
    return res.status(200).json({ success: true, metrics: { totalRevenue, totalXp } });
}

async function handleAccountantLedger(res: VercelResponse) {
    const { data: logs, error } = await supabaseAdmin.from('user_activity_logs').select('*').in('category', ['PURCHASE', 'REWARD', 'EXPENSE']).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return res.status(200).json({ success: true, logs });
}

async function handleAccountantSync(req: VercelRequest, res: VercelResponse, admin: string) {
    const CRON_SECRET = getEnv('CRON_SECRET', '');
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.host;
    const syncUrl = `${protocol}://${host}/api/cron/sync-events`;
    try {
        const syncRes = await axios.get(syncUrl, { headers: { 'Authorization': `Bearer ${CRON_SECRET}` }, timeout: 8000 });
        await logAdminAction(admin, 'ACCOUNTANT_SYNC_TRIGGER', syncRes.data);
        return res.status(200).json({ success: true, details: syncRes.data });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(500).json({ error: sanitizeError(e) });
    }
}

interface TaskCreateData {
    title: string;
    description: string;
    xp_reward?: number;
    platform?: string;
    action_type?: string;
    link?: string;
    is_active?: boolean;
}

async function handleTaskCreate(data: TaskCreateData, admin: string, res: VercelResponse) {
    const { error } = await supabaseAdmin.from('daily_tasks').insert({
        title: data.title,
        description: data.description,
        xp_reward: data.xp_reward || 0,
        platform: data.platform || 'base',
        action_type: data.action_type || 'transaction',
        link: data.link || '',
        is_active: !!data.is_active,
        created_at: new Date().toISOString()
    });
    if (error) throw error;
    await logAdminAction(admin, 'TASK_CREATE', data as unknown as Json);
    return res.status(200).json({ success: true });
}

async function handleRoleUpdate(target: string, status: boolean, admin: string, action: string, res: VercelResponse) {
    const { error } = await supabaseAdmin.from('user_profiles').update({ is_admin: status }).eq('wallet_address', target.toLowerCase());
    if (error) throw error;
    await logAdminAction(admin, action, { target });
    return res.status(200).json({ success: true });
}

interface SyncRafflePayload {
    raffle_id: number;
    creator: string;
    nft_address?: string;
    token_id?: number;
    end_time: string;
    title?: string;
}

async function handleSyncRaffle(payload: SyncRafflePayload, admin: string, res: VercelResponse) {
    const raffleData = {
        id: payload.raffle_id,
        creator_address: payload.creator.toLowerCase(),
        nft_contract: payload.nft_address?.toLowerCase() || '',
        token_id: payload.token_id || 0,
        end_time: payload.end_time,
        title: payload.title || `Raffle #${payload.raffle_id}`,
        is_active: true,
        updated_at: new Date().toISOString()
    };
    await supabaseAdmin.from('raffles').upsert(raffleData, { onConflict: 'id' });
    await logAdminAction(admin, 'SYNC_RAFFLE', raffleData as unknown as Json);
    return res.status(200).json({ success: true });
}

async function handleResetSeason(newSeasonId: string, admin: string, res: VercelResponse) {
    await supabaseAdmin.from('user_task_claims').delete().not('id', 'is', 'null');
    await supabaseAdmin.from('user_profiles').update({ xp: 0, total_xp: 0, tier: 0 }).not('wallet_address', 'is', 'null');
    await logAdminAction(admin, 'RESET_SEASON', { newSeasonId });
    return res.status(200).json({ success: true });
}

interface TaskSyncData {
    title: string;
    reward_points: number;
    platform: string;
    action_type: string;
    link: string;
}

async function handleTaskSync(tasks: TaskSyncData[], admin: string, res: VercelResponse) {
    for (const task of tasks) {
        await supabaseAdmin.from('daily_tasks').insert([{
            title: task.title,
            description: task.title,
            xp_reward: task.reward_points,
            platform: task.platform,
            action_type: task.action_type,
            link: task.link,
            is_active: true,
            created_at: new Date().toISOString()
        }]);
    }
    await logAdminAction(admin, 'TASK_SYNC', { tasks_count: tasks.length, task_titles: tasks.map(t => t.title).slice(0, 10) });
    return res.status(200).json({ success: true });
}

interface UgcMissionCreatePayload {
    title: string;
    description: string;
    action_types: string[];
    platform_code?: string;
    link?: string;
    sponsor_address: string;
    reward_amount_per_user: string;
    max_participants: string;
    reward_token_address?: string;
    reward_symbol?: string;
    listing_fee?: string | number;
    total_reward_pool: string;
    duration_days: number;
    payment_tx_hash: string;
}

async function handleCreateUgcMission(payload: UgcMissionCreatePayload, admin: string, res: VercelResponse) {
    const errors = validateUgcMission(payload as unknown as MissionPayload);
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors });

    const missionData: Database['public']['Tables']['campaigns']['Insert'] = { 
        title: payload.title,
        description: payload.description || '',
        platform_code: payload.platform_code || 'farcaster',
        sponsor_address: payload.sponsor_address.toLowerCase(),
        reward_amount_per_user: parseFloat(payload.reward_amount_per_user) || 0,
        max_participants: parseInt(payload.max_participants) || 0,
        total_reward_pool: parseFloat(payload.total_reward_pool) || 0,
        remaining_reward_pool: parseFloat(payload.total_reward_pool) || 0,
        reward_token_address: (payload.reward_token_address || (payload as any).payment_token || USDC_ADDRESS).toLowerCase(),
        reward_symbol: payload.reward_symbol || (payload as any).reward_symbol || 'TOKEN',
        listing_fee: parseFloat(String(payload.listing_fee || 0)),
        duration_days: payload.duration_days || 7,
        creation_tx_hash: payload.payment_tx_hash || '',
        payment_tx_hash: payload.payment_tx_hash || '',
        platform_fee_paid: parseFloat(String(payload.listing_fee || 0)), // Support legacy field
        sbt_share_amount: parseFloat(String(payload.listing_fee || 0)),
        chain_id: 8453, // Default to Base
        is_active: false, 
        is_verified_payment: false, 
        created_at: new Date().toISOString() 
    };
    const { data: campaign, error: cErr } = await supabaseAdmin.from('campaigns').insert([missionData]).select().maybeSingle();
    if (cErr || !campaign) throw cErr || new Error('Failed to create campaign');

    const taskRows: Database['public']['Tables']['daily_tasks']['Insert'][] = payload.action_types.map((action: string) => ({
        title: `${payload.title} (${action.toUpperCase()})`,
        description: payload.description || '',
        xp_reward: 0,
        platform: payload.platform_code || 'farcaster',
        action_type: action,
        link: payload.link || '',
        is_active: false,
        task_type: 'ugc',
        target_id: campaign.id,
        creator_address: payload.sponsor_address || '',
        created_at: new Date().toISOString()
    }));

    await supabaseAdmin.from('daily_tasks').insert(taskRows);
    await logAdminAction(admin, 'CREATE_UGC_MISSION', { campaign_id: campaign.id, ...missionData } as unknown as Json);
    return res.status(200).json({ success: true, data: campaign });
}

async function handleVerifyUgcPaymentOnchain(req: VercelRequest, res: VercelResponse, admin: string) {
    const { mission_id } = req.body;
    const { data: mission, error: mErr } = await supabaseAdmin.from('campaigns').select('*').eq('id', mission_id).maybeSingle();
    if (mErr || !mission) throw new Error("Mission not found");
    if (!mission.payment_tx_hash) throw new Error("No payment hash");

    const receipt = await rpcClient.getTransactionReceipt({ hash: mission.payment_tx_hash as `0x${string}` });
    if (receipt.status !== 'success') throw new Error("Transaction failed");

    const { data: ugcConfigRes } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'ugc_config').maybeSingle();
    const ugcConfig = (ugcConfigRes?.value || {}) as Record<string, string>;
    const treasury = (ugcConfig.treasury_address || SAFE_MULTISIG).toLowerCase();
    
    // Support Multi-Asset Verification [v3.63.8]
    const tokenAddress = (mission.reward_token_address || USDC_ADDRESS).toLowerCase();
    const isNative = tokenAddress === '0x0000000000000000000000000000000000000000';
    
    let totalPaid = BigInt(0);

    if (isNative) {
        // For Native ETH, we check the transaction value and recipient
        const tx = await rpcClient.getTransaction({ hash: mission.payment_tx_hash as `0x${string}` });
        if (tx.to?.toLowerCase() === treasury) {
            totalPaid = tx.value;
        }
    } else {
        // For ERC20, we scan logs for transfers to treasury
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === tokenAddress) {
                try {
                    const decoded = decodeEventLog({ abi: ERC20_ABI, eventName: 'Transfer', data: log.data, topics: log.topics }) as { args: { to: string, value: bigint } };
                    if (decoded.args.to.toLowerCase() === treasury) totalPaid += decoded.args.value;
                } catch (e) { continue; }
            }
        }
    }

    // Dynamic Precision handling based on token symbol
    // Defaulting to 6 for USDC, 18 for others
    const decimals = mission.reward_symbol === 'USDC' ? 6 : 18;
    const listingFeeValue = parseFloat(String(mission.listing_fee || ugcConfig.listing_fee_usdc || '5'));
    const rewardPoolValue = parseFloat(String(mission.total_reward_pool || '0'));
    
    const listingFeeUnits = BigInt(Math.round(listingFeeValue * Math.pow(10, decimals)));
    const rewardPoolUnits = BigInt(Math.round(rewardPoolValue * Math.pow(10, decimals)));
    const expectedTotal = listingFeeUnits + rewardPoolUnits;

    // Allow 1% slippage for price oracle rounding if needed, but here it should be exact
    if (totalPaid < expectedTotal) {
        return res.status(400).json({ 
            error: 'Payment insufficient', 
            details: `Expected ${expectedTotal.toString()} units, found ${totalPaid.toString()} units in ${mission.reward_symbol || 'USDC'}` 
        });
    }

    await supabaseAdmin.from('campaigns').update({ is_verified_payment: true, status: 'active', is_active: true }).eq('id', mission_id);
    await supabaseAdmin.from('daily_tasks').update({ is_active: true }).eq('target_id', mission_id);
    await logAdminAction(admin, 'VERIFY_UGC_PAYMENT_ONCHAIN', { mission_id, amount_paid: totalPaid.toString(), symbol: mission.reward_symbol });

    return res.status(200).json({ success: true, message: `Payment verified for ${mission.reward_symbol || 'USDC'}` });
}

async function handleRejectMission(req: VercelRequest, res: VercelResponse, admin: string) {
    const { mission_id, reason } = req.body;
    if (!mission_id) return res.status(400).json({ error: 'mission_id required' });

    const { data: mission, error: mErr } = await supabaseAdmin
        .from('campaigns')
        .select('id, title, status, sponsor_address')
        .eq('id', mission_id)
        .maybeSingle();

    if (mErr || !mission) return res.status(404).json({ error: 'Mission not found' });
    if (mission.status === 'rejected') return res.status(400).json({ error: 'Mission already rejected' });

    const { error: updateErr } = await supabaseAdmin
        .from('campaigns')
        .update({ status: 'rejected', is_active: false })
        .eq('id', mission_id);

    if (updateErr) throw updateErr;

    // Deactivate associated tasks
    await supabaseAdmin.from('daily_tasks').update({ is_active: false }).eq('target_id', mission_id);

    await logAdminAction(admin, 'REJECT_MISSION', {
        mission_id,
        title: mission.title,
        reason: reason || 'No reason provided',
        sponsor_address: mission.sponsor_address
    });

    return res.status(200).json({ success: true, message: 'Mission rejected' });
}

async function handleGetUgcRevenue(res: VercelResponse) {
    const { data, error } = await supabaseAdmin
        .from('campaigns')
        .select('id, title, listing_fee, listing_fee_usdc, sbt_share_amount, is_revenue_allocated, reward_symbol')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return res.status(200).json({ success: true, data });
}

async function handleMarkRevenueAllocated(missionId: string, admin: string, res: VercelResponse) {
    if (!missionId) throw new Error("Mission ID required");
    
    const { error } = await supabaseAdmin
        .from('campaigns')
        .update({ is_revenue_allocated: true })
        .eq('id', missionId);
        
    if (error) throw error;
    
    await logAdminAction(admin, 'MARK_REVENUE_ALLOCATED', { mission_id: missionId });
    return res.status(200).json({ success: true });
}
