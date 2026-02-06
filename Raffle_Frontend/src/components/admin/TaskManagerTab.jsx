import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Zap, Clock, Shield, Award, ExternalLink, RefreshCw, Send, List, Share2, Twitter, MessageCircle, Heart, Repeat } from 'lucide-react';
import { useWriteContract, useReadContract, useAccount } from 'wagmi';
import { V12_ABI } from '../../shared/constants/abis';
import { supabase } from '../../dailyAppLogic';
import toast from 'react-hot-toast';

const V12_ADDRESS = import.meta.env.VITE_V12_CONTRACT_ADDRESS || "0xEF8ab11E070359B9C0aA367656893B029c1d04d4";

const PLATFORMS = {
    'Farcaster': { domain: 'https://warpcast.com/...', icon: <Share2 className="w-4 h-4" /> },
    'X': { domain: 'https://x.com/...', icon: <Twitter className="w-4 h-4" /> },
    'Base App': { domain: 'https://base.app/...', icon: <img src="/base-logo.png" className="w-4 h-4 grayscale opacity-50" alt="Base" /> }
};

const ACTIONS = {
    'Follow': { label: 'Follow', icon: <Plus className="w-3 h-3" /> },
    'Like': { label: 'Like', icon: <Heart className="w-3 h-3" /> },
    'Recast/Repost': { label: 'Recast/Repost', icon: <Repeat className="w-3 h-3" /> },
    'Comment': { label: 'Comment', icon: <MessageCircle className="w-3 h-3" /> }
};

export function TaskManagerTab() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [isSaving, setIsSaving] = useState(false);

    // Initial state for 3 tasks
    const [tasksBatch, setTasksBatch] = useState([
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true }
    ]);

    const [pointSettings, setPointSettings] = useState([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);

    const { data: nextTaskId, refetch: refetchCount } = useReadContract({
        address: V12_ADDRESS,
        abi: V12_ABI,
        functionName: 'nextTaskId',
    });

    // 1. Fetch Global Point Settings (The Source of Truth)
    useEffect(() => {
        const fetchPoints = async () => {
            try {
                const { data, error } = await supabase
                    .from('point_settings')
                    .select('*')
                    .eq('is_active', true);

                if (error) throw error;
                if (data) {
                    setPointSettings(data);

                    // Sync initial points for the 3 default tasks
                    setTasksBatch(prev => prev.map(task => ({
                        ...task,
                        baseReward: getGlobalPoints(task.platform, task.action, data)
                    })));
                }
            } catch (err) {
                console.error('[FetchPoints Error]', err);
                toast.error("Gagal mengambil data poin!");
            } finally {
                setIsLoadingPoints(false);
            }
        };
        fetchPoints();
    }, []);

    // 2. Map Dynamic Points to Local Form
    const getGlobalPoints = (platform, action, currentSettings = pointSettings) => {
        // Mapping logic: e.g., Farcaster + Like -> task_fc_like
        const platMap = { 'Farcaster': 'fc', 'X': 'x', 'Base App': 'base' };
        const actMap = {
            'Follow': 'follow',
            'Like': 'like',
            'Recast/Repost': 'recast',
            'Comment': 'comment',
            'Quote': 'quote'
        };

        const platKey = platMap[platform] || platform.toLowerCase();
        const actKey = actMap[action] || action.toLowerCase();
        const key = `task_${platKey}_${actKey}`;

        const setting = currentSettings.find(s => s.activity_key === key);
        return setting ? setting.points_value : 0;
    };

    const handleBatchSave = async () => {
        const validTasks = tasksBatch.filter(t => t.title.trim() !== '');

        if (validTasks.length === 0) {
            toast.error("Isi minimal satu Nama Task!");
            return;
        }

        setIsSaving(true);
        const tid = toast.loading(`Mendaftarkan ${validTasks.length} task ke blockchain...`);

        try {
            for (let i = 0; i < validTasks.length; i++) {
                const task = validTasks[i];
                toast.loading(`Memproses Task ${i + 1}/${validTasks.length}: ${task.title}`, { id: tid });

                await writeContractAsync({
                    address: V12_ADDRESS,
                    abi: V12_ABI,
                    functionName: 'addTask',
                    args: [
                        BigInt(task.baseReward),
                        BigInt(task.cooldown),
                        task.minTier,
                        task.title,
                        task.link || 'https://warpcast.com/CryptoDisco',
                        task.requiresVerification
                    ],
                });

                // Audit Log: Record task deployment
                try {
                    await supabase.from('admin_audit_logs').insert([{
                        admin_address: address || '0x0',
                        action: 'DEPLOY_BATCH_TASK',
                        details: {
                            task_name: task.title,
                            points: task.baseReward,
                            platform: task.platform,
                            action: task.action,
                            min_tier: task.minTier
                        }
                    }]);
                } catch (logErr) {
                    console.warn('[Audit Log] Failed to record deployment:', logErr);
                }
            }

            toast.success("Semua task berhasil didaftarkan!", { id: tid });

            // Reset to default
            setTasksBatch([
                { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true },
                { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true },
                { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true }
            ]);
            refetchCount();
        } catch (e) {
            console.error("Batch Deployment Error:", e);
            toast.error(e.shortMessage || e.message || "Gagal mendaftarkan task", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const updateTaskLine = (index, field, value) => {
        const newBatch = [...tasksBatch];
        newBatch[index][field] = value;

        // Auto-fill title and LOCKED points logic
        if (field === 'platform' || field === 'action') {
            const platform = field === 'platform' ? value : newBatch[index].platform;
            const action = field === 'action' ? value : newBatch[index].action;
            newBatch[index].title = `${action} our post on ${platform}`;

            // Lock points from global settings
            if (!isLoadingPoints) {
                newBatch[index].baseReward = getGlobalPoints(platform, action);
            }
        }

        setTasksBatch(newBatch);
    };

    return (
        <div className="space-y-8">
            <div className="glass-card p-8 bg-purple-950/10 border border-purple-500/10 shadow-2xl overflow-hidden relative">
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />

                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                    <div>
                        <h3 className="text-2xl font-black text-white flex items-center gap-2">
                            <Plus className="w-6 h-6 text-purple-500" /> SMART BATCH CREATOR
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Manage multiple sponsorship tasks with one click</p>
                    </div>
                </div>

                <div className="space-y-6 mb-10">
                    {tasksBatch.map((task, idx) => (
                        <div key={idx} className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 relative group transition-all hover:bg-slate-900/60 hover:border-purple-500/20">
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-black text-slate-500 group-hover:text-purple-400 group-hover:border-purple-500/50 transition-all z-10 shadow-lg">
                                {idx + 1}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Platform & Action Dropdowns */}
                                <div className="lg:col-span-3 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Platform</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                {PLATFORMS[task.platform]?.icon}
                                            </div>
                                            <select
                                                value={task.platform}
                                                onChange={(e) => updateTaskLine(idx, 'platform', e.target.value)}
                                                className="w-full bg-slate-950/50 border border-white/5 p-2 pl-9 rounded-xl text-white text-xs font-bold focus:border-purple-500/50 outline-none appearance-none cursor-pointer"
                                            >
                                                {Object.keys(PLATFORMS).map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Action</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                {ACTIONS[task.action]?.icon}
                                            </div>
                                            <select
                                                value={task.action}
                                                onChange={(e) => updateTaskLine(idx, 'action', e.target.value)}
                                                className="w-full bg-slate-950/50 border border-white/5 p-2 pl-9 rounded-xl text-white text-xs font-bold focus:border-purple-500/50 outline-none appearance-none cursor-pointer"
                                            >
                                                {Object.keys(ACTIONS).map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Task Details */}
                                <div className="lg:col-span-5 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Task Name</label>
                                        <input
                                            value={task.title}
                                            onChange={(e) => updateTaskLine(idx, 'title', e.target.value)}
                                            placeholder="Auto-filled based on action..."
                                            className="w-full bg-slate-950/50 border border-white/5 p-3 rounded-xl text-white font-bold placeholder:text-slate-700 focus:border-purple-500/50 outline-none transition-all text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Target Link</label>
                                        <input
                                            value={task.link}
                                            onChange={(e) => updateTaskLine(idx, 'link', e.target.value)}
                                            placeholder={PLATFORMS[task.platform]?.domain || "https://..."}
                                            className="w-full bg-slate-950/30 border border-white/5 p-2 px-3 rounded-lg text-slate-400 text-xs italic focus:border-purple-500/30 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Pts & Tier */}
                                <div className="lg:col-span-4 grid grid-cols-2 gap-4 h-fit">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Points (Locked)</label>
                                        <div className="relative">
                                            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-yellow-500" />
                                            <input
                                                type="number"
                                                readOnly
                                                value={task.baseReward}
                                                className="w-full bg-slate-900 border border-white/5 p-3 pl-8 rounded-xl text-slate-400 font-black text-sm outline-none cursor-not-allowed"
                                                title="Poin dikunci oleh kebijakan Admin SBT"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Min Tier</label>
                                        <select
                                            value={task.minTier}
                                            onChange={(e) => updateTaskLine(idx, 'minTier', Number(e.target.value))}
                                            className="w-full bg-slate-950/50 border border-white/5 p-3 rounded-xl text-white font-bold text-xs focus:border-purple-500/50 outline-none cursor-pointer"
                                        >
                                            <option value={1}>Bronze</option>
                                            <option value={2}>Silver</option>
                                            <option value={3}>Gold</option>
                                            <option value={4}>Platinum</option>
                                            <option value={5}>Diamond</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-4">
                    <button
                        onClick={handleBatchSave}
                        disabled={isSaving}
                        className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:brightness-110 disabled:opacity-50 p-5 rounded-2xl font-black text-white text-lg tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-purple-500/20 active:scale-[0.98]"
                    >
                        {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                        DEPLOY BATCH TO BASE NETWORK
                    </button>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <Award className="w-3 h-3" /> Minimum Tier 1 Enforcement Active
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center text-center group transition-all hover:bg-slate-900/60">
                    <List className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Tasks Count</p>
                    <p className="text-3xl font-black text-white">{nextTaskId ? (Number(nextTaskId) - 1).toString() : '0'}</p>
                </div>

                <div className="glass-card p-6 bg-slate-900/40 border border-white/5 col-span-2 relative overflow-hidden group">
                    <div className="relative z-10 h-full flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-blue-400 group-hover:rotate-12 transition-transform" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Standard Task Window</p>
                        </div>
                        <p className="text-xl font-black text-white">24 HOUR COOLDOWN</p>
                        <p className="text-[10px] text-slate-600 mt-2 italic font-bold">Optimized for daily social engagements and community growth.</p>
                    </div>
                    <Award className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12 group-hover:rotate-0 transition-all duration-500" />
                </div>
            </div>
        </div>
    );
}
