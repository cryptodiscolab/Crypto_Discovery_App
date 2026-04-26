import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, verifyMessage, decodeEventLog } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Init Supabase Admin
const supabaseAdmin = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

// 1. DYNAMIC NETWORK SWITCHER (MAINNET SECURE)
const CHAIN_ID = (process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '84532').trim();
const isMainnet = CHAIN_ID === '8453';
const activeChain = isMainnet ? base : baseSepolia;
const activeRpcUrl = isMainnet 
    ? (process.env.VITE_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org').trim()
    : (process.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org').trim();

const rpcClient = createPublicClient({
    chain: activeChain,
    transport: http(activeRpcUrl),
});

const USDC_ADDRESS = isMainnet 
    ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' 
    : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const ERC20_ABI = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' }
        ],
        name: 'Transfer',
        type: 'event'
    }
];

const AUTHORIZED_ADMINS = [
    (process.env.VITE_ADMIN_ADDRESS || '').trim(),
    (process.env.ADMIN_ADDRESS || '').trim(),
    (process.env.VITE_ADMIN_WALLETS || '').trim()
].join(',').toLowerCase().split(',').filter(Boolean);

async function logAdminAction(admin_address, action, details) {
    try {
        await supabaseAdmin.from('admin_audit_logs').insert({
            admin_address: admin_address.toLowerCase(),
            action,
            details: details || {},
            created_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('[logAdminAction Error]', err.message);
    }
}

async function isAuthorizedAdmin(address) {
    let isAuthorized = AUTHORIZED_ADMINS.includes(address.toLowerCase());
    if (!isAuthorized) {
        const { data: profile } = await supabaseAdmin.from('user_profiles').select('is_admin').eq('wallet_address', address.toLowerCase()).maybeSingle();
        if (profile?.is_admin) isAuthorized = true;
    }
    return isAuthorized;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const action = req.body.action || req.query.action || req.body.action_type;

    try {
        const { address, wallet_address, wallet, signature, message, payload, task_data, tasks, tx_hash } = req.body;
        const targetAddress = (address || wallet_address || wallet || '').toLowerCase();

        // 1. Basic Auth for all admin actions
        if (!targetAddress || !signature || !message) {
            return res.status(400).json({ error: 'Missing auth fields' });
        }

        const valid = await verifyMessage({ address: targetAddress, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // 2. Authorization Check
        const isAuthorized = await isAuthorizedAdmin(targetAddress);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized: Admin only' });

        // 3. Routing
        switch (action) {
            case 'check': {
                return res.status(200).json({ isAdmin: true, message: 'Admin access granted' });
            }

            case 'sync-tiers': {
                const { data, error } = await supabaseAdmin.rpc('fn_compute_leaderboard_tiers');
                if (error) throw error;
                const { data: profiles } = await supabaseAdmin.from('user_profiles').select('wallet_address, tier');
                const sbtHolders = new Set((profiles || []).filter(p => (p.tier || 0) > 0).map(p => p.wallet_address.toLowerCase()));
                const filteredData = data.filter(item => sbtHolders.has(item.wallet_address.toLowerCase()));
                supabaseAdmin.rpc('fn_refresh_rank_scores').catch(() => { });
                return res.status(200).json({ success: true, total_calculated: data.length, data: filteredData });
            }

            case 'SYNC_MULTIPLIERS': {
                const { error } = await supabaseAdmin
                    .from('system_settings')
                    .upsert({ 
                        key: 'tier_multipliers', 
                        value: payload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'key' });
                
                if (error) throw error;
                await logAdminAction(targetAddress, 'SYNC_MULTIPLIERS', payload);
                return res.status(200).json({ success: true });
            }

            case 'SYNC_WEIGHTS': {
                const { error } = await supabaseAdmin
                    .from('system_settings')
                    .upsert({ 
                        key: 'tier_pool_weights', 
                        value: payload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'key' });
                
                if (error) throw error;
                await logAdminAction(targetAddress, 'SYNC_WEIGHTS', payload);
                return res.status(200).json({ success: true });
            }

            case 'WHITELIST_TOKEN_DB': {
                const { error } = await supabaseAdmin
                    .from('allowed_tokens')
                    .upsert({
                        ...payload,
                        address: payload.address.toLowerCase(),
                        is_active: true,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'chain_id,address' });

                if (error) throw error;
                await logAdminAction(targetAddress, 'WHITELIST_TOKEN_DB', payload);
                return res.status(200).json({ success: true });
            }

            case 'REMOVE_TOKEN_DB': {
                const { error } = await supabaseAdmin
                    .from('allowed_tokens')
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .match({ 
                        chain_id: payload.chain_id, 
                        address: payload.address.toLowerCase() 
                    });

                if (error) throw error;
                await logAdminAction(targetAddress, 'REMOVE_TOKEN_DB', payload);
                return res.status(200).json({ success: true });
            }

            case 'economy-stats':
            case 'GET_ECONOMY': {
                const [
                    { data: auditLogs },
                    { data: claims },
                    { data: revenueData }
                ] = await Promise.all([
                    supabaseAdmin.from('admin_audit_logs').select('action').in('action', ['SPONSOR_APPROVE', 'DEPLOY_BATCH_TASK']),
                    supabaseAdmin.from('user_task_claims').select('xp_earned'),
                    supabaseAdmin.from('user_activity_logs').select('value_amount').eq('category', 'PURCHASE').eq('value_symbol', 'USDC')
                ]);
                
                const totalXp = claims?.reduce((sum, c) => sum + (c.xp_earned || 0), 0) || 0;
                const totalRevenueUSDC = revenueData?.reduce((sum, r) => sum + (parseFloat(r.value_amount) || 0), 0) || 0;
                const netProfit = (totalRevenueUSDC * 0.8).toFixed(2);
                
                return res.status(200).json({ 
                    success: true, 
                    metrics: { 
                        totalRevenueUSDC: totalRevenueUSDC.toFixed(2), 
                        netProfit, 
                        communityXp: totalXp 
                    } 
                });
            }

            case 'NEXUS_DISPATCH': {
                const systemMemory = await getSystemMemory();
                const { data: task, error: taskError } = await supabaseAdmin.from('agents_vault').insert({
                    task_name: req.body.task_name,
                    task_description: req.body.task_description,
                    target_agent: req.body.target_agent,
                    status: (req.body.target_agent === 'qwen' ? 'pending' : 'processing'),
                    input_data: { ...req.body.input_data, system_memory: systemMemory },
                    requested_by_wallet: targetAddress
                }).select().maybeSingle();
                if (taskError) throw taskError;
                if (req.body.target_agent !== 'qwen') processCloudAgent(task, systemMemory);
                await logAdminAction(targetAddress, 'NEXUS_DISPATCH', { task_id: task.id, ...req.body });
                return res.status(200).json({ success: true, task_id: task.id });
            }

            case 'vault-sync': {
                const { file_path, content, category } = payload;
                await supabaseAdmin.from('agent_vault').upsert({ file_path, content, category, updated_at: new Date().toISOString() }, { onConflict: 'file_path' });
                await logAdminAction(targetAddress, 'VAULT_SYNC', { file_path, category });
                return res.status(200).json({ success: true });
            }

            case 'task-create': {
                const { data, error } = await supabaseAdmin.from('daily_tasks').insert({
                    title: task_data.title || task_data.description,
                    description: task_data.description || task_data.title,
                    xp_reward: task_data.xp_reward || 0,
                    platform: task_data.platform || 'base',
                    action_type: task_data.action_type || 'transaction',
                    link: task_data.link || 'https://warpcast.com/CryptoDisco',
                    target_id: task_data.target_id || null,
                    is_active: !!task_data.is_active,
                    is_base_social_required: !!task_data.is_base_social_required,
                    min_neynar_score: task_data.min_neynar_score || 0,
                    expires_at: task_data.expires_at || null,
                    task_type: 'daily',
                    created_at: new Date().toISOString()
                }).select().maybeSingle();
                if (error) throw error;
                await logAdminAction(targetAddress, 'TASK_CREATE', data);
                return res.status(200).json({ success: true, data });
            }

            case 'task-clear': {
                await supabaseAdmin.from('daily_tasks').delete().not('id', 'is', 'null');
                await logAdminAction(targetAddress, 'TASK_CLEAR', {});
                return res.status(200).json({ success: true });
            }

            case 'UPDATE_POINTS': {
                await supabaseAdmin.from('point_settings').upsert(payload, { onConflict: 'activity_key' });
                await logAdminAction(targetAddress, 'UPDATE_POINTS', payload);
                return res.status(200).json({ success: true });
            }
            case 'UPDATE_THRESHOLDS': {
                await supabaseAdmin.from('sbt_thresholds').upsert(payload, { onConflict: 'level' });
                await logAdminAction(targetAddress, 'UPDATE_THRESHOLDS', payload);
                return res.status(200).json({ success: true });
            }
            case 'GRANT_ROLE': {
                await supabaseAdmin.from('user_profiles').update({ is_admin: true }).eq('wallet_address', payload.target_address.toLowerCase());
                await logAdminAction(targetAddress, 'GRANT_ROLE', payload);
                return res.status(200).json({ success: true });
            }
            case 'REVOKE_ROLE': {
                await supabaseAdmin.from('user_profiles').update({ is_admin: false }).eq('wallet_address', payload.target_address.toLowerCase());
                await logAdminAction(targetAddress, 'REVOKE_ROLE', payload);
                return res.status(200).json({ success: true });
            }
            case 'SYNC_RAFFLE': {
                const raffleData = {
                    id: payload.raffle_id,
                    creator_address: payload.creator.toLowerCase(),
                    sponsor_address: payload.creator.toLowerCase(),
                    nft_contract: payload.nft_address?.toLowerCase() || '',
                    token_id: payload.token_id || 0,
                    end_time: payload.end_time,
                    max_tickets: payload.max_tickets || 100,
                    is_active: true,
                    updated_at: new Date().toISOString()
                };
                await supabaseAdmin.from('raffles').upsert(raffleData, { onConflict: 'id' });
                await logAdminAction(targetAddress, 'SYNC_RAFFLE', raffleData);
                return res.status(200).json({ success: true });
            }
            case 'CREATE_CAMPAIGN': {
                const { data } = await supabaseAdmin.from('campaigns').insert([payload]).select();
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
            case 'RESET_SEASON': {
                await supabaseAdmin.from('user_task_claims').delete().not('id', 'is', 'null');
                const ROOKIE_TIER = 0;
                await supabaseAdmin.from('user_profiles').update({ xp: 0, total_xp: 0, tier: ROOKIE_TIER }).not('wallet_address', 'is', 'null');
                await logAdminAction(targetAddress, 'RESET_SEASON', { season_id: payload.new_season_id });
                return res.status(200).json({ success: true });
            }
            case 'AUDIT_GOVERNANCE': {
                await supabaseAdmin.from('admin_audit_logs').insert([{ admin_address: targetAddress, action: req.body.governor_action, details: { tx_hash, ...req.body.details } }]);
                return res.status(200).json({ success: true });
            }
            case 'task-sync': {
                for (const task of tasks) {
                    await supabaseAdmin.from('daily_tasks').insert([{
                        title: task.title,
                        description: task.title,
                        xp_reward: task.reward_points,
                        platform: task.platform,
                        action_type: task.action_type,
                        link: task.link,
                        target_id: task.target_id || null,
                        is_base_social_required: !!task.is_base_social_required,
                        min_neynar_score: task.min_neynar_score || 0,
                        expires_at: task.expires_at || null,
                        task_type: 'daily',
                        created_at: new Date().toISOString(),
                        is_active: true
                    }]);
                }
                return res.status(200).json({ success: true });
            }

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
            case 'UPDATE_TIER_CONFIG': {
                await supabaseAdmin.from('system_settings').upsert({ key: 'tier_config', value: payload, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                await logAdminAction(targetAddress, 'UPDATE_TIER_CONFIG', payload);
                return res.status(200).json({ success: true });
            }
            case 'MANUAL_TIER_OVERRIDE': {
                await supabaseAdmin.from('user_profiles').update({ tier_override: parseInt(payload.tier) }).eq('wallet_address', payload.target_address.toLowerCase());
                await logAdminAction(targetAddress, 'MANUAL_TIER_OVERRIDE', payload);
                return res.status(200).json({ success: true });
            }
            case 'UPDATE_FEATURE_FLAGS': {
                await supabaseAdmin.from('system_settings').upsert({ key: 'active_features', value: payload, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                await logAdminAction(targetAddress, 'UPDATE_FEATURE_FLAGS', payload);
                return res.status(200).json({ success: true });
            }
            case 'UPDATE_UGC_CONFIG': {
                await supabaseAdmin.from('system_settings').upsert({ key: 'ugc_config', value: payload, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                await logAdminAction(targetAddress, 'UPDATE_UGC_CONFIG', payload);
                return res.status(200).json({ success: true });
            }
            case 'CREATE_UGC_MISSION': {
                const missionData = {
                    ...payload,
                    is_active: false,
                    is_verified_payment: false,
                    created_at: new Date().toISOString()
                };
                try {
                    // 1. Create Campaign
                    const { data: campaign, error: cErr } = await supabaseAdmin
                        .from('campaigns')
                        .insert([missionData])
                        .select()
                        .maybeSingle();
                    
                    if (cErr) throw cErr;

                    // 2. Create matching Daily Task (Inactive until verified)
                    const { error: tErr } = await supabaseAdmin
                        .from('daily_tasks')
                        .insert([{
                            description: missionData.title,
                            xp_reward: 0, // UGC tasks use dynamic point_settings 'ugc_task_completion'
                            platform: missionData.platform_code || 'farcaster',
                            action_type: payload.action_type || 'follow',
                            link: missionData.link,
                            is_active: false,
                            task_type: 'ugc',
                            onchain_id: campaign.id,
                            creator_address: missionData.sponsor_address
                        }]);

                    if (tErr) throw tErr;

                    await logAdminAction(targetAddress, 'CREATE_UGC_MISSION', { campaign_id: campaign.id, ...missionData });
                    return res.status(200).json({ success: true, data: campaign });
                } catch (e) {
                    return res.status(500).json({ error: e.message });
                }
            }
            case 'VERIFY_UGC_PAYMENT_ONCHAIN':
                await handleVerifyUgcPaymentOnchain(req, res);
                break;
            case 'MARK_REVENUE_ALLOCATED': {
                const { mission_id } = payload;
                await supabaseAdmin.from('campaigns').update({ is_revenue_allocated: true }).eq('id', mission_id);
                await logAdminAction(targetAddress, 'MARK_REVENUE_ALLOCATED', payload);
                return res.status(200).json({ success: true });
            }
            case 'GET_UGC_REVENUE': {
                const { data, error } = await supabaseAdmin
                    .from('campaigns')
                    .select('id, title, listing_fee_usdc, sbt_share_amount, is_revenue_allocated, created_at')
                    .filter('is_verified_payment', 'eq', true)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }
            case 'VERIFY_UGC_PAYMENT': {
                await supabaseAdmin.from('campaigns').update({ 
                    is_verified_payment: true,
                    payment_tx_hash: payload.tx_hash
                }).eq('id', payload.campaign_id);
                
                await logAdminAction(targetAddress, 'VERIFY_UGC_PAYMENT', payload);
                return res.status(200).json({ success: true });
            }
            default:
                return res.status(400).json({ error: 'Invalid admin action: ' + action });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function getSystemMemory() {
    try {
        const rootPath = process.cwd();
        const cursorrulesPath = path.join(rootPath, '.cursorrules');
        const skillPath = path.join(rootPath, '.agents', 'skills', 'ecosystem-sentinel', 'SKILL.md');
        let memory = "";
        if (fs.existsSync(cursorrulesPath)) memory += fs.readFileSync(cursorrulesPath, 'utf8');
        if (fs.existsSync(skillPath)) memory += fs.readFileSync(skillPath, 'utf8');
        return memory;
    } catch (e) { return ""; }
}

async function processCloudAgent(task, systemMemory) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return;
    try {
        const prompt = `${systemMemory}\n\nTask: ${task.task_name}\nDesc: ${task.task_description}`;
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        const output = response.data.candidates[0].content.parts[0].text;
        await supabaseAdmin.from('agents_vault').update({ status: 'completed', output_data: output }).eq('id', task.id);
    } catch (e) {
        await supabaseAdmin.from('agents_vault').update({ status: 'failed', output_data: { error: e.message } }).eq('id', task.id);
    }
}

async function handleVerifyUgcPaymentOnchain(req, res) {
    const { wallet_address, signature, message, mission_id } = req.body;
    
    // Auth Check
    const isAuth = await isAuthorizedAdmin(wallet_address);
    if (!isAuth) return res.status(403).json({ error: 'Unauthorized: Admin only' });

    const valid = await verifyMessage({ address: wallet_address, message, signature });
    if (!valid) return res.status(401).json({ error: 'Invalid signature' });

    try {
        // 1. Fetch Mission from DB
        const { data: mission, error: mErr } = await supabaseAdmin
            .from('campaigns')
            .select('*')
            .eq('id', mission_id)
            .maybeSingle();
        
        if (mErr || !mission) throw new Error("Mission not found");
        if (!mission.payment_tx_hash) throw new Error("No transaction hash associated with this mission");

        // 2. Fetch Transaction Receipt
        const receipt = await rpcClient.getTransactionReceipt({ hash: mission.payment_tx_hash });
        if (receipt.status !== 'success') throw new Error("Transaction failed on-chain");

        // 3. Verify Transfer Events
        const { data: ugcConfigRes } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'ugc_config')
            .maybeSingle();
        
        const ugcConfig = ugcConfigRes?.value || {};
        const treasury = ugcConfig.treasury_address || process.env.VITE_SAFE_MULTISIG || "";
        if (!treasury) throw new Error("Treasury address not configured");

        let totalUsdcTransferred = BigInt(0);
        
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
                try {
                    const decoded = decodeEventLog({
                        abi: ERC20_ABI,
                        eventName: 'Transfer',
                        data: log.data,
                        topics: log.topics,
                    });
                    
                    if (decoded.args.to.toLowerCase() === treasury.toLowerCase()) {
                        totalUsdcTransferred += decoded.args.value;
                    }
                } catch (e) {
                    continue; 
                }
            }
        }

        // 4. Validate Amount
        const rewardPerUserRaw = BigInt(Math.floor(parseFloat(mission.reward_amount_per_user || 0) * 1e6));
        const totalRewardPoolRaw = rewardPerUserRaw * BigInt(mission.max_participants || 0);
        const listingFeeRaw = BigInt(Math.floor(parseFloat(ugcConfig.listing_fee_usdc || 0) * 1e6));
        const expectedTotalRaw = totalRewardPoolRaw + listingFeeRaw;

        if (totalUsdcTransferred < expectedTotalRaw) {
            return res.status(400).json({ 
                error: `Payment insufficient. Expected ${Number(expectedTotalRaw)/1e6} USDC, found ${Number(totalUsdcTransferred)/1e6} USDC.`,
                found: Number(totalUsdcTransferred)/1e6,
                expected: Number(expectedTotalRaw)/1e6
            });
        }

        // 5. Success
        // Calculate shares for storage
        const sbtSharePct = parseFloat(ugcConfig.sbt_pool_share_pct || 10);
        const listingFeeDecimal = parseFloat(ugcConfig.listing_fee_usdc || 0);
        const sbtShareAmount = (listingFeeDecimal * sbtSharePct) / 100;

        await supabaseAdmin.from('campaigns').update({ 
            is_verified_payment: true, 
            status: 'active',
            is_active: true,
            listing_fee_usdc: listingFeeDecimal,
            sbt_share_amount: sbtShareAmount,
            is_revenue_allocated: false
        }).eq('id', mission_id);
        
        await supabaseAdmin.from('daily_tasks').update({ is_active: true }).eq('onchain_id', mission_id);

        return res.status(200).json({ 
            success: true, 
            message: "Payment verified & mission activated",
            tx: mission.payment_tx_hash,
            amount_verified: Number(totalUsdcTransferred)/1e6
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
