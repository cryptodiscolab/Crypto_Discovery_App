import React from 'react';
import { Plus, Zap, Shield, Send, RefreshCw, Repeat, MessageCircle, Heart, Twitter, Share2 } from 'lucide-react';

const PLATFORMS = {
    'Farcaster': { id: 'farcaster', domain: 'https://warpcast.com/...', icon: <Share2 className="w-4 h-4" /> },
    'X': { id: 'x', domain: 'https://x.com/...', icon: <Twitter className="w-4 h-4" /> },
    'Base App': { id: 'base', domain: 'https://base.app/...', icon: <img src="/base-logo.png" className="w-4 h-4 grayscale opacity-50" alt="Base" /> }
};

const ACTIONS = {
    'Follow': { id: 'follow', label: 'Follow', icon: <Plus className="w-3 h-3" /> },
    'Like': { id: 'like', label: 'Like', icon: <Heart className="w-3 h-3" /> },
    'Recast/Repost': { id: 'recast', label: 'Recast/Repost', icon: <Repeat className="w-3 h-3" /> },
    'Quote': { id: 'quote', label: 'Quote', icon: <Repeat className="w-3 h-3 rotate-90" /> },
    'Comment': { id: 'comment', label: 'Comment', icon: <MessageCircle className="w-3 h-3" /> },
    'Transaction': { id: 'transaction', label: 'Transaction', icon: <Zap className="w-3 h-3" /> }
};

export function TaskBatchCreatorSection({ tasksBatch, onUpdateTask, onDeploy, isSaving }) {
    return (
        <div className="glass-card p-8 bg-purple-950/10 border border-purple-500/10 shadow-2xl relative rounded-3xl">
            <div className="mb-6">
                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                    <Plus className="w-6 h-6 text-purple-500" /> TASK GENERATOR
                </h3>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold font-mono">Build internal organic tasks</p>
            </div>

            <div className="space-y-6 mb-10">
                {tasksBatch.map((task, idx) => (
                    <div key={idx} className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 relative group transition-all hover:bg-slate-900/60 hover:border-purple-500/20">
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-black text-slate-500 group-hover:text-purple-400 group-hover:border-purple-500/50 transition-all z-10 shadow-lg">
                            {idx + 1}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-3 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Platform</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                            {PLATFORMS[task.platform]?.icon}
                                        </div>
                                        <select
                                            value={task.platform}
                                            onChange={(e) => onUpdateTask(idx, 'platform', e.target.value)}
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
                                            onChange={(e) => onUpdateTask(idx, 'action', e.target.value)}
                                            className="w-full bg-slate-950/50 border border-white/5 p-2 pl-9 rounded-xl text-white text-xs font-bold focus:border-purple-500/50 outline-none appearance-none cursor-pointer"
                                        >
                                            {Object.keys(ACTIONS).map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-5 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Task Name</label>
                                    <input
                                        value={task.title}
                                        onChange={(e) => onUpdateTask(idx, 'title', e.target.value)}
                                        placeholder="Auto-filled based on action..."
                                        className="w-full bg-slate-950/50 border border-white/5 p-3 rounded-xl text-white font-bold placeholder:text-slate-700 focus:border-purple-500/50 outline-none transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Target Link</label>
                                    <input
                                        value={task.link}
                                        onChange={(e) => onUpdateTask(idx, 'link', e.target.value)}
                                        placeholder={PLATFORMS[task.platform]?.domain || "https://..."}
                                        className="w-full bg-slate-950/30 border border-white/5 p-2 px-3 rounded-lg text-slate-400 text-xs italic focus:border-purple-500/30 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="lg:col-span-4 grid grid-cols-2 gap-4 h-fit">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Points (Locked)</label>
                                    <div className="relative font-mono">
                                        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-yellow-500" />
                                        <input
                                            type="number"
                                            readOnly
                                            value={task.baseReward}
                                            className="w-full bg-slate-900 border border-white/5 p-3 pl-8 rounded-xl text-slate-400 font-black text-sm outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Verification</label>
                                    <button
                                        onClick={() => onUpdateTask(idx, 'requiresVerification', !task.requiresVerification)}
                                        className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${task.requiresVerification ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-slate-950/50 border-white/5 text-slate-50'}`}
                                    >
                                        <Shield className={`w-4 h-4 ${task.requiresVerification ? 'animate-pulse' : ''}`} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">
                                            {task.requiresVerification ? 'Auto-Verify ON' : 'Manual Claim'}
                                        </span>
                                    </button>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Min Tier</label>
                                    <select
                                        value={task.minTier}
                                        onChange={(e) => onUpdateTask(idx, 'minTier', Number(e.target.value))}
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
                    onClick={onDeploy}
                    disabled={isSaving}
                    className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:brightness-110 disabled:opacity-50 p-5 rounded-2xl font-black text-white text-lg tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-purple-500/20 active:scale-[0.98]"
                >
                    {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                    DEPLOY BATCH TO BASE NETWORK
                </button>
            </div>
        </div>
    );
}
