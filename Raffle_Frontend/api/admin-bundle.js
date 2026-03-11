import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Init Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const rawAdmins = [
    '0x08452c1bdaa6acd11f6ccf5268d16e2ac29c204b',
    '0x52260c30697674a7C837FEB2af21bBf3606795C8',
    '0x52260c30697674a7c837feb2af21bbf3606795c8',
    process.env.VITE_ADMIN_ADDRESS,
    process.env.ADMIN_ADDRESS,
    process.env.VITE_ADMIN_WALLETS
].join(',').split(',');

const AUTHORIZED_ADMINS = rawAdmins
    .map(a => a?.trim().toLowerCase())
    .filter(Boolean);

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
        let isAuthorized = AUTHORIZED_ADMINS.includes(targetAddress);
        if (!isAuthorized) {
            const { data: profile } = await supabaseAdmin.from('user_profiles').select('is_admin').eq('wallet_address', targetAddress).single();
            if (profile?.is_admin) isAuthorized = true;
        }
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized: Admin only' });

        // 3. Routing
        switch (action) {
            case 'check': {
                // Lightweight auth check — returns admin status, no signature required for this case
                // (Signature is still validated above if provided; this just returns the result)
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

            case 'economy-stats':
            case 'GET_ECONOMY': {
                const { data: auditLogs } = await supabaseAdmin.from('admin_audit_logs').select('action').in('action', ['SPONSOR_APPROVE', 'DEPLOY_BATCH_TASK']);
                const { data: claims } = await supabaseAdmin.from('user_task_claims').select('xp_earned');
                const totalXp = claims?.reduce((sum, c) => sum + (c.xp_earned || 0), 0) || 0;
                const totalRevenueUSDC = (auditLogs?.length || 0);
                return res.status(200).json({ success: true, metrics: { totalRevenueUSDC: totalRevenueUSDC.toFixed(2), netProfit: (totalRevenueUSDC * 0.7).toFixed(2), communityXp: totalXp } });
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
                }).select().single();
                if (taskError) throw taskError;
                if (req.body.target_agent !== 'qwen') processCloudAgent(task, systemMemory);
                return res.status(200).json({ success: true, task_id: task.id });
            }

            case 'vault-sync': {
                const { file_path, content, category } = payload;
                await supabaseAdmin.from('agent_vault').upsert({ file_path, content, category, updated_at: new Date().toISOString() }, { onConflict: 'file_path' });
                return res.status(200).json({ success: true });
            }

            case 'task-create': {
                const { data, error } = await supabaseAdmin.from('daily_tasks').insert({
                    description: task_data.description || task_data.title,
                    xp_reward: task_data.xp_reward || 0,
                    platform: task_data.platform || 'base',
                    action_type: task_data.action_type || 'transaction',
                    link: task_data.link || 'https://warpcast.com/CryptoDisco',
                    is_active: !!task_data.is_active,
                    created_at: new Date().toISOString()
                }).select().single();
                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }

            case 'task-clear': {
                await supabaseAdmin.from('daily_tasks').delete().not('id', 'is', 'null');
                return res.status(200).json({ success: true });
            }

            case 'UPDATE_POINTS': {
                await supabaseAdmin.from('point_settings').upsert(payload, { onConflict: 'activity_key' });
                return res.status(200).json({ success: true });
            }
            case 'UPDATE_THRESHOLDS': {
                await supabaseAdmin.from('sbt_thresholds').upsert(payload, { onConflict: 'level' });
                return res.status(200).json({ success: true });
            }
            case 'GRANT_ROLE': {
                await supabaseAdmin.from('user_profiles').update({ is_admin: true }).eq('wallet_address', payload.target_address.toLowerCase());
                return res.status(200).json({ success: true });
            }
            case 'REVOKE_ROLE': {
                await supabaseAdmin.from('user_profiles').update({ is_admin: false }).eq('wallet_address', payload.target_address.toLowerCase());
                return res.status(200).json({ success: true });
            }
            case 'SYNC_RAFFLE': {
                await supabaseAdmin.from('raffles').upsert({
                    id: payload.raffle_id,
                    creator_address: payload.creator.toLowerCase(),
                    sponsor_address: payload.creator.toLowerCase(),
                    nft_contract: payload.nft_address?.toLowerCase() || '',
                    token_id: payload.token_id || 0,
                    end_time: payload.end_time,
                    max_tickets: payload.max_tickets || 100,
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });
                return res.status(200).json({ success: true });
            }
            case 'CREATE_CAMPAIGN': {
                const { data } = await supabaseAdmin.from('campaigns').insert([payload]).select();
                return res.status(200).json({ success: true, data });
            }
            case 'UPDATE_CAMPAIGN_STATUS': {
                await supabaseAdmin.from('campaigns').update({ status: payload.status }).eq('id', payload.id);
                return res.status(200).json({ success: true });
            }
            case 'DELETE_CAMPAIGN': {
                await supabaseAdmin.from('campaigns').delete().eq('id', payload.id);
                return res.status(200).json({ success: true });
            }
            case 'RESET_SEASON': {
                await supabaseAdmin.from('user_task_claims').delete().not('id', 'is', 'null');
                await supabaseAdmin.from('user_profiles').update({ xp: 0, total_xp: 0, tier: 1 }).not('wallet_address', 'is', 'null');
                return res.status(200).json({ success: true });
            }
            case 'AUDIT_GOVERNANCE': {
                await supabaseAdmin.from('admin_audit_logs').insert([{ admin_address: targetAddress, action: req.body.governor_action, details: { tx_hash, ...req.body.details } }]);
                return res.status(200).json({ success: true });
            }
            case 'task-sync': { // Legacy batch sync
                for (const task of tasks) {
                    await supabaseAdmin.from('daily_tasks').insert([{
                        description: task.title,
                        xp_reward: task.reward_points,
                        platform: task.platform,
                        action_type: task.action_type,
                        link: task.link,
                        is_active: true
                    }]);
                }
                return res.status(200).json({ success: true });
            }

            case 'GRANT_PRIVILEGE': {
                await supabaseAdmin.from('user_privileges').upsert({ wallet_address: payload.target_address.toLowerCase(), feature_id: payload.feature_id, granted_at: new Date().toISOString() }, { onConflict: 'wallet_address,feature_id' });
                return res.status(200).json({ success: true });
            }
            case 'REVOKE_PRIVILEGE': {
                await supabaseAdmin.from('user_privileges').delete().eq('wallet_address', payload.target_address.toLowerCase()).eq('feature_id', payload.feature_id);
                return res.status(200).json({ success: true });
            }
            case 'ISSUE_ENS': {
                await supabaseAdmin.from('ens_subdomains').insert([{ ...payload, wallet_address: payload.wallet_address.toLowerCase() }]);
                return res.status(200).json({ success: true });
            }
            case 'UPDATE_TIER_CONFIG': {
                await supabaseAdmin.from('system_settings').upsert({ key: 'tier_percentiles', value: payload, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                return res.status(200).json({ success: true });
            }
            case 'MANUAL_TIER_OVERRIDE': {
                await supabaseAdmin.from('user_profiles').update({ tier_override: parseInt(payload.tier) }).eq('wallet_address', payload.target_address.toLowerCase());
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
