import { BarChart3, Sliders, Users, Search, Award, History } from 'lucide-react';

interface TierConfig {
    percentiles: Record<string, number>;
    floors: Record<string, number>;
}

interface AdvancedTierSectionProps {
    tierDistribution: unknown[];
    tierConfig: TierConfig;
    onTierConfigChange: (_category: keyof TierConfig, _key: string, _val: number) => void;
    onSaveTierConfig: () => void;
    targetWallet: string;
    onTargetWalletChange: (_val: string) => void;
    overrideTier: number;
    onOverrideTierChange: (_tier: number) => void;
    onApplyOverride: () => void;
    onSyncTiers: () => void;
    saving: boolean;
    currentSeasonId: number;
    onResetSeason: () => void;
}

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
    saving,
    currentSeasonId,
    onResetSeason
}: AdvancedTierSectionProps) {
    return (
        <div className="space-y-8">
            {/* Leaderboard Distribution Stats */}
            <div className="bg-[#121214] p-5 rounded-3xl border border-white/5 backdrop-blur-md transition-all hover:border-white/10 group">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <h3 className="label-native text-slate-400">Live Distribution</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                        { key: 'DIAMOND', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                        { key: 'PLATINUM', color: 'text-indigo-300', bg: 'bg-indigo-400/10' },
                        { key: 'GOLD', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        { key: 'SILVER', color: 'text-slate-300', bg: 'bg-slate-400/10' },
                        { key: 'BRONZE', color: 'text-amber-700', bg: 'bg-amber-800/10' }
                    ].map(t => {
                        const dist = tierDistribution.find((d): d is { tier_label: string; user_count?: number } => typeof d === 'object' && d !== null && (d as { tier_label?: string }).tier_label === t.key);
                        return (
                            <div key={t.key} className={`${t.bg} p-3 rounded-2xl border border-white/5 flex flex-col items-center sm:items-start`}>
                                <p className={`label-native ${t.color}`}>{t.key}</p>
                                <p className="text-md font-black text-white tracking-[0.2em] leading-none mt-2">{dist?.user_count || 0}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Leaderboard Tier Distribution */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Sliders className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">Leaderboard Tier Config</h2>
                </div>
                <div className="bg-[#121214] p-6 rounded-2xl border border-white/5 space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {[
                            { key: 'diamond', label: 'Diamond', color: 'text-cyan-400', border: 'focus:border-cyan-500' },
                            { key: 'platinum', label: 'Platinum', color: 'text-indigo-400', border: 'focus:border-indigo-500' },
                            { key: 'gold', label: 'Gold', color: 'text-amber-500', border: 'focus:border-amber-500' },
                            { key: 'silver', label: 'Silver', color: 'text-slate-400', border: 'focus:border-slate-400' },
                            { key: 'bronze', label: 'Bronze', color: 'text-amber-700', border: 'focus:border-amber-700' }
                        ].map(t => (
                            <div key={t.key} className="space-y-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                                <label className={`label-native ${t.color} block text-center`}>{t.label}</label>

                                <div className="space-y-1">
                                    <span className="label-native text-slate-500">Top %</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={((tierConfig.percentiles?.[t.key] || (tierConfig as unknown as Record<string, number>)[t.key] || 0) * 100).toFixed(2)}
                                        onChange={(e) => onTierConfigChange('percentiles', t.key, parseFloat(e.target.value) / 100)}
                                        className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono value-native ${t.border} outline-none`}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <span className="label-native text-slate-500">Min XP Floor</span>
                                    <input
                                        type="number"
                                        value={tierConfig.floors?.[t.key] || 0}
                                        onChange={(e) => onTierConfigChange('floors', t.key, parseInt(e.target.value) || 0)}
                                        className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono value-native ${t.border} outline-none`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={onSaveTierConfig} disabled={saving} className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-3 rounded-xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30">
                        SAVE TIER PERCENTILES
                    </button>
                </div>
            </div>

            {/* Manual Tier Override */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">Manual Tier Override</h2>
                </div>
                <div className="bg-[#121214] p-6 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex flex-col gap-3">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="User Wallet Address (0x...)"
                                value={targetWallet}
                                onChange={(e) => onTargetWalletChange(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 value-native text-white focus:border-indigo-500 outline-none font-mono"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
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
                                    className={`flex-1 min-w-[70px] py-2 rounded-lg label-native transition-all border ${overrideTier === t.id ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : 'bg-black/40 text-slate-500 border-white/5 hover:border-white/20'}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={onApplyOverride}
                        disabled={saving || !targetWallet}
                        className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-3 rounded-xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30"
                    >
                        APPLY MANUAL OVERRIDE
                    </button>
                    <p className="label-native text-slate-500 font-mono text-center leading-relaxed">
                        Override will bypass leaderboard rank calculation.<br />
                        Sync to blockchain is required to apply on-chain.
                    </p>
                </div>
            </div>

            {/* Push to Blockchain */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">Contract Sync</h2>
                </div>
                <button
                    onClick={onSyncTiers}
                    disabled={saving}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 p-6 rounded-3xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30"
                >
                    <div className="text-center space-y-1">
                        <span className="text-sm font-black uppercase tracking-[0.2em] block">PUSH LEADERBOARD TO CHAIN</span>
                        <span className="text-[10px] opacity-60 font-mono tracking-widest block">BATCH UPDATE CONTRACT TIERS</span>
                    </div>
                </button>
            </div>

            {/* DANGER ZONE: SEASON MANAGEMENT */}
            <div className="space-y-4 border-t border-red-500/20 pt-6">
                <div className="flex items-center gap-2 mb-2">
                    <History className="w-5 h-5 text-red-500" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">Danger Zone: Season Control</h2>
                </div>
                <div className="bg-red-950/20 p-6 rounded-3xl border border-red-500/20 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="label-native text-white font-mono">Active Season: {currentSeasonId}</p>
                            <p className="label-native text-red-400/60 font-mono mt-1">Resetting will clear all claimable reward debt</p>
                        </div>
                        <button
                            onClick={onResetSeason}
                            disabled={saving}
                            className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-6 py-2 rounded-xl label-native transition-all shadow-lg shadow-red-600/20"
                        >
                            Reset Season
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
