import React, { useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useNFTTiers } from '../hooks/useNFTTiers';
import { usePoints } from '../shared/context/PointsContext';
import { formatEther } from 'viem';
import { Sparkles, ArrowUpCircle, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function SBTUpgradeCard() {
    const { address } = useAccount();
    const { userPoints, userTier, rankName, refetch: refetchPoints } = usePoints();
    const { tiers, mintTier, refetch: refetchTiers } = useNFTTiers();
    const { data: balanceData } = useBalance({ address });

    // Find current and next tier
    const currentTierIndex = parseInt(userTier);
    const nextTier = tiers.find(t => t.id === currentTierIndex + 1);

    // Safety check for Max Level
    if (currentTierIndex >= 5) {
        return (
            <div className="glass-card p-6 border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Sparkles className="text-yellow-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase italic">Max Level Reached</h3>
                        <p className="text-sm text-slate-400">You are a Diamond member. Maximum rewards active.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!nextTier) return null;

    const hasEnoughXP = Number(userPoints) >= nextTier.pointsRequired;
    const hasEnoughETH = balanceData?.value >= nextTier.mintPrice;
    const xpShortfall = nextTier.pointsRequired - Number(userPoints);

    const handleUpgrade = async () => {
        if (!hasEnoughXP) {
            return toast.error(`You need ${xpShortfall.toLocaleString()} more XP to upgrade!`);
        }

        const tid = toast.loading(`Upgrading to ${nextTier.name}...`);
        try {
            await mintTier(nextTier.id, nextTier.mintPrice);
            toast.success(`Success! Welcome to ${nextTier.name} Tier!`, { id: tid });
            refetchPoints();
            refetchTiers();
        } catch (err) {
            console.error(err);
            toast.error(err.shortMessage || "Upgrade failed. Check balance or gas.", { id: tid });
        }
    };

    return (
        <div className={`glass-card relative overflow-hidden transition-all duration-500 border ${hasEnoughXP ? 'border-indigo-500/40 bg-indigo-500/5 shadow-lg shadow-indigo-500/10' : 'border-white/10 bg-slate-900/40'}`}>
            {/* Background Glow for Ready State */}
            {hasEnoughXP && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-[50px] animate-pulse" />
            )}

            <div className="p-5 md:p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Next Ascension</span>
                            {hasEnoughXP && (
                                <span className="flex items-center gap-1 text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 font-black uppercase">
                                    Ready
                                </span>
                            )}
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                            Tier {nextTier.name}
                        </h3>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                        <ArrowUpCircle className={hasEnoughXP ? "text-indigo-400 animate-bounce" : "text-slate-500"} size={24} />
                    </div>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-4 mb-6">
                    {/* XP Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                            <span className="text-slate-500">XP Requirement</span>
                            <span className={hasEnoughXP ? "text-green-400" : "text-yellow-400"}>
                                {Number(userPoints).toLocaleString()} / {nextTier.pointsRequired.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full border border-white/5 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${hasEnoughXP ? 'bg-green-500' : 'bg-indigo-600'}`}
                                style={{ width: `${Math.min((Number(userPoints) / nextTier.pointsRequired) * 100, 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Cost Indicator */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                                <AlertCircle size={14} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase">Minting Fee</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-white">
                            {formatEther(nextTier.mintPrice)} ETH
                        </span>
                    </div>
                </div>

                {/* Requirements Summary */}
                <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase ${hasEnoughXP ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {hasEnoughXP ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                        Points OK
                    </div>
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase ${hasEnoughETH ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {hasEnoughETH ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        Funds OK
                    </div>
                </div>

                <button
                    onClick={handleUpgrade}
                    disabled={!hasEnoughXP}
                    className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] flex items-center justify-center gap-2
                        ${hasEnoughXP
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                >
                    {hasEnoughXP ? (
                        <>
                            <Sparkles size={14} />
                            MINT {nextTier.name.toUpperCase()} NOW
                        </>
                    ) : (
                        `NEED ${xpShortfall.toLocaleString()} MORE XP`
                    )}
                </button>

                {hasEnoughXP && !hasEnoughETH && (
                    <p className="text-[10px] text-red-400 text-center mt-3 font-bold uppercase animate-pulse">
                        ⚠️ Insufficient ETH for Minting Fee
                    </p>
                )}
            </div>
        </div>
    );
}
