import { useAccount, useBalance, useSignMessage } from 'wagmi';
import { useNFTTiers } from '../hooks/useNFTTiers';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT } from '../hooks/useSBT';
import { formatEther } from 'viem';
import { Sparkles, ArrowUpCircle, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function SBTUpgradeCard() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { userPoints, userTier, rankName, refetch: refetchPoints } = usePoints();
    const { tiers, refetch: refetchTiers } = useNFTTiers();
    const { upgradeTier, userOnChainXP, currentSeasonId, refetchAll } = useSBT();
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

    const hasTotalXP = Number(userPoints) >= nextTier.pointsRequired;
    const hasOnChainXP = Number(userOnChainXP || 0) >= nextTier.pointsRequired;
    const isSoldOut = nextTier.maxSupply > 0 && nextTier.currentSupply >= nextTier.maxSupply;
    const hasEnoughETH = balanceData?.value >= nextTier.mintPrice;
    
    const xpShortfall = nextTier.pointsRequired - Number(userPoints);
    const syncShortfall = nextTier.pointsRequired - Number(userOnChainXP || 0);

    const isReady = hasTotalXP && hasOnChainXP && !isSoldOut && hasEnoughETH;

    const handleUpgrade = async () => {
        if (!hasOnChainXP) {
            if (hasTotalXP) {
                return toast.error("Points detected in DB but not yet synced to contract. Please wait for the periodic sync or perform a task to trigger it.");
            }
            return toast.error(`You need ${xpShortfall.toLocaleString()} more XP to upgrade!`);
        }

        if (isSoldOut) {
            return toast.error("This tier is currently sold out!");
        }

        const tid = toast.loading(`Ascending to ${nextTier.name}...`);
        try {
            const hash = await upgradeTier(nextTier.mintPrice.toString());
            toast.success(`Ascension Success! Welcome to ${nextTier.name} Tier!`, { id: tid });

            // Sync to DB Log
            try {
                const timestamp = new Date().toISOString();
                const message = `Log activity for ${address}\nAction: SBT Tier Ascension\nTimestamp: ${timestamp}`;
                
                // Use EIP-6963 compliant signMessageAsync
                const signature = await signMessageAsync({ message });

                await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'sync-sbt-upgrade',
                        wallet: address,
                        signature,
                        message,
                        payload: {
                            tierName: nextTier.name,
                            ethSpent: formatEther(nextTier.mintPrice),
                            txHash: hash
                        }
                    })
                });
            } catch (syncErr) {
                console.warn('SBT Sync failed:', syncErr);
            }

            refetchPoints();
            refetchTiers();
            refetchAll();
        } catch (err) {
            console.error(err);
            toast.error(err.shortMessage || "Ascension failed. Check balance or gas.", { id: tid });
        }
    };

    return (
        <div className={`glass-card relative overflow-hidden transition-all duration-500 border ${isReady ? 'border-indigo-500/40 bg-indigo-500/5 shadow-lg shadow-indigo-500/10' : 'border-white/10 bg-slate-900/40'}`}>
            {/* Background Glow for Ready State */}
            {isReady && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-[50px] animate-pulse" />
            )}

            <div className="p-5 md:p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Next Ascension</span>
                            {isReady && (
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
                        <ArrowUpCircle className={isReady ? "text-indigo-400 animate-bounce" : "text-slate-500"} size={24} />
                    </div>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-4 mb-6">
                    {/* XP Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                            <span className="text-slate-500">XP Requirement</span>
                            <span className={hasTotalXP ? "text-green-400" : "text-yellow-400"}>
                                {Number(userPoints).toLocaleString()} / {nextTier.pointsRequired.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full border border-white/5 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${hasTotalXP ? 'bg-green-500' : 'bg-indigo-600'}`}
                                style={{ width: `${Math.min((Number(userPoints) / nextTier.pointsRequired) * 100, 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Cost & Supply Indicator */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-500 uppercase">Fee</span>
                                <span className="text-xs font-mono font-bold text-white">
                                    {formatEther(nextTier.mintPrice)} ETH
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-500 uppercase">Supply</span>
                                <span className={`text-xs font-mono font-bold ${isSoldOut ? 'text-red-400' : 'text-white'}`}>
                                    {nextTier.currentSupply} / {nextTier.maxSupply || '∞'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requirements Summary */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase ${hasTotalXP ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {hasTotalXP ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                        Total XP
                    </div>
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase ${hasOnChainXP ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
                        {hasOnChainXP ? <CheckCircle2 size={12} /> : <Loader2 size={12} className="animate-spin" />}
                        On-Chain Sync
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase ${hasEnoughETH ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {hasEnoughETH ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        Funds OK
                    </div>
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase ${!isSoldOut ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {!isSoldOut ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        Available
                    </div>
                </div>

                <button
                    onClick={handleUpgrade}
                    disabled={!hasOnChainXP || isSoldOut}
                    className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] flex items-center justify-center gap-2
                        ${isReady
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                >
                    {isSoldOut ? (
                        'TIER SOLD OUT'
                    ) : !hasOnChainXP ? (
                        hasTotalXP ? 'AWAITING ON-CHAIN SYNC' : `NEED ${xpShortfall.toLocaleString()} MORE XP`
                    ) : (
                        <>
                            <Sparkles size={14} />
                            MINT {nextTier.name.toUpperCase()} NOW
                        </>
                    )}
                </button>

                {hasTotalXP && !hasOnChainXP && (
                    <div className="mt-4 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                        <p className="text-[10px] text-yellow-400 font-bold uppercase leading-tight text-center">
                            ⚠️ Points Synced to DB but not Contract.
                            <br/>Sync will happen on next daily claim.
                        </p>
                    </div>
                )}

                {hasTotalXP && !hasEnoughETH && (
                    <p className="text-[10px] text-red-400 text-center mt-3 font-bold uppercase animate-pulse">
                        ⚠️ Insufficient ETH for Minting Fee
                    </p>
                )}
            </div>
        </div>
    );
}
