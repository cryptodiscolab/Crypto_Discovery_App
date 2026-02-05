import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Award, Landmark, Users, ArrowUpRight, DollarSign, Database, CheckCircle, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useSBT } from '../hooks/useSBT';
import { formatEther, parseEther } from 'ethers';
import toast from 'react-hot-toast';

export function AdminPage() {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { totalPoolBalance, contractOwner, distributePool, updateTier, withdrawTreasury, refetchAll } = useSBT();
    const [activeTab, setActiveTab] = useState('pool');
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);

    // 1. Security & Access Control
    useEffect(() => {
        if (!isConnected) {
            setLoading(false);
            return;
        }

        if (contractOwner && address) {
            const hasAccess = address.toLowerCase() === contractOwner.toLowerCase();
            setIsOwner(hasAccess);
            setLoading(false);

            if (!hasAccess && !loading) {
                toast.error("Unauthorized: Owner access only");
                navigate('/profile');
            }
        }
    }, [address, contractOwner, isConnected, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Shield className="w-12 h-12 text-indigo-500 animate-pulse" />
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-slate-400">This module is reserved for the contract owner only.</p>
                <button onClick={() => navigate('/')} className="mt-6 text-blue-400 hover:underline">Return to Home</button>
            </div>
        );
    }

    const tabs = [
        { id: 'pool', label: 'SBT Master', icon: Database, color: 'indigo' },
        { id: 'tiers', label: 'Tier Control', icon: Award, color: 'yellow' },
        { id: 'treasury', label: 'Treasury Safe', icon: Landmark, color: 'emerald' },
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
                            <h1 className="text-3xl font-black text-white">Owner Portal</h1>
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

                {/* Tab Navigation */}
                <div className="flex p-1.5 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/5 mb-8 w-fit mx-auto md:mx-0">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${isActive
                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                                {tab.label}
                            </button>
                        );
                    })}
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
                        {activeTab === 'pool' && <PoolTab balance={totalPoolBalance} onDistribute={distributePool} />}
                        {activeTab === 'tiers' && <TierTab onUpdate={updateTier} />}
                        {activeTab === 'treasury' && <TreasuryTab onWithdraw={withdrawTreasury} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// ======================== TAB COMPONENTS ========================

function PoolTab({ balance, onDistribute }) {
    const [isBusy, setIsBusy] = useState(false);

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
        <div className="space-y-6">
            <div className="glass-card p-10 bg-gradient-to-br from-slate-900 to-indigo-950/20 text-center">
                <Database className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                <p className="text-slate-400 uppercase font-black tracking-widest text-xs mb-2">Total SBT Community Pool</p>
                <h2 className="text-6xl font-black text-white mb-6">
                    {parseFloat(formatEther(balance)).toFixed(4)} <span className="text-2xl text-slate-500 decoration-transparent">ETH</span>
                </h2>

                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={handleDistribute}
                        disabled={isBusy || balance === 0n}
                        className={`px-10 py-4 rounded-2xl font-black text-lg shadow-2xl transition-all ${balance > 0n
                            ? 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-indigo-500/20'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                    >
                        {isBusy ? "Opening..." : "Open Community Claim"}
                    </button>
                    <p className="text-xs text-slate-500 max-w-sm italic">
                        "Membuka klaim akan membagi saldo di atas ke tier Bronze, Silver, dan Gold berdasarkan weight yang berlaku."
                    </p>
                    <p className="text-[11px] text-indigo-400/50 mt-2 font-medium">
                        (Note: Rewards distributed in ETH based on current USD exchange rate)
                    </p>
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
