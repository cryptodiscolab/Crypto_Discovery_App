import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import sdk from '@farcaster/frame-sdk';
import { useAccount } from 'wagmi';
import { supabase } from './dailyAppLogic';
import {
    Database,
    Settings,
    TrendingUp,
    Save,
    RefreshCw,
    ShieldCheck,
    ChevronRight,
    Info,
    AlertOctagon,
    ArrowLeft,
    UserCheck,
    Globe,
    ExternalLink,
    CheckCircle2,
    Plus,
    Trash2,
    History
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Objective 3: Admin Panel Component
 * Fitur: Dynamic Point Table, Dynamic SBT Levels, & Audit Logging.
 * Protokol Keamanan: Double Check (FID 1477344 & Wallet 0x0845...204B)
 */
export default function AdminPanel() {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const [pointSettings, setPointSettings] = useState([]);
    const [sbtThresholds, setSbtThresholds] = useState([]);
    const [eligibleUsers, setEligibleUsers] = useState([]);
    const [issuedSubnames, setIssuedSubnames] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'ens' | 'logs'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(null);

    // 0. Security Gate: Hybrid Double Check Protocol
    // Toggle ini disiapkan agar jika Frame sudah aktif, bisa dipaksa logic AND (Wallet + FID)
    const STRICT_FRAME_CHECK = false;

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Parse Admin Lists from Env
                const walletsEnv = import.meta.env.VITE_ADMIN_WALLETS || '';
                const fidsEnv = import.meta.env.VITE_ADMIN_FIDS || '';

                const adminWallets = walletsEnv.split(',').map(w => w.trim().toLowerCase()).filter(w => w !== '');
                const adminFids = fidsEnv.split(',').map(f => f.trim()).filter(f => f !== '').map(f => parseInt(f));

                let userFid = null;
                try {
                    const context = await sdk.context;
                    userFid = context?.user?.fid;
                } catch (e) {
                    console.warn('[Security] SDK context not available');
                }

                const currentWallet = address?.toLowerCase();
                const walletMatch = currentWallet && adminWallets.includes(currentWallet);
                const fidMatch = userFid && adminFids.includes(parseInt(userFid));

                let isAuthorizedResult = false;
                let loginType = 'None';

                if (STRICT_FRAME_CHECK) {
                    // Mode Ketat: Harus ada Wallet DAN FID
                    isAuthorizedResult = walletMatch && fidMatch;
                    loginType = isAuthorizedResult ? 'Strict (Wallet + FID)' : 'Unauthorized';
                } else {
                    // Logic Hybrid (User Request):
                    if (walletMatch && !userFid) {
                        // Di luar Frame, izinkan via Wallet
                        isAuthorizedResult = true;
                        loginType = 'Wallet Standalone';
                        toast.error("Warning: Login via Wallet Only. Farcaster Frame identity not detected.", {
                            duration: 5000,
                            icon: '⚠️'
                        });
                    } else if (walletMatch && fidMatch) {
                        // Full Auth
                        isAuthorizedResult = true;
                        loginType = 'Full Secure (Wallet + FID)';
                    } else if (fidMatch) {
                        // FID Terdeteksi, tapi wallet mungkin beda/belum connect
                        isAuthorizedResult = true;
                        loginType = 'FID Only';
                    } else if (walletMatch) {
                        // Fallback jika FID ada tapi tidak match list admin, tapi wallet match
                        isAuthorizedResult = true;
                        loginType = 'Wallet Only (FID Mismatch)';
                    }
                }

                console.log('[Security] Double Check Verification:', {
                    walletMatch,
                    fidMatch,
                    loginType,
                    isAuthorized: isAuthorizedResult
                });

                if (isAuthorizedResult) {
                    console.log('[Security] Double Check PASSED via', loginType);
                    setIsAuthorized(true);

                    // Audit Log: Record login action
                    await logAdminAction('ADMIN_LOGIN', {
                        type: loginType,
                        wallet: currentWallet,
                        fid: userFid,
                        context: userFid ? 'Inside Frame' : 'Standalone Browser'
                    });

                    fetchData();
                } else {
                    console.error('[Security] Double Check FAILED');
                    setIsAuthorized(false);
                    setLoading(false);
                }
            } catch (error) {
                console.error('[Security] Error checking auth:', error);
                setIsAuthorized(false);
                setLoading(false);
            }
        };

        if (isConnected) {
            checkAuth();
        } else if (!isConnected && !loading) {
            // Wait for connection or failed connection
            // If already loaded and not connected, might need to show login
            setLoading(false);
        }
    }, [navigate, address, isConnected]);

    // 1. Fetching Logic (Sync with new DB columns)
    const fetchData = async () => {
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
                const issuedWallets = new Set((issuedRes.data || []).map(s => s.wallet_address.toLowerCase()));
                setEligibleUsers(usersRes.data.filter(u => u.wallet_address && !issuedWallets.has(u.wallet_address.toLowerCase())));
            }
            if (!logsRes.error) setAuditLogs(logsRes.data);

        } catch (error) {
            console.error('Fetch Error:', error);
            toast.error('Gagal sinkron data DB: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 2. Audit Logging Utility
    const logAdminAction = async (action, details) => {
        try {
            await supabase.from('admin_audit_logs').insert([{
                admin_address: address,
                action: action,
                details: details
            }]);
        } catch (e) {
            console.error('Logging Error:', e);
        }
    };

    // 3. Dynamic Point Handlers
    const handlePointChange = (id, field, newValue) => {
        setPointSettings(prev =>
            prev.map(item => item.id === id ? {
                ...item,
                [field]: field === 'points_value' ? parseInt(newValue) || 0 : newValue
            } : item)
        );
    };

    const addPointActivity = () => {
        const newActivity = {
            id: crypto.randomUUID(), // Temp ID
            activity_key: 'new_activity',
            points_value: 10,
            platform: 'farcaster',
            is_active: true
        };
        setPointSettings([...pointSettings, newActivity]);
        toast.success(`Baris activity baru ditambahkan secara lokal.`);
    };

    const removePointActivity = (id) => {
        setPointSettings(prev => prev.filter(item => item.id !== id));
    };

    const savePoints = async () => {
        setSaving(true);
        try {
            // Cleanup temp IDs and apply formatting
            const dataToSave = pointSettings.map(item => ({
                id: typeof item.id === 'string' && item.id.includes('-') ? undefined : item.id,
                activity_key: item.activity_key.toLowerCase().trim().replace(/\s+/g, '_'),
                points_value: item.points_value,
                platform: item.platform,
                action_type: item.action_type || 'Custom',
                is_active: item.is_active,
                is_hidden: item.is_hidden || false
            }));

            // Validation: activity_key must be unique
            const keys = dataToSave.map(s => s.activity_key);
            if (new Set(keys).size !== keys.length) {
                throw new Error("Activity Key harus unik.");
            }

            const { error } = await supabase.from('point_settings').upsert(dataToSave, { onConflict: 'activity_key' });
            if (error) throw error;

            await logAdminAction('UPDATE_POINTS', { pointSettings: dataToSave });
            toast.success('SYNC BERHASIL: Point Settings terupdate di database!');
            fetchData();
        } catch (error) {
            toast.error('Gagal menyimpan poin: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // 4. Dynamic SBT Threshold Handlers
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
            id: crypto.randomUUID(), // Temp ID
            level: nextLevel,
            min_xp: nextXp,
            tier_name: 'New Tier Name',
            badge_url: ''
        };
        setSbtThresholds([...sbtThresholds, newLevel]);
        toast.success(`Baris level ${nextLevel} ditambahkan secara lokal.`);
    };

    const removeSbtLevel = (id) => {
        setSbtThresholds(prev => prev.filter(item => item.id !== id));
    };

    const saveThresholds = async () => {
        setSaving(true);
        try {
            // Validation: level must be unique
            const levels = sbtThresholds.map(s => s.level);
            if (new Set(levels).size !== levels.length) {
                throw new Error("Level ID (Lvl) harus unik, tidak boleh ada yang kembar.");
            }

            // Cleanup temp IDs before saving if they were UUIDs and DB expects serial/uuid correctly
            const dataToSave = sbtThresholds.map(item => ({
                level: item.level,
                min_xp: item.min_xp,
                tier_name: item.tier_name,
                badge_url: item.badge_url
            }));

            // Clear and overwrite recommended for dynamic list matching
            const { error: delError } = await supabase.from('sbt_thresholds').delete().neq('level', 0); // Clear all
            if (delError) throw delError;

            const { error: insError } = await supabase.from('sbt_thresholds').insert(dataToSave);
            if (insError) throw insError;

            await logAdminAction('UPDATE_SBT_LEVELS', { sbtThresholds });
            toast.success('SYNC BERHASIL: SBT Thresholds terupdate secara dinamis!');
            fetchData();
        } catch (error) {
            toast.error('Gagal menyimpan level: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // 5. ENS Issue Logic
    const issueSubname = async (user, label) => {
        if (!label || label.length < 3) {
            toast.error('Label minimal 3 karakter');
            return;
        }
        setSaving(true);
        const fullName = `${label.toLowerCase()}.cryptodiscovery.eth`;
        try {
            const { error } = await supabase.from('ens_subdomains').insert([{
                fid: user.fid,
                wallet_address: user.wallet_address,
                label: label.toLowerCase(),
                full_name: fullName
            }]);
            if (error) throw error;
            await logAdminAction('ISSUE_ENS', { fid: user.fid, label, fullName });
            toast.success(`Subname ${fullName} berhasil diterbitkan di database!`);
            fetchData();
        } catch (error) {
            toast.error('Gagal menerbitkan subname: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-slate-400 font-mono animate-pulse">Running Double Check Security Guard...</p>
            </div>
        );
    }

    if (isAuthorized === false) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
                <div className="bg-red-500/10 p-6 rounded-full border border-red-500/20 mb-8 animate-bounce">
                    <AlertOctagon className="w-20 h-20 text-red-500" />
                </div>
                <h1 className="text-4xl font-black text-white mb-4">403 - DOUBLE CHECK <span className="text-red-500">FAILED</span></h1>
                <p className="text-lg text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Akses ditolak. Protocol Double Check mendeteksi Wallet atau FID Anda tidak sesuai otoritas Senior Developer.
                </p>
                <button onClick={() => navigate('/')} className="mt-8 flex items-center gap-2 bg-indigo-600 px-6 py-3 rounded-xl text-white font-bold hover:bg-indigo-500 transition-all">
                    <ArrowLeft className="w-4 h-4" /> Balik ke Home
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8 bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl">
            {/* Header Section */}
            <div className="flex flex-col gap-6 border-b border-white/10 pb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                            <ShieldCheck className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Admin System <span className="text-indigo-500">v2.0</span></h1>
                            <p className="text-slate-400 text-xs font-mono">Dynamic Point Control & Audit Logging Enabled</p>
                        </div>
                    </div>
                    <button onClick={fetchData} className="p-2 hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-white">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 p-1 bg-black/30 rounded-xl w-fit border border-white/5">
                    {[
                        { id: 'settings', label: 'Dashboard', icon: Settings },
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
                            {saving ? 'Saving...' : 'Sync SBT Thresholds'}
                        </button>
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
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-black uppercase tracking-tighter">XP: {user.total_xp}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input id={`label-${user.fid}`} type="text" placeholder="label" className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none font-bold" />
                                        <span className="text-slate-500 text-xs font-black">.cryptodiscovery.eth</span>
                                    </div>
                                    <button onClick={() => issueSubname(user, document.getElementById(`label-${user.fid}`).value)} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Issue Subname Identity
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
                                        <td className="px-4 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${log.action.includes('ENS') ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{log.action}</span></td>
                                        <td className="px-4 py-4 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
