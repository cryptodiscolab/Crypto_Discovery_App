import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Zap, Clock, Shield, Award, ExternalLink, RefreshCw, Send, List } from 'lucide-react';
import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { V12_ABI } from '../../shared/constants/abis';
import toast from 'react-hot-toast';

const V12_ADDRESS = import.meta.env.VITE_V12_CONTRACT_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS;

export function TaskManagerTab() {
    const { writeContractAsync } = useWriteContract();
    const [isSaving, setIsSaving] = useState(false);

    // Add Task Form State
    const [formData, setFormData] = useState({
        baseReward: 100,
        cooldown: 86400, // 24h
        minTier: 0,
        title: '',
        link: '',
        requiresVerification: true
    });

    const { data: nextTaskId, refetch: refetchCount } = useReadContract({
        address: V12_ADDRESS,
        abi: V12_ABI,
        functionName: 'nextTaskId',
    });

    const handleAddTask = async () => {
        if (!formData.title || !formData.link) {
            toast.error("Title and Link are required");
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Adding task to blockchain...");
        try {
            await writeContractAsync({
                address: V12_ADDRESS,
                abi: V12_ABI,
                functionName: 'addTask',
                args: [
                    BigInt(formData.baseReward),
                    BigInt(formData.cooldown),
                    formData.minTier,
                    formData.title,
                    formData.link,
                    formData.requiresVerification
                ],
            });
            toast.success("Task Added Successfully!", { id: tid });
            setFormData({
                baseReward: 100,
                cooldown: 86400,
                minTier: 0,
                title: '',
                link: '',
                requiresVerification: true
            });
            refetchCount();
        } catch (e) {
            toast.error(e.shortMessage || "Action failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Create Task Section */}
            <div className="glass-card p-8 bg-purple-950/10 border border-purple-500/10">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Plus className="w-6 h-6 text-purple-500" /> Define New Task
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Task Title</label>
                        <input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g. Follow us on Twitter"
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-purple-500/50 outline-none transition-all"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Task Link (Social/Action)</label>
                        <input
                            value={formData.link}
                            onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-purple-500/50 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Base Reward (Points)</label>
                        <div className="relative">
                            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
                            <input
                                type="number"
                                value={formData.baseReward}
                                onChange={(e) => setFormData({ ...formData, baseReward: Number(e.target.value) })}
                                className="w-full bg-slate-900 border border-white/5 p-3 pl-10 rounded-xl text-white transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cooldown (Seconds)</label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                            <input
                                type="number"
                                value={formData.cooldown}
                                onChange={(e) => setFormData({ ...formData, cooldown: Number(e.target.value) })}
                                className="w-full bg-slate-900 border border-white/5 p-3 pl-10 rounded-xl text-white transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Min Tier Required</label>
                        <select
                            value={formData.minTier}
                            onChange={(e) => setFormData({ ...formData, minTier: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white transition-all"
                        >
                            <option value={0}>Tier 0 (None)</option>
                            <option value={1}>Tier 1 (Bronze)</option>
                            <option value={2}>Tier 2 (Silver)</option>
                            <option value={3}>Tier 3 (Gold)</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                        <button
                            onClick={() => setFormData({ ...formData, requiresVerification: !formData.requiresVerification })}
                            className={`flex-1 p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${formData.requiresVerification ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-500'}`}
                        >
                            <Shield className="w-4 h-4" />
                            {formData.requiresVerification ? "Verification Required" : "Auto-Complete"}
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleAddTask}
                    disabled={isSaving}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 p-4 rounded-xl font-black text-white transition-all flex items-center justify-center gap-3 shadow-xl shadow-purple-500/20"
                >
                    {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Deploy Task to Chain
                </button>
            </div>

            {/* Task Tracking Stats */}
            <div className="glass-card p-8 bg-slate-900/40">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <List className="w-5 h-5 text-purple-400" /> Task Statistics
                    </h3>
                    <div className="bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 text-[10px] font-black text-purple-400 uppercase tracking-widest">
                        Total Tasks: {nextTaskId ? nextTaskId.toString() : '0'}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Last Task ID</p>
                        <p className="text-2xl font-black text-white">#{nextTaskId ? (Number(nextTaskId) - 1).toString() : 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Contract Status</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <p className="text-sm font-bold text-green-400">Online & Ready</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
