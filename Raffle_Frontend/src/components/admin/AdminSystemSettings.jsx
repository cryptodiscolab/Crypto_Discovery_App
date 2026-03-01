import React, { useState, useEffect } from 'react';
import { isAddress } from 'viem';
import { cleanWallet } from '../../utils/cleanWallet';
import { useAccount, useSignMessage, useReadContract, useWriteContract } from 'wagmi';
import { supabase } from '../../lib/supabaseClient';
import { CONTRACTS, DAILY_APP_ABI } from '../../lib/contracts';
import {
    Settings,
    TrendingUp,
    Save,
    RefreshCw,
    ShieldCheck,
    Info,
    UserCheck,
    Globe,
    CheckCircle,
    Plus,
    Trash2,
    History,
    Users,
    Sliders,
    Search,
    BarChart,
    Cpu,
    BarChart3,
    Award,
    Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSBT } from '../../hooks/useSBT';

/**
 * Admin System Settings Component
 * Migrated from AdminPanel.jsx
 * Features: Dynamic Point Table, Dynamic SBT Levels, ENS Management, Audit Logging.
 */
export default function AdminSystemSettings() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { syncTiersToContract } = useSBT();
    const [pointSettings, setPointSettings] = useState([]);
    const [sbtThresholds, setSbtThresholds] = useState([]);
    const [eligibleUsers, setEligibleUsers] = useState([]);
    const [issuedSubnames, setIssuedSubnames] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'blockchain' | 'sponsorship' | 'ens' | 'logs'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New Advanced Tier States
    const [tierConfig, setTierConfig] = useState({ diamond: 0.01, gold: 0.10, silver: 0.30, bronze: 0.70 });
    const [tierDistribution, setTierDistribution] = useState([]);
    const [targetWallet, setTargetWallet] = useState('');
    const [overrideTier, setOverrideTier] = useState(0); // 0: None, 1: Bronze, 2: Silver, 3: Gold, 4: Diamond

    useEffect(() => {
        fetchPointSettings();
        fetchTierConfig();
        fetchTierDistribution();
    }, []);

    const fetchTierDistribution = async () => {
        try {
            const { data, error } = await supabase.rpc('fn_get_tier_distribution');
            if (!error && data) {
                setTierDistribution(data);
            }
        } catch (error) {
            console.error('Fetch Distribution Error:', error);
        }
    };

    const fetchTierConfig = async () => {
        try {
            const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'tier_percentiles').single();
            if (!error && data) {
                setTierConfig(data.value);
            }
        } catch (error) {
            console.error('Fetch Tier Config Error:', error);
        }
    };

    const fetchPointSettings = async () => {
        setLoading(true);
        try {
            const [pointsRes, thresholdsRes, issuedRes, usersRes, logsRes] = await Promise.all([
                supabase.from('point_settings').select('*').order('activity_key'),
                supabase.from('sbt_thresholds').select('*').order('level'),
                supabase.from('ens_subdomains').select('*').order('created_at', { ascending: false }),
                supabase.from('user_stats').select('*').gte('total_xp', 100).order('total_xp', { ascending: false }),
                supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(20)
            ]);

            if (pointsRes.error) throw pointsRes.error;
            if (thresholdsRes.error) throw thresholdsRes.error;

            setPointSettings(pointsRes.data);
            setSbtThresholds(thresholdsRes.data);
            if (!issuedRes.error) setIssuedSubnames(issuedRes.data);
            if (!usersRes.error) {
                const issuedWallets = new Set((issuedRes.data || []).map(s => cleanWallet(s.wallet_address)));
                setEligibleUsers(usersRes.data.filter(u => u.wallet_address && !issuedWallets.has(cleanWallet(u.wallet_address))));
            }
            if (!logsRes.error) setAuditLogs(logsRes.data);

        } catch (error) {
            console.error('Fetch Error:', error);
            toast.error("Failed to sync DB data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // logAdminAction is now handled by the Backend API to ensure audit integrity

    const handlePointChange = (id, field, newValue) => {
        setPointSettings(prev =>
            prev.map(item => item.id === id ? {
                ...item,
                [field]: field === 'points_value' ? parseInt(newValue) || 0 : newValue
            } : item)
        );
    };

    const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const addPointActivity = () => {
        const newActivity = {
            id: generateId(),
            activity_key: 'new_activity',
            points_value: 10,
            platform: 'farcaster',
            action_type: 'Follow',
            is_active: true
        };
        setPointSettings([...pointSettings, newActivity]);
        toast.success(`New activity row added locally.`);
    };

    const removePointActivity = (id) => {
        setPointSettings(prev => prev.filter(item => item.id !== id));
    };

    const savePoints = async () => {
        setSaving(true);
        const tid = toast.loading('Requesting signature for Point Sync...');
        try {
            const cleanData = pointSettings
                .filter(item => item.activity_key && item.activity_key.trim() !== '')
                .map(item => {
                    return {
                        activity_key: item.activity_key.toLowerCase().trim().replace(/\s+/g, '_'),
                        points_value: parseInt(item.points_value) || 0,
                        platform: item.platform || 'farcaster',
                        action_type: item.action_type || 'Follow',
                        is_active: item.is_active === null ? true : item.is_active,
                        is_hidden: item.is_hidden || false,
                        updated_at: new Date().toISOString()
                    };
                });

            if (cleanData.length === 0) {
                throw new Error("No valid data to save.");
            }

            const keys = cleanData.map(s => s.activity_key);
            if (new Set(keys).size !== keys.length) {
                throw new Error("Activity Key must be unique.");
            }

            // 1. Prepare and Sign Message
            const timestamp = new Date().toISOString();
            const message = `Update Point Settings\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}\nItems: ${cleanData.length}`;
            const signature = await signMessageAsync({ message });

            // 2. Send to Secure API
            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'UPDATE_POINTS',
                    payload: cleanData
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to update points");

            toast.success('SYNC SUCCESSFUL: Point Settings updated via API!', { id: tid });
            await fetchPointSettings();
        } catch (error) {
            toast.error('Failed to save points: ' + error.message, { id: tid });
        } finally {
            setSaving(false);
        }
    };

    const handleThresholdChange = (id, field, newValue) => {
        setSbtThresholds(prev =>
            prev.map(item => item.id === id ? {
                ...item,
                [field]: (field === 'min_xp' || field === 'level') ? parseInt(newValue) || 0 : newValue
            } : item)
        );
    };

    const addSbtLevel = () => {
        const nextLevel = sbtThresholds.length > 0 ? Math.max(...sbtThresholds.map(l => l.level)) + 1 : 1;
        const nextXp = sbtThresholds.length > 0 ? Math.max(...sbtThresholds.map(l => l.min_xp)) + 50 : 0;

        const newLevel = {
            id: generateId(),
            level: nextLevel,
            min_xp: nextXp,
            tier_name: 'New Tier Name',
            badge_url: ''
        };
        setSbtThresholds([...sbtThresholds, newLevel]);
        toast.success(`Level ${nextLevel} row added locally.`);
    };

    const removeSbtLevel = (id) => {
        setSbtThresholds(prev => prev.filter(item => item.id !== id));
    };

    const saveThresholds = async () => {
        setSaving(true);
        const tid = toast.loading('Requesting signature for SBT Sync...');
        try {
            const levels = sbtThresholds.map(s => s.level);
            if (new Set(levels).size !== levels.length) {
                throw new Error("Level ID (Lvl) must be unique.");
            }

            const dataToSave = sbtThresholds.map(({ id, ...rest }) => rest);

            // 1. Prepare and Sign Message
            const timestamp = new Date().toISOString();
            const message = `Update SBT Thresholds\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}\nLevels: ${dataToSave.length}`;
            const signature = await signMessageAsync({ message });

            // 2. Send to Secure API
            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'UPDATE_THRESHOLDS',
                    payload: dataToSave
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to update thresholds");

            toast.success('SYNC SUCCESSFUL: SBT Thresholds updated via API!', { id: tid });
            fetchPointSettings();
        } catch (error) {
            toast.error('Failed to save level: ' + error.message, { id: tid });
        } finally {
            setSaving(false);
        }
    };

    const handleSyncTiers = async () => {
        if (!window.confirm('PUSH LEADERBOARD TO BLOCKCHAIN?\n\nThis will recalculate all user tiers in the DB based on XP rank (Top 10% Gold, etc) and update the CryptoDiscoMasterX contract on-chain.')) return;

        setSaving(true);
        try {
            // First save the current percentile config to be sure
            await saveTierConfig(true);
            await syncTiersToContract(signMessageAsync);
            fetchTierDistribution();
        } catch (error) {
            console.error('Sync error:', error);
        } finally {
            setSaving(false);
        }
    };

    const saveTierConfig = async (silent = false) => {
        if (!silent) setSaving(true);
        const tid = !silent ? toast.loading('Saving tier configuration...') : null;
        try {
            const timestamp = new Date().toISOString();
            const message = `Update Tier Percentiles\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'UPDATE_TIER_CONFIG',
                    payload: tierConfig
                })
            });

            if (!response.ok) throw new Error('Failed to save tier config');
            if (!silent) toast.success('Tier configuration saved!', { id: tid });
        } catch (error) {
            if (!silent) toast.error('Failed to save tier config: ' + error.message, { id: tid });
            throw error;
        } finally {
            if (!silent) setSaving(false);
        }
    };

    const handleManualOverride = async () => {
        if (!isAddress(targetWallet)) {
            toast.error('Invalid wallet address');
            return;
        }
        setSaving(true);
        const tid = toast.loading('Applying manual tier override...');
        try {
            const timestamp = new Date().toISOString();
            const message = `Manual Tier Override\nTarget: ${targetWallet.toLowerCase()}\nTier: ${overrideTier}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'MANUAL_TIER_OVERRIDE',
                    payload: { target_address: targetWallet, tier: overrideTier }
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to apply override");

            toast.success('Manual override applied and logged!', { id: tid });
            setTargetWallet('');
            fetchTierDistribution();
        } catch (error) {
            toast.error('Override failed: ' + error.message, { id: tid });
        } finally {
            setSaving(false);
        }
    };

    const issueSubname = async (user, label) => {
        if (!label || label.length < 3) {
            toast.error('Label must be at least 3 characters');
            return;
        }
        setSaving(true);
        const tid = toast.loading('Requesting signature for ENS Issue...');
        const fullName = `${label.toLowerCase()}.cryptodiscovery.eth`;
        try {
            const payload = {
                fid: user.fid,
                wallet_address: user.wallet_address,
                label: label.toLowerCase(),
                full_name: fullName
            };

            // 1. Prepare and Sign Message
            const timestamp = new Date().toISOString();
            const message = `Issue ENS Subname\nTarget: ${fullName}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            // 2. Send to Secure API
            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'ISSUE_ENS',
                    payload: payload
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to issue subname");

            toast.success(`Subname ${fullName} successfully issued via API!`, { id: tid });
            fetchPointSettings();
        } catch (error) {
            toast.error('Failed to issue subname: ' + error.message, { id: tid });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-slate-400 font-mono animate-pulse">Loading System Data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Header Section */}
            <div className="flex flex-col gap-6 border-b border-white/10 pb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                            <ShieldCheck className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tight">System <span className="text-indigo-500">Settings</span></h1>
                            <p className="text-slate-400 text-xs font-mono">Dynamic Point Control & Audit Logging Enabled</p>
                        </div>
                    </div>
                    <button onClick={fetchPointSettings} className="p-2 hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-white">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 p-1 bg-black/30 rounded-xl w-fit border border-white/5">
                    {[
                        { id: 'settings', label: 'Points & Logic', icon: Settings },
                        { id: 'blockchain', label: 'Blockchain Config', icon: Award },
                        { id: 'sponsorship', label: 'Sponsorship Config', icon: Plus },
                        { id: 'ens', label: 'ENS Management', icon: Globe },
                        { id: 'logs', label: 'Audit Logs', icon: History }
                    ].map(tab => {
                        const IconComponent = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === tab.id ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <IconComponent className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeTab === 'settings' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* SECTION 1: POINT SETTINGS */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Settings className="w-5 h-5 text-blue-400" />
                                <h2 className="text-lg font-bold text-white">Advanced Points</h2>
                            </div>
                            <button onClick={addPointActivity} className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition-all">
                                <Plus className="w-3.5 h-3.5" /> Add Point Activity
                            </button>
                        </div>
                        <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold sticky top-0 backdrop-blur-sm z-10">
                                        <tr>
                                            <th className="px-4 py-3">Platform / Action</th>
                                            <th className="px-4 py-3">XP</th>
                                            <th className="px-4 py-3 text-center">Active</th>
                                            <th className="px-4 py-3 text-center">Hide</th>
                                            <th className="px-4 py-3 text-right">Del</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {pointSettings.map((item) => (
                                            <tr key={item.id} className={`hover:bg-white/[0.02] transition-all ${item.is_hidden ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex gap-2">
                                                            <select
                                                                value={item.platform}
                                                                onChange={(e) => handlePointChange(item.id, 'platform', e.target.value)}
                                                                className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-white font-black text-[10px] cursor-pointer outline-none focus:border-blue-500"
                                                            >
                                                                <option value="farcaster">Farcaster</option>
                                                                <option value="x">X (Twitter)</option>
                                                                <option value="base">Base</option>
                                                                <option value="instagram">Instagram</option>
                                                                <option value="tiktok">TikTok</option>
                                                                <option value="system">System (Internal)</option>
                                                            </select>
                                                            <select
                                                                value={item.action_type || 'Follow'}
                                                                onChange={(e) => handlePointChange(item.id, 'action_type', e.target.value)}
                                                                className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-indigo-300 font-bold text-[10px] cursor-pointer outline-none focus:border-blue-500"
                                                            >
                                                                <option value="Follow">Follow</option>
                                                                <option value="Like">Like</option>
                                                                <option value="Comment">Comment</option>
                                                                <option value="Recast/Repost">Recast</option>
                                                                <option value="Quote">Quote</option>
                                                                <option value="Daily">Daily</option>
                                                                <option value="Buy">Buy</option>
                                                                <option value="Claim">Claim</option>
                                                                <option value="Invite">Invite</option>
                                                            </select>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={item.activity_key}
                                                            onChange={(e) => handlePointChange(item.id, 'activity_key', e.target.value)}
                                                            className="bg-black/30 border border-white/5 rounded-lg px-2 py-1 text-[10px] text-slate-400 font-mono outline-none"
                                                            placeholder="activity_key (internal)"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        value={item.points_value}
                                                        onChange={(e) => handlePointChange(item.id, 'points_value', e.target.value)}
                                                        className="w-16 bg-slate-800/60 border border-white/10 rounded-lg px-2 py-1 text-white focus:border-blue-500 font-mono text-xs"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.is_active}
                                                        onChange={(e) => handlePointChange(item.id, 'is_active', e.target.checked)}
                                                        className="w-4 h-4 accent-emerald-500 bg-black rounded cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.is_hidden}
                                                        onChange={(e) => handlePointChange(item.id, 'is_hidden', e.target.checked)}
                                                        className="w-4 h-4 accent-red-500 bg-black rounded cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <button onClick={() => removePointActivity(item.id)} className="text-red-500/30 hover:text-red-500 p-1.5 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <button onClick={savePoints} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-black text-white transition-all shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50">
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Sync Point Settings'}
                        </button>
                    </div>

                    {/* SECTION 2: SBT THRESHOLDS (Dynamic Rows) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                                <h2 className="text-lg font-bold text-white">Dynamic SBT Levels</h2>
                            </div>
                            <button onClick={addSbtLevel} className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all">
                                <Plus className="w-3.5 h-3.5" /> Add Level
                            </button>
                        </div>
                        <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold sticky top-0 backdrop-blur-sm z-10">
                                        <tr>
                                            <th className="px-4 py-3">Lvl</th>
                                            <th className="px-4 py-3">Min XP</th>
                                            <th className="px-4 py-3">Tier Name</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {sbtThresholds.map((item) => (
                                            <tr key={item.id} className="hover:bg-white/[0.02] transition-all">
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        value={item.level}
                                                        onChange={(e) => handleThresholdChange(item.id, 'level', e.target.value)}
                                                        className="w-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-emerald-400 font-black text-xs"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        value={item.min_xp}
                                                        onChange={(e) => handleThresholdChange(item.id, 'min_xp', e.target.value)}
                                                        className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white font-mono text-xs"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="text"
                                                        value={item.tier_name}
                                                        onChange={(e) => handleThresholdChange(item.id, 'tier_name', e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-slate-200 text-xs"
                                                        placeholder="Tier Name"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <button onClick={() => removeSbtLevel(item.id)} className="text-red-500/50 hover:text-red-500 p-1.5 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <button onClick={saveThresholds} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-white transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50">
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Sync SBT Thresholds (Off-chain)'}
                        </button>
                    </div>

                    {/* SECTION 3: ADVANCED TIER CONFIG & OVERRIDE */}
                    <div className="space-y-8">
                        {/* Leaderboard Distribution Stats */}
                        <div className="bg-slate-900/40 p-5 rounded-3xl border border-white/5 backdrop-blur-md transition-all hover:border-white/10 group">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Live Distribution</h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { key: 'DIAMOND', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                                    { key: 'GOLD', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                                    { key: 'SILVER', color: 'text-slate-300', bg: 'bg-slate-400/10' },
                                    { key: 'BRONZE', color: 'text-amber-700', bg: 'bg-amber-800/10' }
                                ].map(t => {
                                    const dist = tierDistribution.find(d => d.tier_label === t.key);
                                    return (
                                        <div key={t.key} className={`${t.bg} p-3 rounded-2xl border border-white/5 flex flex-col items-center sm:items-start`}>
                                            <p className={`text-[9px] font-black tracking-widest ${t.color}`}>{t.key}</p>
                                            <p className="text-xl font-black text-white leading-none mt-1">{dist?.user_count || 0}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Leaderboard Tier Distribution */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Sliders className="w-5 h-5 text-amber-500" />
                                <h2 className="text-lg font-bold text-white">Leaderboard Tier Config</h2>
                            </div>
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 space-y-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Diamond (Top %)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={tierConfig.diamond * 100}
                                            onChange={(e) => setTierConfig({ ...tierConfig, diamond: parseFloat(e.target.value) / 100 })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-cyan-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Gold (Top %)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={tierConfig.gold * 100}
                                            onChange={(e) => setTierConfig({ ...tierConfig, gold: parseFloat(e.target.value) / 100 })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Silver (Top %)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={tierConfig.silver * 100}
                                            onChange={(e) => setTierConfig({ ...tierConfig, silver: parseFloat(e.target.value) / 100 })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-slate-400 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Bronze (Top %)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={tierConfig.bronze * 100}
                                            onChange={(e) => setTierConfig({ ...tierConfig, bronze: parseFloat(e.target.value) / 100 })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-amber-700 outline-none"
                                        />
                                    </div>
                                </div>
                                <button onClick={() => saveTierConfig()} disabled={saving} className="w-full bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white py-2 rounded-xl text-xs font-black transition-all border border-amber-500/30">
                                    Save Tier Percentiles
                                </button>
                            </div>
                        </div>

                        {/* Manual Tier Override */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="w-5 h-5 text-indigo-400" />
                                <h2 className="text-lg font-bold text-white">Manual Tier Override</h2>
                            </div>
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 space-y-4">
                                <div className="flex flex-col gap-3">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            type="text"
                                            placeholder="User Wallet Address (0x...)"
                                            value={targetWallet}
                                            onChange={(e) => setTargetWallet(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:border-indigo-500 outline-none font-mono"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 0, label: 'NONE' },
                                            { id: 1, label: 'BRONZE' },
                                            { id: 2, label: 'SILVER' },
                                            { id: 3, label: 'GOLD' },
                                            { id: 4, label: 'DIAMOND' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setOverrideTier(t.id)}
                                                className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all border ${overrideTier === t.id ? 'bg-indigo-500 text-white border-white/20' : 'bg-black/40 text-slate-500 border-white/5 hover:border-white/20'}`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={handleManualOverride}
                                    disabled={saving || !targetWallet}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-xs font-black text-white transition-all disabled:opacity-50"
                                >
                                    Apply Manual Override
                                </button>
                                <p className="text-[9px] text-slate-500 font-mono uppercase text-center leading-tight">
                                    Override will bypass leaderboard rank calculation.<br />
                                    Sync to blockchain is required to apply on-chain.
                                </p>
                            </div>
                        </div>

                        {/* Push to Blockchain */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Award className="w-5 h-5 text-orange-400" />
                                <h2 className="text-lg font-bold text-white">Contract Sync</h2>
                            </div>
                            <button
                                onClick={handleSyncTiers}
                                disabled={saving}
                                className="w-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 p-6 rounded-3xl font-black text-white transition-all shadow-2xl hover:shadow-orange-500/40 active:scale-[0.97] border border-white/30 disabled:opacity-50"
                            >
                                <div className="flex items-center gap-3">
                                    <Award className="w-7 h-7" />
                                    <span className="text-lg tracking-tight">PUSH LEADERBOARD TO CHAIN</span>
                                </div>
                                <span className="text-[10px] opacity-70 font-mono tracking-widest">BATCH UPDATE CONTRACT TIERS</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ens' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><UserCheck className="w-5 h-5 text-indigo-400" /> Eligible Candidates</h2>
                        <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-4 max-h-[500px] overflow-y-auto space-y-3 custom-scrollbar">
                            {eligibleUsers.map((user) => (
                                <div key={user.fid} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex flex-col gap-3 group hover:border-indigo-500/30 transition-all">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono text-indigo-400 py-1 px-2 bg-indigo-500/10 rounded-lg">FID: {user.fid}</span>
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-black uppercase tracking-tighter">XP: {user.total_xp?.toString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input id={`label-${user.fid}`} type="text" placeholder="label" className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none font-bold" />
                                        <span className="text-slate-500 text-xs font-black">.cryptodiscovery.eth</span>
                                    </div>
                                    <button onClick={() => issueSubname(user, document.getElementById(`label-${user.fid}`).value)} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> Issue Subname Identity
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-400" /> Issued Identities</h2>
                        <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold sticky top-0 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-4 py-3">Full Name</th>
                                        <th className="px-6 py-3">Wallet</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {issuedSubnames.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-white">{item.full_name}</p>
                                                <p className="text-[10px] text-slate-500">FID {item.fid}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <a href={`https://basescan.org/address/${item.wallet_address}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline font-mono">
                                                    {item.wallet_address?.slice(0, 8)}...{item.wallet_address?.slice(-6)}
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'logs' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-yellow-500" /> Admin Audit Logs</h2>
                    <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                <tr>
                                    <th className="px-4 py-3">Admin</th>
                                    <th className="px-4 py-3">Action</th>
                                    <th className="px-4 py-3">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {auditLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-4 font-mono text-slate-400">{log.admin_address?.slice(0, 10)}...</td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${log.action.includes('ENS') ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                {log.action?.toString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'blockchain' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
                    <BlockchainConfigSection />
                </div>
            )}

            {activeTab === 'sponsorship' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
                    <SponsorshipConfigSection />
                </div>
            )}

            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-wide font-black">
                    Security Policy: double check verification active. All changes are logged to <code className="text-white">admin_audit_logs</code>.
                    Ens identity sync is off-chain via ccip-read.
                </p>
            </div>
        </div>
    );
}

function BlockchainConfigSection() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [isSaving, setIsSaving] = useState(false);

    // Form States for various configs
    const [rewards, setRewards] = useState({ daily: '100', referral: '50' });
    const [raffleFees, setRaffleFees] = useState({ rake: '2000', surcharge: '500' });
    const [raffleLimits, setRaffleLimits] = useState({ maxUser: '1000', maxParticipants: '10000' });
    const [raffleXp, setRaffleXp] = useState({ create: '500', claim: '200', purchase: '50' });
    const [econShares, setEconShares] = useState({ owner: '4000', ops: '2000', treasury: '2000', sbt: '2000' });
    const [tierWeights, setTierWeights] = useState({ diamond: '400', gold: '200', silver: '100', bronze: '50' });
    const [withdrawFee, setWithdrawFee] = useState('500'); // BP

    // 1. READ Global Rewards
    const { data: qDaily } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'dailyBonusAmount' });
    const { data: qReferral } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'baseReferralReward' });

    // 2. READ Raffle Economics
    const { data: qRake } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'maintenanceFeeBP' });
    const { data: qSurcharge } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'surchargeBP' });
    const { data: qMaxUser } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'maxTicketsPerUser' });
    const { data: qMaxPart } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'maxParticipants' });
    const { data: qXpCreate } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'rewardXpCreate' });
    const { data: qXpClaim } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'rewardXpClaim' });
    const { data: qXpPurchase } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'rewardXpPurchase' });

    // 3. READ MasterX Economics
    const { data: qOwner } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'ownerShare' });
    const { data: qOps } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'opsShare' });
    const { data: qTreasury } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'treasuryShare' });
    const { data: qSbtShare } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'sbtPoolShare' });

    const { data: qDWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'diamondWeight' });
    const { data: qGWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'goldWeight' });
    const { data: qSWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'silverWeight' });
    const { data: qBWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'bronzeWeight' });

    useEffect(() => {
        if (qDaily) setRewards(prev => ({ ...prev, daily: qDaily.toString() }));
        if (qReferral) setRewards(prev => ({ ...prev, referral: qReferral.toString() }));
        if (qRake) setRaffleFees(prev => ({ ...prev, rake: qRake.toString() }));
        if (qSurcharge) setRaffleFees(prev => ({ ...prev, surcharge: qSurcharge.toString() }));
        if (qMaxUser) setRaffleLimits(prev => ({ ...prev, maxUser: qMaxUser.toString() }));
        if (qMaxPart) setRaffleLimits(prev => ({ ...prev, maxParticipants: qMaxPart.toString() }));
        if (qXpCreate) setRaffleXp(prev => ({ ...prev, create: qXpCreate.toString() }));
        if (qXpClaim) setRaffleXp(prev => ({ ...prev, claim: qXpClaim.toString() }));
        if (qXpPurchase) setRaffleXp(prev => ({ ...prev, purchase: qXpPurchase.toString() }));

        if (qOwner) setEconShares(prev => ({ ...prev, owner: qOwner.toString() }));
        if (qOps) setEconShares(prev => ({ ...prev, ops: qOps.toString() }));
        if (qTreasury) setEconShares(prev => ({ ...prev, treasury: qTreasury.toString() }));
        if (qSbtShare) setEconShares(prev => ({ ...prev, sbt: qSbtShare.toString() }));

        if (qDWeight) setTierWeights(prev => ({ ...prev, diamond: qDWeight.toString() }));
        if (qGWeight) setTierWeights(prev => ({ ...prev, gold: qGWeight.toString() }));
        if (qSWeight) setTierWeights(prev => ({ ...prev, silver: qSWeight.toString() }));
        if (qBWeight) setTierWeights(prev => ({ ...prev, bronze: qBWeight.toString() }));
    }, [qDaily, qReferral, qRake, qSurcharge, qMaxUser, qMaxPart, qXpCreate, qXpClaim, qXpPurchase, qOwner, qOps, qTreasury, qSbtShare, qDWeight, qGWeight, qSWeight, qBWeight]);

    const handleSaveGeneral = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Rewards to Chain...");
        try {
            await writeContractAsync({
                address: CONTRACTS.DAILY_APP,
                abi: DAILY_APP_ABI,
                functionName: 'setGlobalRewards',
                args: [BigInt(rewards.daily), BigInt(rewards.referral)],
            });
            toast.success("Rewards Updated!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || e.message, { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRaffleFees = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Raffle Fees...");
        try {
            await writeContractAsync({
                address: CONTRACTS.RAFFLE,
                abi: DAILY_APP_ABI,
                functionName: 'setRaffleFees',
                args: [BigInt(raffleFees.rake), BigInt(raffleFees.surcharge)],
            });
            toast.success("Raffle Fees Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveRaffleLimits = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Raffle Limits...");
        try {
            await writeContractAsync({
                address: CONTRACTS.RAFFLE,
                abi: DAILY_APP_ABI,
                functionName: 'setRaffleLimits',
                args: [BigInt(raffleLimits.maxUser), BigInt(raffleLimits.maxParticipants)],
            });
            toast.success("Raffle Limits Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveRaffleXp = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Raffle XP Rewards...");
        try {
            await writeContractAsync({
                address: CONTRACTS.RAFFLE,
                abi: DAILY_APP_ABI,
                functionName: 'setRaffleXP',
                args: [BigInt(raffleXp.create), BigInt(raffleXp.claim), BigInt(raffleXp.purchase)],
            });
            toast.success("Raffle XP Rewards Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveEconShares = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing MasterX Shares...");
        try {
            await writeContractAsync({
                address: CONTRACTS.MASTER_X,
                abi: DAILY_APP_ABI,
                functionName: 'setRevenueShares',
                args: [BigInt(econShares.owner), BigInt(econShares.ops), BigInt(econShares.treasury), BigInt(econShares.sbt)],
            });
            toast.success("Revenue Shares Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveTierWeights = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing SBT Pool Weights...");
        try {
            await writeContractAsync({
                address: CONTRACTS.MASTER_X,
                abi: DAILY_APP_ABI,
                functionName: 'setTierWeights',
                args: [BigInt(tierWeights.diamond), BigInt(tierWeights.gold), BigInt(tierWeights.silver), BigInt(tierWeights.bronze)],
            });
            toast.success("Tier Weights Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-6">
            {/* Rewards Card */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" /> GLOBAL XP REWARDS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Daily Claim XP</label>
                        <input type="number" value={rewards.daily} onChange={e => setRewards({ ...rewards, daily: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Referral XP</label>
                        <input type="number" value={rewards.referral} onChange={e => setRewards({ ...rewards, referral: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                    </div>
                </div>
                <button onClick={handleSaveGeneral} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Update XP Rewards
                </button>
            </div>

            {/* Raffle Fees Card */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <BarChart className="w-5 h-5 text-emerald-400" /> RAFFLE ECONOMICS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Rake BP (2000 = 20%)</label>
                        <input type="number" value={raffleFees.rake} onChange={e => setRaffleFees({ ...raffleFees, rake: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Surcharge BP (500 = 5%)</label>
                        <input type="number" value={raffleFees.surcharge} onChange={e => setRaffleFees({ ...raffleFees, surcharge: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                    </div>
                </div>
                <button onClick={handleSaveRaffleFees} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Update Raffle Fees
                </button>

                <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Max Tickets/User</label>
                        <input type="number" value={raffleLimits.maxUser} onChange={e => setRaffleLimits({ ...raffleLimits, maxUser: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Max Participants</label>
                        <input type="number" value={raffleLimits.maxParticipants} onChange={e => setRaffleLimits({ ...raffleLimits, maxParticipants: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                    </div>
                </div>
                <button onClick={handleSaveRaffleLimits} disabled={isSaving} className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Update Raffle Limits
                </button>
            </div>

            {/* Raffle XP Card */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-400" /> RAFFLE XP REWARDS
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">Create</label>
                        <input type="number" value={raffleXp.create} onChange={e => setRaffleXp({ ...raffleXp, create: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">Claim</label>
                        <input type="number" value={raffleXp.claim} onChange={e => setRaffleXp({ ...raffleXp, claim: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">Purchase</label>
                        <input type="number" value={raffleXp.purchase} onChange={e => setRaffleXp({ ...raffleXp, purchase: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
                    </div>
                </div>
                <button onClick={handleSaveRaffleXp} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Update Raffle XP
                </button>
            </div>

            {/* Withdraw Fee Card */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" /> WITHDRAWAL FEE
                </h3>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Withdraw Fee BP (e.g. 500 = 5%)</label>
                    <input type="number" value={withdrawFee} onChange={e => setWithdrawFee(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm" />
                </div>
                <button
                    onClick={async () => {
                        setIsSaving(true);
                        const tid = toast.loading("Updating Withdrawal Fee...");
                        try {
                            await writeContractAsync({
                                address: CONTRACTS.DAILY_APP,
                                abi: DAILY_APP_ABI,
                                functionName: 'setWithdrawalFee',
                                args: [BigInt(withdrawFee)],
                            });
                            toast.success("Fee Updated!", { id: tid });
                        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
                        finally { setIsSaving(false); }
                    }}
                    disabled={isSaving}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all"
                >
                    Update Withdraw Fee
                </button>
            </div>

            {/* MasterX Economics Card */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 lg:col-span-2">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-orange-400" /> MASTER-X REVENUE & POOL
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Revenue Shares */}
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Shares (BP - Total 10000)</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">Owner</label>
                                <input type="number" value={econShares.owner} onChange={e => setEconShares({ ...econShares, owner: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">Operations</label>
                                <input type="number" value={econShares.ops} onChange={e => setEconShares({ ...econShares, ops: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">Treasury</label>
                                <input type="number" value={econShares.treasury} onChange={e => setEconShares({ ...econShares, treasury: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">SBT Pool</label>
                                <input type="number" value={econShares.sbt} onChange={e => setEconShares({ ...econShares, sbt: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                        </div>
                        <button onClick={handleSaveEconShares} disabled={isSaving} className="w-full bg-orange-600 hover:bg-orange-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                            Update Revenue Shares
                        </button>
                    </div>

                    {/* Tier Weights */}
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SBT Pool Distribution Weights</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-cyan-400 uppercase">Diamond</label>
                                <input type="number" value={tierWeights.diamond} onChange={e => setTierWeights({ ...tierWeights, diamond: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-amber-400 uppercase">Gold</label>
                                <input type="number" value={tierWeights.gold} onChange={e => setTierWeights({ ...tierWeights, gold: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Silver</label>
                                <input type="number" value={tierWeights.silver} onChange={e => setTierWeights({ ...tierWeights, silver: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-amber-700 uppercase">Bronze</label>
                                <input type="number" value={tierWeights.bronze} onChange={e => setTierWeights({ ...tierWeights, bronze: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                        </div>
                        <button onClick={handleSaveTierWeights} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                            Update Tier Weights
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-[9px] text-yellow-400 font-bold uppercase leading-tight">
                    Warning: These changes are applied directly to the blockchain. Gas fees will be charged.
                </p>
            </div>
        </div>
    );
}
function SponsorshipConfigSection() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [fee, setFee] = useState('1');
    const [autoApprove, setAutoApprove] = useState(false);
    const [rewardPerClaim, setRewardPerClaim] = useState('100');
    const [tasksForReward, setTasksForReward] = useState('3');
    const [minPool, setMinPool] = useState('10');
    const [isSaving, setIsSaving] = useState(false);

    const { data: currentFee } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: currentAutoApprove } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'autoApproveSponsorship' });
    const { data: currentReward } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipRewardPerClaim' });
    const { data: currentTasks } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipTasksForReward' });
    const { data: currentMinPool } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipMinPoolValue' });

    useEffect(() => {
        if (currentFee) setFee((Number(currentFee) / 1e6).toString());
        if (currentAutoApprove !== undefined) setAutoApprove(currentAutoApprove);
        if (currentReward) setRewardPerClaim(currentReward.toString());
        if (currentTasks) setTasksForReward(currentTasks.toString());
        if (currentMinPool) setMinPool((Number(currentMinPool) / 1e6).toString());
    }, [currentFee, currentAutoApprove, currentReward, currentTasks, currentMinPool]);

    const { writeContractAsync } = useWriteContract();

    const handleSaveSponsorshipConfig = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating Sponsorship Params...");
        try {
            // Update Platform Fee
            if (fee !== (Number(currentFee) / 1e6).toString()) {
                await writeContractAsync({
                    address: CONTRACTS.DAILY_APP,
                    abi: DAILY_APP_ABI,
                    functionName: 'setSponsorshipPlatformFee',
                    args: [BigInt(Number(fee) * 1e6)],
                });
            }

            // Update Global Params
            await writeContractAsync({
                address: CONTRACTS.DAILY_APP,
                abi: DAILY_APP_ABI,
                functionName: 'setSponsorshipParams',
                args: [
                    BigInt(rewardPerClaim),
                    BigInt(tasksForReward),
                    BigInt(Number(minPool) * 1e6),
                    BigInt(Number(fee) * 1e6) // This also sets platform fee inside setSponsorshipParams
                ],
            });

            // Update Auto-Approve
            if (autoApprove !== currentAutoApprove) {
                await writeContractAsync({
                    address: CONTRACTS.DAILY_APP,
                    abi: DAILY_APP_ABI,
                    functionName: 'setAutoApproveSponsorship',
                    args: [autoApprove],
                });
            }

            toast.success("Sponsorship Settings Updated!", { id: tid });
        } catch (error) {
            console.error(error);
            toast.error("Update Failed: " + (error.shortMessage || error.message), { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="glass-card p-8 bg-slate-900/40 border border-white/5 space-y-6">
            <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-500" /> SPONSORSHIP CONTROL
                </h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Configure UGC Task parameters</p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Platform Fee (USDC)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                            <input
                                type="number"
                                value={fee}
                                onChange={(e) => setFee(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Min Pool (USDC)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                            <input
                                type="number"
                                value={minPool}
                                onChange={(e) => setMinPool(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Reward/Claim (XP)</label>
                        <input
                            type="number"
                            value={rewardPerClaim}
                            onChange={(e) => setRewardPerClaim(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Tasks/Reward</label>
                        <input
                            type="number"
                            value={tasksForReward}
                            onChange={(e) => setTasksForReward(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                    <div>
                        <p className="text-xs font-bold text-white uppercase">Auto-Approve UGC</p>
                        <p className="text-[9px] text-slate-500">When enabled, user tasks go live instantly after payment.</p>
                    </div>
                    <button
                        onClick={() => setAutoApprove(!autoApprove)}
                        className={`w-12 h-6 rounded-full transition-all relative ${autoApprove ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoApprove ? 'right-1' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            <button
                onClick={handleSaveSponsorshipConfig}
                disabled={isSaving}
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/10 active:scale-[0.98] disabled:opacity-50"
            >
                {isSaving ? "TRANSACTING..." : "PUSH CONFIG TO BLOCKCHAIN"}
            </button>
        </div>
    );
}
