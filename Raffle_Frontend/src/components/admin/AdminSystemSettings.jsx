import React, { useState, useEffect } from 'react';
import { isAddress } from 'viem';
import { cleanWallet } from '../../utils/cleanWallet';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase } from '../../lib/supabaseClient';
import {
    Settings,
    RefreshCw,
    ShieldCheck,
    Info,
    History,
    Award,
    Plus,
    Globe
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSBT } from '../../hooks/useSBT';

// Internal Fragment Components
import { PointSettingsSection } from './system/PointSettingsSection';
import { SbtThresholdsSection } from './system/SbtThresholdsSection';
import { AdvancedTierSection } from './system/AdvancedTierSection';
import { EnsManagementSection } from './system/EnsManagementSection';
import { AuditLogsSection } from './system/AuditLogsSection';
import { BlockchainConfigSection } from './system/BlockchainConfigSection';
import { SponsorshipConfigSection } from './system/SponsorshipConfigSection';

/**
 * Admin System Settings Component
 * Decomposed into smaller modules to ensure build stability and maintainability.
 */
export default function AdminSystemSettings() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { syncTiersToContract } = useSBT();

    // Core States
    const [pointSettings, setPointSettings] = useState([]);
    const [sbtThresholds, setSbtThresholds] = useState([]);
    const [eligibleUsers, setEligibleUsers] = useState([]);
    const [issuedSubnames, setIssuedSubnames] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('settings');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Advanced Tier States
    const [tierConfig, setTierConfig] = useState({ diamond: 0.01, gold: 0.10, silver: 0.30, bronze: 0.70 });
    const [tierDistribution, setTierDistribution] = useState([]);
    const [targetWallet, setTargetWallet] = useState('');
    const [overrideTier, setOverrideTier] = useState(0);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchPointSettings(),
                fetchTierConfig(),
                fetchTierDistribution()
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fetchTierDistribution = async () => {
        try {
            const { data, error } = await supabase.rpc('fn_get_tier_distribution');
            if (!error && data) setTierDistribution(data);
        } catch (error) { console.error('Fetch Distribution Error:', error); }
    };

    const fetchTierConfig = async () => {
        try {
            const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'tier_percentiles').single();
            if (!error && data) setTierConfig(data.value);
        } catch (error) { console.error('Fetch Tier Config Error:', error); }
    };

    const fetchPointSettings = async () => {
        try {
            const [pointsRes, thresholdsRes, issuedRes, usersRes, logsRes] = await Promise.all([
                supabase.from('point_settings').select('*').order('activity_key'),
                supabase.from('sbt_thresholds').select('*').order('level'),
                supabase.from('ens_subdomains').select('*').order('created_at', { ascending: false }),
                supabase.from('user_profiles').select('*').gte('total_xp', 100).order('total_xp', { ascending: false }),
                supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(20)
            ]);

            if (pointsRes.error) throw pointsRes.error;
            if (thresholdsRes.error) throw thresholdsRes.error;

            setPointSettings(pointsRes.data || []);
            setSbtThresholds(thresholdsRes.data || []);
            if (!issuedRes.error) setIssuedSubnames(issuedRes.data || []);
            if (!usersRes.error) {
                const issuedWallets = new Set((issuedRes.data || []).map(s => cleanWallet(s.wallet_address)));
                setEligibleUsers(usersRes.data.filter(u => u.wallet_address && !issuedWallets.has(cleanWallet(u.wallet_address))));
            }
            if (!logsRes.error) setAuditLogs(logsRes.data || []);

        } catch (error) {
            console.error('Fetch Error:', error);
            toast.error("Failed to sync DB data: " + error.message);
        }
    };

    // --- Action Handlers ---

    const handlePointChange = (id, field, newValue) => {
        setPointSettings(prev => prev.map(item => item.id === id ? { ...item, [field]: field === 'points_value' ? parseInt(newValue) || 0 : newValue } : item));
    };

    const addPointActivity = () => {
        const id = `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setPointSettings([...pointSettings, { id, activity_key: 'new_activity', points_value: 10, platform: 'farcaster', action_type: 'Follow', is_active: true }]);
    };

    const savePoints = async () => {
        setSaving(true);
        const tid = toast.loading('Requesting signature for Point Sync...');
        try {
            const cleanData = pointSettings.filter(item => item.activity_key?.trim()).map(item => ({
                activity_key: item.activity_key.toLowerCase().trim().replace(/\s+/g, '_'),
                points_value: parseInt(item.points_value) || 0,
                platform: item.platform || 'farcaster',
                action_type: item.action_type || 'Follow',
                is_active: item.is_active ?? true,
                is_hidden: item.is_hidden || false,
                updated_at: new Date().toISOString()
            }));

            const timestamp = new Date().toISOString();
            const message = `Update Point Settings\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}\nItems: ${cleanData.length}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_address: address, signature, message, action_type: 'UPDATE_POINTS', payload: cleanData })
            });

            if (!response.ok) throw new Error("Failed to update points");
            toast.success('Point Settings updated!', { id: tid });
            await fetchPointSettings();
        } catch (error) {
            toast.error('Failed to save points: ' + error.message, { id: tid });
        } finally { setSaving(false); }
    };

    const handleThresholdChange = (id, field, newValue) => {
        setSbtThresholds(prev => prev.map(item => item.id === id ? { ...item, [field]: (field === 'min_xp' || field === 'level') ? parseInt(newValue) || 0 : newValue } : item));
    };

    const addSbtLevel = () => {
        const nextLevel = sbtThresholds.length > 0 ? Math.max(...sbtThresholds.map(l => l.level)) + 1 : 1;
        const nextXp = sbtThresholds.length > 0 ? Math.max(...sbtThresholds.map(l => l.min_xp)) + 50 : 0;
        setSbtThresholds([...sbtThresholds, { id: `lvl-${Date.now()}`, level: nextLevel, min_xp: nextXp, tier_name: 'New Tier Name', badge_url: '' }]);
    };

    const saveThresholds = async () => {
        setSaving(true);
        const tid = toast.loading('Requesting signature for SBT Sync...');
        try {
            const dataToSave = sbtThresholds.map(({ id, ...rest }) => rest);
            const timestamp = new Date().toISOString();
            const message = `Update SBT Thresholds\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}\nLevels: ${dataToSave.length}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_address: address, signature, message, action_type: 'UPDATE_THRESHOLDS', payload: dataToSave })
            });

            if (!response.ok) throw new Error("Failed to update thresholds");
            toast.success('SBT Thresholds updated!', { id: tid });
            fetchPointSettings();
        } catch (error) { toast.error('Failed to save thresholds: ' + error.message, { id: tid }); }
        finally { setSaving(false); }
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
                body: JSON.stringify({ wallet_address: address, signature, message, action_type: 'UPDATE_TIER_CONFIG', payload: tierConfig })
            });

            if (!response.ok) throw new Error('Failed to save tier config');
            if (!silent) toast.success('Tier configuration saved!', { id: tid });
        } catch (error) {
            if (!silent) toast.error('Failed to save tier config: ' + error.message, { id: tid });
            throw error;
        } finally { if (!silent) setSaving(false); }
    };

    const handleManualOverride = async () => {
        if (!isAddress(targetWallet)) return toast.error('Invalid wallet address');
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
                    wallet_address: address, signature, message, action_type: 'MANUAL_TIER_OVERRIDE',
                    payload: { target_address: targetWallet, tier: overrideTier }
                })
            });

            if (!response.ok) throw new Error("Failed to apply override");
            toast.success('Manual override applied!', { id: tid });
            setTargetWallet('');
            fetchTierDistribution();
        } catch (error) { toast.error('Override failed: ' + error.message, { id: tid }); }
        finally { setSaving(false); }
    };

    const handleSyncTiers = async () => {
        if (!window.confirm('PUSH LEADERBOARD TO BLOCKCHAIN?')) return;
        setSaving(true);
        try {
            await saveTierConfig(true);
            await syncTiersToContract(signMessageAsync);
            fetchTierDistribution();
        } catch (error) { console.error('Sync error:', error); }
        finally { setSaving(false); }
    };

    const issueSubname = async (user, label) => {
        if (!label || label.length < 3) return toast.error('Label too short');
        setSaving(true);
        const tid = toast.loading('Issuing ENS Subname...');
        try {
            const timestamp = new Date().toISOString();
            const fullName = `${label.toLowerCase()}.cryptodiscovery.eth`;
            const message = `Issue ENS Subname\nTarget: ${fullName}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address, signature, message, action_type: 'ISSUE_ENS',
                    payload: { fid: user.fid, wallet_address: user.wallet_address, label: label.toLowerCase(), full_name: fullName }
                })
            });

            if (!response.ok) throw new Error("Failed to issue identity");
            toast.success(`Identity ${fullName} issued!`, { id: tid });
            fetchPointSettings();
        } catch (error) { toast.error('ENS Error: ' + error.message, { id: tid }); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-slate-400 font-mono animate-pulse uppercase tracking-widest text-xs font-black">Decrypting System Matrix...</p>
        </div>
    );

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
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === tab.id ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Contents */}
            {activeTab === 'settings' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <PointSettingsSection
                        pointSettings={pointSettings}
                        onAddActivity={addPointActivity}
                        onRemoveActivity={(id) => setPointSettings(prev => prev.filter(i => i.id !== id))}
                        onChange={handlePointChange}
                        onSave={savePoints}
                        saving={saving}
                    />
                    <SbtThresholdsSection
                        thresholds={sbtThresholds}
                        onAddLevel={addSbtLevel}
                        onRemoveLevel={(id) => setSbtThresholds(prev => prev.filter(i => i.id !== id))}
                        onChange={handleThresholdChange}
                        onSave={saveThresholds}
                        saving={saving}
                    />
                    <AdvancedTierSection
                        tierDistribution={tierDistribution}
                        tierConfig={tierConfig}
                        onTierConfigChange={(key, val) => setTierConfig({ ...tierConfig, [key]: val })}
                        onSaveTierConfig={() => saveTierConfig()}
                        targetWallet={targetWallet}
                        onTargetWalletChange={setTargetWallet}
                        overrideTier={overrideTier}
                        onOverrideTierChange={setOverrideTier}
                        onApplyOverride={handleManualOverride}
                        onSyncTiers={handleSyncTiers}
                        saving={saving}
                    />
                </div>
            )}

            {activeTab === 'ens' && (
                <EnsManagementSection
                    eligibleUsers={eligibleUsers}
                    issuedSubnames={issuedSubnames}
                    onIssue={issueSubname}
                    saving={saving}
                />
            )}

            {activeTab === 'logs' && <AuditLogsSection logs={auditLogs} />}
            {activeTab === 'blockchain' && <BlockchainConfigSection />}
            {activeTab === 'sponsorship' && <SponsorshipConfigSection />}

            {/* Footer Policy */}
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-wide font-black">
                    Security Policy: double check verification active. All changes are logged to <code className="text-white">admin_audit_logs</code>.
                    All on-chain actions require multisig-authorized account or owner signature.
                </p>
            </div>
        </div>
    );
}
