import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import sdk from '@farcaster/frame-sdk';
import { Shield, Award, Landmark, Users, ArrowUpRight, DollarSign, Database, CheckCircle, AlertTriangle, ExternalLink, RefreshCw, Edit3, Save, Eye, EyeOff, UserCog, Newspaper, TrendingUp, Trophy, Zap, Timer as TimerIcon } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useSBT } from '../hooks/useSBT';
import { useCMS } from '../hooks/useCMS';
import { RoleManagementTab } from '../components/admin/RoleManagementTab';
import { WhitelistManagerTab } from '../components/admin/WhitelistManagerTab';
import { RaffleManagerTab } from '../components/admin/RaffleManagerTab';
import { TaskManagerTab } from '../components/admin/TaskManagerTab';
import { formatEther, parseEther } from 'ethers';
import toast from 'react-hot-toast';

export function AdminPage() {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { totalPoolBalance, contractOwner, distributePool, updateTier, withdrawTreasury, refetchAll } = useSBT();
    const {
        isAdmin: isCMSAdmin,
        isOperator,
        canEdit: canEditCMS,
        isLoading: loadingCMS,
        poolSettings,
        ethPrice,
        updatePoolSettings
    } = useCMS();

    const [activeTab, setActiveTab] = useState('pool');
    const [hasManagerAccess, setHasManagerAccess] = useState(false);
    const [loading, setLoading] = useState(true);

    // Hardcoded admin from env for bypass
    const hardcodedAdmin = import.meta.env.VITE_ADMIN_ADDRESS;

    // 1. Security & Access Control
    useEffect(() => {
        const checkAccess = async () => {
            if (!isConnected) {
                setLoading(false);
                return;
            }

            try {
                // Get Admin Lists
                const fids = import.meta.env.VITE_ADMIN_FIDS || '';
                const wallets = import.meta.env.VITE_ADMIN_WALLETS || '';
                const fallback = import.meta.env.VITE_ADMIN_ADDRESS || '';

                const adminFids = fids.split(',').map(f => f.trim()).filter(f => f !== '').map(f => parseInt(f)).filter(f => !isNaN(f));
                const adminWallets = `${wallets},${fallback}`.split(',').map(w => w.trim().toLowerCase()).filter(w => w.startsWith('0x'));

                // Get Current User Context
                let userFid = null;
                try {
                    const context = await sdk.context;
                    userFid = context?.user?.fid;
                } catch (e) {
                    // Not in frame
                }

                const currentWallet = address?.toLowerCase();
                const isSBTAccountOwner = contractOwner && currentWallet && currentWallet === contractOwner.toLowerCase();
                const isEnvAdmin = currentWallet && adminWallets.includes(currentWallet);
                const isFidAdmin = userFid && adminFids.includes(userFid);

                // Final Access Boolean
                const finalAccess = isSBTAccountOwner || isCMSAdmin || isOperator || isEnvAdmin || isFidAdmin || canEditCMS;

                // Debugging Log sesuai permintaan
                console.log('Wallet Login:', currentWallet);
                console.log('Wallet Daftar Admin:', adminWallets);
                console.log('Hasil Pengecekan:', finalAccess);

                if (address) {
                    setHasManagerAccess(finalAccess);

                    if (finalAccess || !loadingCMS) {
                        setLoading(false);
                        if (!finalAccess && !loadingCMS) {
                            toast.error("Unauthorized: Restricted Area. Redirecting...");
                            // Auto kick setelah 3 detik
                            setTimeout(() => {
                                navigate('/');
                            }, 3000);
                        }
                    }
                }
            } catch (error) {
                console.error('[Security] Error checking auth:', error);
                setLoading(false);
            }
        };

        checkAccess();
    }, [address, contractOwner, isConnected, isCMSAdmin, isOperator, canEditCMS, navigate, loadingCMS]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Shield className="w-12 h-12 text-indigo-500 animate-pulse" />
            </div>
        );
    }

    if (!hasManagerAccess) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-slate-400">This module is reserved for administrators and operators only.</p>
                <button onClick={() => navigate('/')} className="mt-6 text-blue-400 hover:underline">Return to Home</button>
            </div>
        );
    }

    const tabs = [
        { id: 'pool', label: 'SBT Master', icon: Database, color: 'indigo' },
        { id: 'raffles', label: 'Raffles On-Chain', icon: Trophy, color: 'blue' },
        { id: 'tasks', label: 'Task Master', icon: Zap, color: 'purple' },
        { id: 'tiers', label: 'Tier Control', icon: Award, color: 'yellow' },
        { id: 'treasury', label: 'Treasury Safe', icon: Landmark, color: 'emerald' },
        { id: 'roles', label: 'Role Management', icon: UserCog, color: 'yellow' },
        { id: 'whitelist', label: 'Sponsored Access', icon: Shield, color: 'purple' },
        { id: 'announcement', label: 'Announcement', icon: Edit3, color: 'blue' },
        { id: 'news', label: 'News & Updates', icon: Newspaper, color: 'green' },
        { id: 'content', label: 'Feature Cards', icon: Database, color: 'indigo' },
    ];

    return (
        <div className="min-h-screen pt-24 pb-12 px-4">
            <div className="container mx-auto max-w-5xl">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                            <Shield className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white">Management Portal</h1>
                            <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">
                                {address?.slice(0, 8)}...{address?.slice(-6)}
                            </p>
                        </div>
                    </div>


                    <button
                        onClick={() => refetchAll()}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg"
                    >
                        <RefreshCw className="w-4 h-4" /> Sync Stats
                    </button>
                </div>

                {/* Tab Navigation (Modern Wrapped Grid) */}
                <div className="mb-10">
                    <div className="flex flex-wrap gap-3 p-2 bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${isActive
                                        ? 'bg-indigo-600 text-white shadow-[0_0_25px_rgba(79,70,229,0.5)] scale-105 z-10'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                                    <span className="text-xs md:text-sm tracking-tight">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'pool' && (
                            <PoolTab
                                balance={totalPoolBalance}
                                onDistribute={distributePool}
                                ethPrice={ethPrice}
                                settings={poolSettings}
                                onUpdateSettings={updatePoolSettings}
                            />
                        )}
                        {activeTab === 'raffles' && <RaffleManagerTab />}
                        {activeTab === 'tasks' && <TaskManagerTab />}
                        {activeTab === 'tiers' && <TierTab onUpdate={updateTier} />}
                        {activeTab === 'treasury' && <TreasuryTab onWithdraw={withdrawTreasury} />}
                        {activeTab === 'roles' && <RoleManagementTab />}
                        {activeTab === 'whitelist' && <WhitelistManagerTab />}
                        {activeTab === 'announcement' && <AnnouncementTab />}
                        {activeTab === 'news' && <NewsTab />}
                        {activeTab === 'content' && <ContentTab />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// ============================================
// ANNOUNCEMENT TAB
// ============================================

function AnnouncementTab() {
    const { announcement, updateAnnouncement, showSuccessToast, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [editedAnnouncement, setEditedAnnouncement] = useState(announcement || {});

    useEffect(() => {
        if (announcement) setEditedAnnouncement(announcement);
    }, [announcement]);

    const handleSave = async () => {
        setIsSaving(true);
        const tid = toast.loading("Saving announcement to blockchain...");
        try {
            const hash = await updateAnnouncement(editedAnnouncement);
            showSuccessToast("Announcement Updated!", hash);
            toast.dismiss(tid);
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass-card p-8 bg-blue-950/10 border border-blue-500/10">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Edit3 className="w-6 h-6 text-blue-500" /> Announcement Editor
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                        <input
                            value={editedAnnouncement.title || ''}
                            onChange={(e) => setEditedAnnouncement({ ...editedAnnouncement, title: e.target.value })}
                            placeholder="Welcome to Disco Gacha!"
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label>
                        <textarea
                            value={editedAnnouncement.message || ''}
                            onChange={(e) => setEditedAnnouncement({ ...editedAnnouncement, message: e.target.value })}
                            placeholder="Check out our new features..."
                            rows={3}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Type</label>
                            <select
                                value={editedAnnouncement.type || 'info'}
                                onChange={(e) => setEditedAnnouncement({ ...editedAnnouncement, type: e.target.value })}
                                className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none cursor-pointer"
                            >
                                <option value="info">Info (Blue)</option>
                                <option value="warning">Warning (Yellow)</option>
                                <option value="success">Success (Green)</option>
                                <option value="error">Error (Red)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Visibility</label>
                            <button
                                onClick={() => setEditedAnnouncement({ ...editedAnnouncement, visible: !editedAnnouncement.visible })}
                                className={`w-full p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${editedAnnouncement.visible
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                                    }`}
                            >
                                {editedAnnouncement.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                {editedAnnouncement.visible ? 'Visible' : 'Hidden'}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-xl font-bold shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        {isSaving ? "Saving to Blockchain..." : "Save Announcement"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================
// NEWS TAB
// ============================================

function NewsTab() {
    const { news, updateNews, showSuccessToast, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [newsItems, setNewsItems] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        id: Date.now(),
        title: '',
        message: '',
        date: new Date().toISOString().split('T')[0],
        type: 'info'
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        if (news && Array.isArray(news)) {
            setNewsItems(news);
        }
    }, [news]);

    const handleAddItem = () => {
        if (!formData.title || !formData.message) {
            toast.error("Title and Message are required");
            return;
        }

        if (editingId !== null) {
            setNewsItems(newsItems.map(item => item.id === editingId ? { ...formData, id: editingId } : item));
            setEditingId(null);
            toast.success("Item updated in list");
        } else {
            setNewsItems([...newsItems, { ...formData, id: Date.now() }]);
            toast.success("Item added to list");
        }

        // Reset local form
        setFormData({
            id: Date.now(),
            title: '',
            message: '',
            date: new Date().toISOString().split('T')[0],
            type: 'info'
        });
    };

    const handleEditItem = (item) => {
        setFormData(item);
        setEditingId(item.id);
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const handleDeleteItem = (id) => {
        setNewsItems(newsItems.filter(item => item.id !== id));
        toast.success("Item removed from list");
    };

    const handleSave = async () => {
        if (newsItems.length === 0) {
            if (!window.confirm("Save empty news list?")) return;
        }

        setIsSaving(true);
        const tid = toast.loading("Saving news to blockchain...");
        try {
            // Auto-JSON Generation
            const hash = await updateNews(newsItems);
            showSuccessToast("News Updated!", hash);
            toast.dismiss(tid);
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Form Section */}
            <div className="glass-card p-8 bg-green-950/10 border border-green-500/10">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Newspaper className="w-6 h-6 text-green-500" /> {editingId ? 'Edit News Item' : 'Add News Item'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                        <input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Massive Airdrop Coming!"
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-green-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label>
                        <textarea
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            placeholder="Detail message..."
                            rows={3}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-green-500/50 outline-none transition-all resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-green-500/50 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-green-500/50 outline-none cursor-pointer"
                        >
                            <option value="info">Info</option>
                            <option value="success">Success</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleAddItem}
                        className="flex-1 bg-green-600 hover:bg-green-500 p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {editingId ? <CheckCircle className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                        {editingId ? 'Update Item' : 'Add to List'}
                    </button>
                    {editingId && (
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setFormData({ id: Date.now(), title: '', message: '', date: new Date().toISOString().split('T')[0], type: 'info' });
                            }}
                            className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-bold transition-all"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* List Management Section */}
            <div className="glass-card p-8 bg-slate-900/40">
                <h3 className="text-xl font-bold text-white mb-6">Manage News List ({newsItems.length})</h3>

                <div className="space-y-3">
                    {newsItems.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-4">No news items in list.</p>
                    ) : (
                        newsItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-white/5">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h4 className="text-white font-bold truncate">{item.title}</h4>
                                    <p className="text-slate-500 text-xs flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${item.type === 'info' ? 'bg-blue-500' :
                                            item.type === 'success' ? 'bg-green-500' :
                                                item.type === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                            }`} />
                                        {item.date} • {item.type}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditItem(item)}
                                        className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-xl font-black shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                >
                    <Save className="w-5 h-5" />
                    {isSaving ? "Syncing to Blockchain..." : "Push Entire List to CMS"}
                </button>
            </div>
        </div>
    );
}

// ======================== TAB COMPONENTS ========================

function PoolTab({ balance, onDistribute, ethPrice, settings, onUpdateSettings }) {
    const [isBusy, setIsBusy] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Local form state
    const [formData, setFormData] = useState({
        targetUSDC: settings?.targetUSDC || 5000,
        claimTimestamp: settings?.claimTimestamp || 0
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                targetUSDC: settings.targetUSDC || 5000,
                claimTimestamp: settings.claimTimestamp || 0
            });
        }
    }, [settings]);

    const currentETH = parseFloat(formatEther(balance));
    const currentUSDC = currentETH * ethPrice;
    const progress = Math.min((currentUSDC / formData.targetUSDC) * 100, 100);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating pool settings...");
        try {
            await onUpdateSettings(formData);
            toast.success("Pool Settings Updated!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || "Update failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDistribute = async () => {
        if (!window.confirm("Open Community Claim? This will lock the current balance for distribution.")) return;

        setIsBusy(true);
        const tid = toast.loading("Processing distribution...");
        try {
            const hash = await onDistribute();
            toast.success("Community Rewards unlocked!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || "Distribution failed", { id: tid });
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Main Stats Card */}
            <div className="glass-card p-10 bg-gradient-to-br from-indigo-950/40 to-slate-900 border-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                    <Database className="w-64 h-64 text-indigo-500" />
                </div>

                <div className="relative z-10 text-center">
                    <Database className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                    <p className="text-slate-400 uppercase font-black tracking-widest text-xs mb-2">Total SBT Community Pool</p>
                    <h2 className="text-6xl font-black text-white mb-2">
                        {currentETH.toFixed(4)} <span className="text-2xl text-slate-500">ETH</span>
                    </h2>
                    <div className="flex items-center justify-center gap-2 mb-8 text-indigo-400 font-mono font-bold">
                        <TrendingUp className="w-4 h-4" />
                        ~${currentUSDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                        <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full ml-2">@ ${ethPrice}/ETH</span>
                    </div>

                    <button
                        onClick={handleDistribute}
                        disabled={isBusy || balance === 0n}
                        className={`px-12 py-4 rounded-2xl font-black text-lg shadow-2xl transition-all ${balance > 0n
                            ? 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-indigo-500/30'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                    >
                        {isBusy ? "Opening..." : "Open Community Claim"}
                    </button>
                    <p className="text-xs text-slate-500 mt-6 italic max-w-lg mx-auto leading-relaxed">
                        "Membuka klaim akan membagi saldo di atas ke tier Bronze, Silver, dan Gold berdasarkan weight yang berlaku."
                    </p>
                </div>
            </div>

            {/* Pool Settings Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration form */}
                <div className="glass-card p-8 bg-slate-900/40">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <RefreshCw className={`w-5 h-5 text-indigo-400 ${isSaving ? 'animate-spin' : ''}`} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Pool Settings</h3>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Pool (USDC)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                <input
                                    type="number"
                                    value={formData.targetUSDC}
                                    onChange={(e) => setFormData({ ...formData, targetUSDC: Number(e.target.value) })}
                                    className="w-full bg-black/40 border border-white/5 p-3 pl-8 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Claim Schedule (Automatic Activation)</label>
                            <input
                                type="datetime-local"
                                value={formData.claimTimestamp ? new Date(formData.claimTimestamp).toISOString().slice(0, 16) : ''}
                                onChange={(e) => setFormData({ ...formData, claimTimestamp: new Date(e.target.value).getTime() })}
                                className="w-full bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all cursor-pointer"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-indigo-500/20"
                            >
                                Update Settings
                            </button>
                            <button
                                onClick={() => setFormData({ targetUSDC: settings?.targetUSDC || 5000, claimTimestamp: settings?.claimTimestamp || 0 })}
                                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-slate-300 transition-all border border-white/5"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress Visualizer */}
                <div className="glass-card p-8 bg-indigo-600/5 border border-indigo-500/10 flex flex-col justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-6">Target Completion</h4>

                        <div className="mb-8">
                            <div className="flex justify-between items-end mb-3">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Current Status</p>
                                    <p className="text-3xl font-black text-white">${currentUSDC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Target</p>
                                    <p className="text-xl font-bold text-slate-400">${formData.targetUSDC.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Modern Progress Bar */}
                            <div className="h-4 bg-black/40 rounded-full border border-white/5 p-1 relative overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                                />
                            </div>
                            <p className="text-[11px] text-right mt-2 text-indigo-400 font-bold">{progress.toFixed(1)}% Completed</p>
                        </div>
                    </div>

                    <div className="p-4 bg-black/30 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center">
                                <TimerIcon className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black">Next Claim Phase</p>
                                <p className="text-sm font-bold text-white">
                                    {formData.claimTimestamp
                                        ? new Date(formData.claimTimestamp).toLocaleString()
                                        : 'Manual Execution Only'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TierTab({ onUpdate }) {
    const [targetUser, setTargetUser] = useState('');
    const [selectedTier, setSelectedTier] = useState(1); // 1 = Bronze
    const [isUpdating, setIsUpdating] = useState(false);

    const levels = ["None", "Bronze", "Silver", "Gold"];

    const handleTierUpdate = async () => {
        if (!targetUser.startsWith('0x')) return toast.error("Invalid address");

        setIsUpdating(true);
        const tid = toast.loading(`Updating to ${levels[selectedTier]}...`);
        try {
            await onUpdate(targetUser, selectedTier);
            toast.success("Tier updated!", { id: tid });
            setTargetUser('');
        } catch (e) {
            toast.error(e.shortMessage || "Update failed", { id: tid });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="glass-card p-8 bg-slate-900/40">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Users className="w-5 h-5 text-yellow-500" /> Soulbound Tier Management
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-tighter mb-2">User Wallet Address</label>
                    <input
                        value={targetUser}
                        onChange={(e) => setTargetUser(e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-yellow-500/50 outline-none transition-all"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-tighter mb-2">Assign Tier</label>
                    <select
                        value={selectedTier}
                        onChange={(e) => setSelectedTier(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-yellow-500/50 outline-none appearance-none cursor-pointer"
                    >
                        <option value={1}>Bronze (20% share)</option>
                        <option value={2}>Silver (30% share)</option>
                        <option value={3}>Gold (50% share)</option>
                    </select>
                </div>

                <button
                    onClick={handleTierUpdate}
                    disabled={isUpdating || !targetUser}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-800 disabled:text-slate-600 p-3 rounded-xl font-bold shadow-lg shadow-yellow-500/10 transition-all"
                >
                    {isUpdating ? "Processing..." : "Assign Soulbound"}
                </button>
            </div>

            <p className="mt-6 text-[11px] text-slate-500 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                "Penyesuaian tier dilakukan berdasarkan poin aktivitas mingguan. Investor yang mencapai milestone tertentu berhak mendapatkan jatah pool yang lebih besar."
            </p>
        </div>
    );
}

function TreasuryTab({ onWithdraw }) {
    const [amount, setAmount] = useState('0.1');
    const [isBusy, setIsBusy] = useState(false);
    const SAFE_MULTISIG = "0xAfB7C7E711418EFD744f74B4D92c2b91B9668fAa";

    const handleWithdraw = async () => {
        if (!window.confirm(`Withdraw ${amount} ETH to Safe Multisig (${SAFE_MULTISIG})?`)) return;

        setIsBusy(true);
        const tid = toast.loading("Processing treasury withdrawal...");
        try {
            await onWithdraw(parseEther(amount));
            toast.success("Treasury fueled!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || "Withdrawal failed", { id: tid });
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="glass-card p-10 bg-emerald-950/10 border border-emerald-500/10">
            <div className="flex flex-col md:flex-row gap-10 items-center">
                <div className="p-8 bg-emerald-500/10 rounded-3xl border border-emerald-500/20">
                    <Landmark className="w-20 h-20 text-emerald-400" />
                </div>

                <div className="flex-1">
                    <h3 className="text-2xl font-black text-white mb-2">Treasury Controls</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-md">
                        Accumulated reserve (10%) for long-term project stability.
                        Funds are sent directly to the specified **Safe Multisig** for maximum security.
                    </p>

                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-slate-900/50 border border-emerald-500/20 p-4 rounded-2xl text-white text-xl font-bold focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={handleWithdraw}
                            className="bg-emerald-600 hover:bg-emerald-500 p-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all"
                        >
                            <ArrowUpRight className="w-8 h-8 text-white" />
                        </button>
                    </div>

                    <div className="mt-4 p-3 bg-slate-900/50 rounded-xl border border-white/5">
                        <p className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                            Target SAFE: <span className="text-emerald-400 truncate">{SAFE_MULTISIG}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ContentTab() {
    const { featureCards, announcement, updateFeatureCards, updateAnnouncement, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [cards, setCards] = useState([]);

    // Card Form State
    const [cardForm, setCardForm] = useState({
        id: Date.now(),
        title: '',
        description: '',
        icon: 'Shield',
        color: 'indigo',
        link: '/',
        linkText: 'Learn More',
        visible: true
    });
    const [editingCardId, setEditingCardId] = useState(null);

    useEffect(() => {
        if (featureCards && Array.isArray(featureCards)) {
            setCards(featureCards);
        }
    }, [featureCards]);

    const handleAddCard = () => {
        if (!cardForm.title || !cardForm.description) {
            toast.error("Title and Description are required");
            return;
        }

        if (editingCardId !== null) {
            setCards(cards.map(c => c.id === editingCardId ? { ...cardForm, id: editingCardId } : c));
            setEditingCardId(null);
            toast.success("Card updated in list");
        } else {
            setCards([...cards, { ...cardForm, id: Date.now() }]);
            toast.success("Card added to list");
        }

        setCardForm({
            id: Date.now(),
            title: '',
            description: '',
            icon: 'Shield',
            color: 'indigo',
            link: '/',
            linkText: 'Learn More',
            visible: true
        });
    };

    const handleEditCard = (card) => {
        setCardForm(card);
        setEditingCardId(card.id);
        window.scrollTo({ top: 400, behavior: 'smooth' });
    };

    const handleDeleteCard = (id) => {
        setCards(cards.filter(c => c.id !== id));
        toast.success("Card removed from list");
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        const tid = toast.loading("Saving feature cards to blockchain...");
        try {
            // Auto-JSON Generation
            const hash = await updateFeatureCards(cards);
            toast.success(
                `Feature Cards Updated! View on BaseScan: https://sepolia.basescan.org/tx/${hash}`,
                { id: tid, duration: 6000 }
            );
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Form Section */}
            <div className="glass-card p-8 bg-indigo-950/10 border border-indigo-500/10">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Database className="w-6 h-6 text-indigo-500" /> {editingCardId ? 'Edit Feature Card' : 'Add Feature Card'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                        <input
                            value={cardForm.title}
                            onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Icon (Lucide Name)</label>
                        <input
                            value={cardForm.icon}
                            onChange={(e) => setCardForm({ ...cardForm, icon: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                        <textarea
                            value={cardForm.description}
                            onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                            rows={2}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Link Path</label>
                        <input
                            value={cardForm.link}
                            onChange={(e) => setCardForm({ ...cardForm, link: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Link Text</label>
                        <input
                            value={cardForm.linkText}
                            onChange={(e) => setCardForm({ ...cardForm, linkText: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Theme Color</label>
                        <select
                            value={cardForm.color}
                            onChange={(e) => setCardForm({ ...cardForm, color: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white"
                        >
                            <option value="indigo">Indigo</option>
                            <option value="purple">Purple</option>
                            <option value="blue">Blue</option>
                            <option value="emerald">Emerald</option>
                            <option value="yellow">Yellow</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setCardForm({ ...cardForm, visible: !cardForm.visible })}
                            className={`w-full p-3 rounded-xl font-bold flex items-center justify-center gap-2 ${cardForm.visible ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-500'
                                }`}
                        >
                            {cardForm.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {cardForm.visible ? 'Visible' : 'Hidden'}
                        </button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleAddCard}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {editingCardId ? <CheckCircle className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                        {editingCardId ? 'Update Card' : 'Add to List'}
                    </button>
                    {editingCardId && (
                        <button
                            onClick={() => {
                                setEditingCardId(null);
                                setCardForm({ id: Date.now(), title: '', description: '', icon: 'Shield', color: 'indigo', link: '/', linkText: 'Learn More', visible: true });
                            }}
                            className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-bold"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* List Management Section */}
            <div className="glass-card p-8 bg-slate-900/40">
                <h3 className="text-xl font-bold text-white mb-6">Manage Feature Cards ({cards.length})</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cards.length === 0 ? (
                        <p className="col-span-2 text-slate-500 italic text-center py-4">No cards in list.</p>
                    ) : (
                        cards.map((card) => (
                            <div key={card.id} className="p-4 bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-${card.color}-500/10`}>
                                        <Database className={`w-5 h-5 text-${card.color}-400`} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm">{card.title}</h4>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{card.visible ? 'Visible' : 'Hidden'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditCard(card)}
                                        className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCard(card.id)}
                                        className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <button
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-xl font-black shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                >
                    <Save className="w-5 h-5" />
                    {isSaving ? "Syncing to Blockchain..." : "Push All Cards to CMS"}
                </button>
            </div>
        </div>
    );
}

