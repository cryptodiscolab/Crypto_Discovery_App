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
    CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Objective 3: Admin Panel Component
 * Digunakan untuk mengatur Point Settings dan SBT Thresholds secara dinamis.
 * Keamanan: Hanya FID atau Wallet yang terdaftar di .env yang diizinkan masuk.
 */
export default function AdminPanel() {
    const navigate = useNavigate();
    const { address } = useAccount();
    const [pointSettings, setPointSettings] = useState([]);
    const [sbtThresholds, setSbtThresholds] = useState([]);
    const [eligibleUsers, setEligibleUsers] = useState([]);
    const [issuedSubnames, setIssuedSubnames] = useState([]);
    const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'ens'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(null);

    // 0. Ambil daftar admin dari .env
    const getAdminLists = () => {
        const fids = import.meta.env.VITE_ADMIN_FIDS || '';
        const wallets = import.meta.env.VITE_ADMIN_WALLETS || '';

        // Parsing logic: split by comma, trim spaces, and handle types
        const adminFids = fids.split(',')
            .map(f => f.trim())
            .filter(f => f !== '')
            .map(f => parseInt(f))
            .filter(f => !isNaN(f));

        const adminWallets = wallets.split(',')
            .map(w => w.trim().toLowerCase())
            .filter(w => w.startsWith('0x'));

        return { adminFids, adminWallets };
    };

    // 0. Security Gate: Check FID & Wallet on mount/change
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { adminFids, adminWallets } = getAdminLists();

                // Cek FID (jika di frame)
                let userFid = null;
                try {
                    const context = await sdk.context;
                    userFid = context?.user?.fid;
                } catch (e) {
                    console.warn('[Security] SDK context not available (not in frame?)');
                }

                const currentWallet = address?.toLowerCase();
                const isMatch = (userFid && adminFids.includes(userFid)) || (currentWallet && adminWallets.includes(currentWallet));

                // Debugging Log sesuai permintaan
                console.log('Wallet Login:', currentWallet);
                console.log('Wallet Daftar Admin:', adminWallets);
                console.log('Hasil Pengecekan:', isMatch);

                if (isMatch) {
                    console.log('[Security] Access Granted');
                    setIsAuthorized(true);
                    fetchData();
                } else {
                    console.error('[Security] Access Denied');
                    setIsAuthorized(false);
                    setLoading(false);
                    toast.error('Unauthorized: Wallet atau FID anda tidak terdaftar sebagai Admin.');

                    // Auto kick setelah 3 detik
                    setTimeout(() => {
                        navigate('/');
                    }, 3000);
                }
            } catch (error) {
                console.error('[Security] Error checking auth:', error);
                setIsAuthorized(false);
                setLoading(false);
            }
        };

        checkAuth();
    }, [navigate, address]);

    // 1. Ambil data dari Supabase saat komponen dibuka
    const fetchData = async () => {
        setLoading(true);
        try {
            const [pointsRes, thresholdsRes, issuedRes, usersRes] = await Promise.all([
                supabase.from('point_settings').select('*').order('activity_key'),
                supabase.from('sbt_thresholds').select('*').order('level'),
                supabase.from('ens_subdomains').select('*').order('created_at', { ascending: false }),
                // Ambil user yang level/tier >= 3 (berdasarkan XP)
                // Catatan: Ini asumsi ada tabel 'user_stats' yang menyimpan XP
                supabase.from('user_stats').select('*').gte('xp', 100).order('xp', { ascending: false })
            ]);

            if (pointsRes.error) throw pointsRes.error;
            if (thresholdsRes.error) throw thresholdsRes.error;

            setPointSettings(pointsRes.data);
            setSbtThresholds(thresholdsRes.data);

            if (!issuedRes.error) setIssuedSubnames(issuedRes.data);
            if (!usersRes.error) {
                // Filter user yang belum punya subdomain
                const issuedWallets = new Set((issuedRes.data || []).map(s => s.wallet_address.toLowerCase()));
                setEligibleUsers(usersRes.data.filter(u => !issuedWallets.has(u.wallet_address.toLowerCase())));
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            // Jangan error toast buat ens_subdomains kalo tabel belum dibuat
            if (!error.message?.includes('ens_subdomains')) {
                toast.error('Gagal mengambil data dari Supabase');
            }
        } finally {
            setLoading(false);
        }
    };

    // 1b. Issue Subname logic
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
            toast.success(`Subname ${fullName} berhasil diterbitkan!`);
            fetchData(); // Refresh list
        } catch (error) {
            toast.error('Gagal menerbitkan subname: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // 2. Handler untuk update state lokal (Point Settings)
    const handlePointChange = (id, newValue) => {
        setPointSettings(prev =>
            prev.map(item => item.id === id ? { ...item, points_value: parseInt(newValue) } : item)
        );
    };

    // 3. Handler untuk update state lokal (SBT Thresholds)
    const handleThresholdChange = (level, field, newValue) => {
        setSbtThresholds(prev =>
            prev.map(item => item.level === level ? {
                ...item,
                [field]: field === 'min_xp' ? parseInt(newValue) : newValue
            } : item)
        );
    };

    // 4. Simpan perubahan Point Settings ke Supabase
    const savePoints = async () => {
        setSaving(true);
        try {
            const { error } = await supabase.from('point_settings').upsert(pointSettings);
            if (error) throw error;
            toast.success('Point Settings berhasil diupdate!');
        } catch (error) {
            toast.error('Gagal menyimpan poin: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // 5. Simpan perubahan SBT Thresholds ke Supabase
    const saveThresholds = async () => {
        setSaving(true);
        try {
            const { error } = await supabase.from('sbt_thresholds').upsert(sbtThresholds);
            if (error) throw error;
            toast.success('Pacing Level berhasil diupdate!');
        } catch (error) {
            toast.error('Gagal menyimpan level: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-slate-400 font-mono animate-pulse">Verifying Security Credentials...</p>
            </div>
        );
    }

    // Handle Unauthorized Access (Logic Gembok Kuat)
    if (isAuthorized === false) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
                <div className="bg-red-500/10 p-6 rounded-full border border-red-500/20 mb-8 animate-bounce">
                    <AlertOctagon className="w-20 h-20 text-red-500" />
                </div>
                <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">403 - JOGET DULU BANG <span className="text-red-500">CRYPTO DISCO!</span></h1>
                <p className="text-xl text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Akses ditolak. Lu bukan admin yang berwenang. <br />
                    Tunggu sebentar, lu bakal ditendang balik ke depan...
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-10 flex items-center gap-2 text-indigo-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Balik Manual Sekarang
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl">
            {/* Header Section */}
            <div className="flex flex-col gap-6 border-b border-white/10 pb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                            <ShieldCheck className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white">Admin Control Center</h1>
                            <p className="text-slate-400 text-sm">Manage configuration & ENS identity</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-2 hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-white"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 p-1 bg-black/30 rounded-xl w-fit border border-white/5">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Settings className="w-4 h-4" />
                        Config
                    </button>
                    <button
                        onClick={() => setActiveTab('ens')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ens' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Globe className="w-4 h-4" />
                        ENS Subnames
                    </button>
                </div>
            </div>

            {activeTab === 'settings' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 📋 SECTION 1: POINT SETTINGS */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Settings className="w-5 h-5 text-blue-400" />
                            <h2 className="text-lg font-bold text-white">Point Settings</h2>
                        </div>
                        <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Activity</th>
                                        <th className="px-4 py-3">Points</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {pointSettings.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/[0.02] transition-all">
                                            <td className="px-4 py-4 text-sm font-medium text-slate-300 capitalize">
                                                {item.activity_key.replace('_', ' ')}
                                            </td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="number"
                                                    value={item.points_value}
                                                    onChange={(e) => handlePointChange(item.id, e.target.value)}
                                                    className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button
                            onClick={savePoints}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Points'}
                        </button>
                    </div>

                    {/* 🚀 SECTION 2: SBT THRESHOLDS */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            <h2 className="text-lg font-bold text-white">SBT Thresholds</h2>
                        </div>
                        <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Lvl</th>
                                        <th className="px-4 py-3">Min XP</th>
                                        <th className="px-4 py-3">Name</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {sbtThresholds.map((item) => (
                                        <tr key={item.level} className="hover:bg-white/[0.02] transition-all">
                                            <td className="px-4 py-4 text-sm font-black text-emerald-400">
                                                {item.level}
                                            </td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="number"
                                                    value={item.min_xp}
                                                    onChange={(e) => handleThresholdChange(item.level, 'min_xp', e.target.value)}
                                                    className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-emerald-500 font-mono text-sm"
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="text"
                                                    value={item.level_name}
                                                    onChange={(e) => handleThresholdChange(item.level, 'level_name', e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-emerald-500 text-sm"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button
                            onClick={saveThresholds}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Thresholds'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* 🌐 ENS MANAGEMENT SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Column 1: Eligible User List */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <UserCheck className="w-5 h-5 text-indigo-400" />
                                <h2 className="text-lg font-bold text-white">Eligible (Level 3+)</h2>
                            </div>
                            <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-4 max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar">
                                {eligibleUsers.length > 0 ? (
                                    eligibleUsers.map((user) => (
                                        <div key={user.fid} className="bg-white/[0.03] border border-white/5 p-4 rounded-xl flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-mono text-indigo-400">FID: {user.fid}</span>
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">XP: {user.xp}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id={`label-${user.fid}`}
                                                    type="text"
                                                    placeholder="e.g. jagoan"
                                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                                                />
                                                <span className="text-slate-500 text-xs text-nowrap">.cryptodiscovery.eth</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const label = document.getElementById(`label-${user.fid}`).value;
                                                    issueSubname(user, label);
                                                }}
                                                disabled={saving}
                                                className="w-full bg-white/10 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Issue Subname
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-slate-500 text-center py-10 text-sm">No new eligible users found.</p>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Issued Identity History */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Globe className="w-5 h-5 text-emerald-400" />
                                <h2 className="text-lg font-bold text-white">Issued Subnames</h2>
                            </div>
                            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold sticky top-0 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-4 py-3">Full Name</th>
                                                <th className="px-4 py-3">Wallet</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {issuedSubnames.length > 0 ? (
                                                issuedSubnames.map((item) => (
                                                    <tr key={item.id} className="hover:bg-white/[0.02] transition-all">
                                                        <td className="px-4 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-white">{item.full_name}</span>
                                                                <span className="text-[10px] text-slate-500">FID: {item.fid}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <a
                                                                href={`https://basescan.org/address/${item.wallet_address}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
                                                            >
                                                                {item.wallet_address?.slice(0, 6)}...{item.wallet_address?.slice(-4)}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="2" className="px-4 py-10 text-center text-slate-500 text-sm">No records found.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CCIP-Read Status Info */}
                    <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3">
                        <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-indigo-400" />
                            <h3 className="text-white font-bold text-sm">ENS CCIP-Read Gateway Status</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Method</p>
                                <p className="text-xs text-indigo-300 font-mono">Off-chain (Gas Free)</p>
                            </div>
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Parent Domain</p>
                                <p className="text-xs text-indigo-300 font-mono">cryptodiscovery.eth</p>
                            </div>
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Sync Engine</p>
                                <p className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                                    <Database className="w-3 h-3" /> Supabase
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ⚠️ Footer Info */}
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-200/70 leading-relaxed">
                    <strong>Perhatian:</strong> {activeTab === 'settings'
                        ? 'Perubahan angka di sini akan langsung berdampak pada seluruh user.'
                        : 'Penerbitan subname bersifat permanen di database. User hanya bisa punya 1 subdomain aktif.'}
                </p>
            </div>
        </div>
    );
}
