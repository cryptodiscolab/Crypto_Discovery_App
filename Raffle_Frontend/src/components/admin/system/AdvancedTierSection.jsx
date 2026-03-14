import React from 'react';
import { BarChart3, Sliders, Users, Search, Award } from 'lucide-react';

export function AdvancedTierSection({
    tierDistribution,
    tierConfig,
    onTierConfigChange,
    onSaveTierConfig,
    targetWallet,
    onTargetWalletChange,
    overrideTier,
    onOverrideTierChange,
    onApplyOverride,
    onSyncTiers,
    saving
}) {
    return (
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
                        { key: 'PLATINUM', color: 'text-indigo-300', bg: 'bg-indigo-400/10' },
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
                                onChange={(e) => onTierConfigChange('diamond', parseFloat(e.target.value) / 100)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-cyan-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Platinum (Top %)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={tierConfig.platinum * 100}
                                onChange={(e) => onTierConfigChange('platinum', parseFloat(e.target.value) / 100)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Gold (Top %)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={tierConfig.gold * 100}
                                onChange={(e) => onTierConfigChange('gold', parseFloat(e.target.value) / 100)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-amber-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Silver (Top %)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={tierConfig.silver * 100}
                                onChange={(e) => onTierConfigChange('silver', parseFloat(e.target.value) / 100)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-slate-400 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Bronze (Top %)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={tierConfig.bronze * 100}
                                onChange={(e) => onTierConfigChange('bronze', parseFloat(e.target.value) / 100)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:border-amber-700 outline-none"
                            />
                        </div>
                    </div>
                    <button onClick={onSaveTierConfig} disabled={saving} className="w-full bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white py-2 rounded-xl text-xs font-black transition-all border border-amber-500/30">
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
                                onChange={(e) => onTargetWalletChange(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:border-indigo-500 outline-none font-mono"
                            />
                        </div>
                        <div className="flex gap-2">
                            {[
                                { id: 0, label: 'NONE' },
                                { id: 2, label: 'BRONZE' },
                                { id: 3, label: 'SILVER' },
                                { id: 4, label: 'GOLD' },
                                { id: 5, label: 'PLATINUM' },
                                { id: 6, label: 'DIAMOND' }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => onOverrideTierChange(t.id)}
                                    className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all border ${overrideTier === t.id ? 'bg-indigo-500 text-white border-white/20' : 'bg-black/40 text-slate-500 border-white/5 hover:border-white/20'}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={onApplyOverride}
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
                    onClick={onSyncTiers}
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
    );
}
