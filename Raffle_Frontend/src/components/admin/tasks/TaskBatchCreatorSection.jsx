import React from 'react';
import { Plus, Zap, Shield, Send, RefreshCw, Repeat, MessageCircle, Heart, Twitter, Share2, Video, Instagram } from 'lucide-react';

const PLATFORMS = {
    'Farcaster': { id: 'farcaster', domain: 'https://warpcast.com/...', icon: <Share2 className="w-4 h-4" /> },
    'X': { id: 'x', domain: 'https://x.com/...', icon: <Twitter className="w-4 h-4" /> },
    'Base App': { id: 'base', domain: 'https://base.app/...', icon: <img src="/base-logo.png" className="w-4 h-4 grayscale opacity-50" alt="Base" /> },
    'TikTok': { id: 'tiktok', domain: 'https://tiktok.com/@...', icon: <Video className="w-4 h-4" /> },
    'Instagram': { id: 'instagram', domain: 'https://instagram.com/...', icon: <Instagram className="w-4 h-4" /> }
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
        <div className="glass-card p-10 bg-purple-950/5 border border-purple-500/10 rounded-[3rem] relative overflow-hidden group/main">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all duration-1000 group-hover/main:bg-purple-600/10" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/5 blur-[120px] rounded-full -ml-48 -mb-48" />

            <div className="flex flex-col md:flex-row items-center justify-between mb-12 relative">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-purple-600/20 flex items-center justify-center border border-purple-500/30 shadow-2xl shadow-purple-500/20">
                        <Plus className="w-8 h-8 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] leading-none">TASK <span className="text-purple-500">GENERATOR</span></h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Organic ecosystem operations</p>
                    </div>
                </div>
                <div className="mt-6 md:mt-0 px-6 py-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BATCH SIZE: {tasksBatch.length}</span>
                </div>
            </div>

            <div className="space-y-6 mb-12 relative">
                {tasksBatch.map((task, idx) => (
                    <div key={idx} className="glass-card p-8 bg-black/40 border border-white/5 rounded-[2.5rem] relative group transition-all duration-500 hover:border-purple-500/30 hover:bg-black/60">
                        <div className="absolute -left-4 top-8 w-10 h-10 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-[10px] font-black text-slate-500 group-hover:text-purple-400 group-hover:border-purple-500/50 transition-all z-10 shadow-2xl">
                            {idx + 1}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Metadata Column */}
                            <div className="lg:col-span-3 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Platform</label>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-purple-400 transition-colors">
                                            {PLATFORMS[task.platform]?.icon}
                                        </div>
                                        <select
                                            value={task.platform}
                                            onChange={(e) => onUpdateTask(idx, 'platform', e.target.value)}
                                            className="w-full bg-white/5 border border-white/5 p-4 pl-12 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest focus:border-purple-500/50 outline-none appearance-none cursor-pointer transition-all"
                                        >
                                            {Object.keys(PLATFORMS).map(p => <option key={p} value={p} className="bg-[#0a0a0c]">{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Action Type</label>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-purple-400 transition-colors">
                                            {ACTIONS[task.action]?.icon}
                                        </div>
                                        <select
                                            value={task.action}
                                            onChange={(e) => onUpdateTask(idx, 'action', e.target.value)}
                                            className="w-full bg-white/5 border border-white/5 p-4 pl-12 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest focus:border-purple-500/50 outline-none appearance-none cursor-pointer transition-all"
                                        >
                                            {Object.keys(ACTIONS).map(a => <option key={a} value={a} className="bg-[#0a0a0c]">{a}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Core Info Column */}
                            <div className="lg:col-span-5 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Task Title</label>
                                    <input
                                        value={task.title}
                                        onChange={(e) => onUpdateTask(idx, 'title', e.target.value)}
                                        placeholder="Auto-filled based on action..."
                                        className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-white text-sm font-black placeholder:text-slate-800 focus:border-purple-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest px-1">Direct Link</label>
                                        <input
                                            value={task.link}
                                            onChange={(e) => onUpdateTask(idx, 'link', e.target.value)}
                                            placeholder={PLATFORMS[task.platform]?.domain || "https://..."}
                                            className="w-full bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl text-emerald-400/80 text-[10px] font-mono focus:border-emerald-500/30 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest px-1">Target Account ID</label>
                                        <input
                                            value={task.target_id}
                                            onChange={(e) => onUpdateTask(idx, 'target_id', e.target.value)}
                                            placeholder="Username or ID"
                                            className="w-full bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl text-blue-400/80 text-[10px] font-mono focus:border-blue-500/30 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Economy & Rules Column */}
                            <div className="lg:col-span-4 grid grid-cols-2 gap-4 h-fit">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Base Reward</label>
                                    <div className="relative group/input">
                                        <Zap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500" />
                                        <input
                                            type="number"
                                            readOnly
                                            value={task.baseReward}
                                            className="w-full bg-white/5 border border-white/5 p-4 pl-10 rounded-2xl text-amber-400 font-black text-sm outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Min Tier</label>
                                    <select
                                        value={task.minTier}
                                        onChange={(e) => onUpdateTask(idx, 'minTier', Number(e.target.value))}
                                        className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest focus:border-purple-500/50 outline-none cursor-pointer appearance-none"
                                    >
                                        <option value={1} className="bg-[#0a0a0c]">Bronze</option>
                                        <option value={2} className="bg-[#0a0a0c]">Silver</option>
                                        <option value={3} className="bg-[#0a0a0c]">Gold</option>
                                        <option value={4} className="bg-[#0a0a0c]">Platinum</option>
                                        <option value={5} className="bg-[#0a0a0c]">Diamond</option>
                                    </select>
                                </div>
                                <div className="space-y-2 col-span-2 grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => onUpdateTask(idx, 'requiresVerification', !task.requiresVerification)}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-500 group/btn ${
                                            task.requiresVerification 
                                            ? 'bg-purple-600/20 border-purple-500/40 text-purple-400 font-black shadow-lg shadow-purple-500/10' 
                                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
                                        }`}
                                    >
                                        <Shield className={`w-4 h-4 ${task.requiresVerification ? 'animate-pulse' : 'opacity-40'}`} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">
                                            {task.requiresVerification ? 'VERIFY ON' : 'MANUAL'}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => onUpdateTask(idx, 'isBaseSocialRequired', !task.isBaseSocialRequired)}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-500 group/btn ${
                                            task.isBaseSocialRequired 
                                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-black shadow-lg shadow-blue-500/10' 
                                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
                                        }`}
                                    >
                                        <svg className={`w-4 h-4 ${task.isBaseSocialRequired ? 'animate-bounce' : 'opacity-40'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                        <span className="text-[9px] font-black uppercase tracking-widest">
                                            {task.isBaseSocialRequired ? 'IDENTITY ON' : 'OPEN'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="relative">
                <button
                    onClick={onDeploy}
                    disabled={isSaving}
                    className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 p-6 rounded-[2rem] font-black text-white text-lg tracking-[0.3em] transition-all flex items-center justify-center gap-4 shadow-2xl shadow-purple-500/40 uppercase group/btn"
                >
                    {isSaving ? <RefreshCw className="w-7 h-7 animate-spin" /> : <Send className="w-7 h-7 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />}
                    DEPLOY BATCH TO BASE NETWORK
                </button>
            </div>
        </div>
    );
}
