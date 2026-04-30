import { useAccount, useBalance, useSignMessage, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useNFTTiers } from '../hooks/useNFTTiers';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT } from '../hooks/useSBT';
import { useUserInfo } from '../hooks/useContract';
import { formatEther } from 'viem';
import { Sparkles, ArrowUpCircle, Lock, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export function SBTUpgradeCard() {
    const { address } = useAccount();
    const config = useConfig();
    const { signMessageAsync } = useSignMessage();
    const { userPoints, userTier, rankName, refetch: refetchPoints, ecosystemSettings, gasTracker } = usePoints();
    const { isGasExpensive, isGasHigh } = gasTracker || {};
    const { tiers, mintTier, refetch: refetchTiers } = useNFTTiers();
    const { userOnChainXP, currentSeasonId, refetchAll } = useSBT();
    const { stats: userOnChainStats, refetch: refetchUserInfo } = useUserInfo(address);
    const { data: balanceData } = useBalance({ address });

    // Feature Flags Check
    const isMainnet = import.meta.env.VITE_CHAIN_ID === '8453';
    const isSbtFeatureEnabled = !isMainnet || ecosystemSettings?.active_features?.sbt_minting === true;


    // Find current and next tier (Sync on-chain tier to bypass DB delay)
    const dbTier = parseInt(userTier) || 0;
    const chainTier = userOnChainStats?.currentTier || 0;
    const currentTierIndex = Math.max(dbTier, chainTier);
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
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">MAX LEVEL REACHED</h3>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">YOU ARE A DIAMOND MEMBER. MAXIMUM REWARDS ACTIVE.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!nextTier) return null;

    const dailyAppXP = userOnChainStats?.points || 0;

    const hasTotalXP = Number(userPoints) >= nextTier.pointsRequired;
    // DEV BYPASS: Auto-pass XP check for mock admin
    const hasOnChainXP = (import.meta.env.DEV && address?.toLowerCase() === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'.toLowerCase()) 
        ? true 
        : Number(dailyAppXP) >= nextTier.pointsRequired;
    const isSoldOut = nextTier.maxSupply > 0 && nextTier.currentSupply >= nextTier.maxSupply;
    // DEV BYPASS: Auto-pass ETH balance check for mock admin
    const hasEnoughETH = (import.meta.env.DEV && address?.toLowerCase() === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'.toLowerCase())
        ? true
        : balanceData?.value >= nextTier.mintPrice;
    
    const xpShortfall = nextTier.pointsRequired - Number(userPoints);
    const syncShortfall = nextTier.pointsRequired - Number(dailyAppXP);

    const isReady = isSbtFeatureEnabled && hasTotalXP && hasOnChainXP && !isSoldOut && hasEnoughETH;

    const handleUpgrade = async () => {
        if (isGasExpensive) return toast.error("⛔ Transaction paused: network gas too high. Please wait.", { icon: '⛽' });
        if (!isSbtFeatureEnabled) return toast.error("SBT Minting is currently disabled for this phase.");
        if (!hasOnChainXP) {
            if (hasTotalXP) {
                return toast.error("Points detected in DB but not yet synced to contract. Please perform a daily claim to trigger sync.");
            }
            return toast.error(`You need ${xpShortfall.toLocaleString()} more XP to upgrade!`);
        }

        if (isSoldOut) {
            return toast.error("This tier is currently sold out!");
        }

        if (!hasEnoughETH) {
            return toast.error(`Insufficient ETH. You need ${formatEther(nextTier.mintPrice)} ETH to mint.`);
        }

        const tid = toast.loading(`Minting ${nextTier.name} NFT...`);
        try {
            // FIX v3.47.1: Use mintNFT from useNFTTiers (calls DAILY_APP.mintNFT)
            // NOT upgradeTier from useSBT (which calls MASTER_X.upgradeTier — wrong contract!)
            const hash = await mintTier(nextTier.id, nextTier.mintPrice);
            
            toast.loading(`Waiting for confirmation...`, { id: tid });
            
            // FIX v3.47.4: Wait for the transaction receipt to avoid optimistic UI state when tx reverts
            const receipt = await waitForTransactionReceipt(config, { 
                hash,
                confirmations: 1
            });
            
            if (receipt.status !== 'success') {
                throw new Error("Transaction reverted on-chain");
            }
            
            toast.success(`NFT Minted! Welcome to ${nextTier.name} Tier! 🎉`, { id: tid });

            // Sync to DB Log
            try {
                const timestamp = new Date().toISOString();
                const message = `Log activity for ${address}\nAction: SBT Tier Ascension\nTimestamp: ${timestamp}`;
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
                console.warn('SBT Sync failed (non-critical):', syncErr);
            }

            refetchPoints();
            refetchTiers();
            refetchAll();
            refetchUserInfo?.(); // FIX v3.56.1: Force update on-chain user stats for instant UI feedback
        } catch (err) {
            console.error('[SBTUpgradeCard] Mint error:', err);
            // Provide specific error messages based on error type
            const errMsg = err?.shortMessage || err?.message || '';
            if (errMsg.includes('insufficient funds') || errMsg.includes('exceeds balance')) {
                toast.error(`Insufficient ETH balance. Need ${formatEther(nextTier.mintPrice)} ETH + gas.`, { id: tid });
            } else if (errMsg.includes('user rejected') || err?.code === 4001) {
                toast.error('Transaction cancelled by user.', { id: tid });
            } else if (errMsg.includes('gas')) {
                toast.error('Gas estimation failed. Ensure you have enough ETH for the fee and gas.', { id: tid });
            } else {
                toast.error(errMsg || 'Mint failed. Check your balance and try again.', { id: tid });
            }
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
                            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Next Ascension</span>
                            {isReady && (
                                <span className="flex items-center gap-1 text-[11px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 font-black uppercase tracking-widest">
                                    Ready
                                </span>
                            )}
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                            TIER {nextTier.name.toUpperCase()}
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
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
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
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Fee</span>
                                <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                    {formatEther(nextTier.mintPrice)} ETH
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Supply</span>
                                <span className={`text-[11px] font-black uppercase tracking-widest ${isSoldOut ? 'text-red-400' : 'text-white'}`}>
                                    {nextTier.currentSupply} / {nextTier.maxSupply || '∞'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requirements Summary */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${hasTotalXP ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {hasTotalXP ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                        Total XP
                    </div>
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${hasOnChainXP ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
                        {hasOnChainXP ? <CheckCircle2 size={12} /> : <Loader2 size={12} className="animate-spin" />}
                        On-Chain Sync
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${hasEnoughETH ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {hasEnoughETH ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        Funds OK
                    </div>
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${!isSoldOut ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {!isSoldOut ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        Available
                    </div>
                </div>

                {/* Gas Warning Banner */}
                {isGasHigh && !isGasExpensive && (
                    <div className="flex items-center justify-center gap-2 mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest text-center shadow-inner">
                        ⚠️ Network is busy, mint fee might be high
                    </div>
                )}

                <button
                    onClick={handleUpgrade}
                    disabled={!hasOnChainXP || isSoldOut || !isSbtFeatureEnabled || isGasExpensive}
                    className={`w-full min-h-[56px] py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1
                        ${isGasExpensive
                            ? 'bg-red-900/20 text-red-500 border border-red-500/30 cursor-not-allowed'
                            : isReady
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                >
                    {isGasExpensive ? (
                        <>
                            <span className="flex items-center gap-2"><AlertCircle size={14} /> ⛔ GAS TOO HIGH</span>
                            <span className="text-[9px] opacity-70 normal-case font-medium tracking-normal">Please wait until network fees drop</span>
                        </>
                    ) : !isSbtFeatureEnabled ? (
                        'LOCKED: PHASE 3 FEATURE'
                    ) : isSoldOut ? (
                        'TIER SOLD OUT'
                    ) : !hasOnChainXP ? (
                        hasTotalXP ? 'AWAITING ON-CHAIN SYNC' : `NEED ${xpShortfall.toLocaleString()} MORE XP`
                    ) : (
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} />
                            MINT {nextTier.name.toUpperCase()} NOW
                        </div>
                    )}
                </button>

                {hasTotalXP && !hasOnChainXP && (
                    <div className="mt-4 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                        <p className="text-[11px] text-yellow-400 font-black uppercase leading-tight text-center tracking-widest">
                            ⚠️ Points Synced to DB but not Contract.
                            <br/>Sync will happen on next daily claim.
                        </p>
                    </div>
                )}

                {hasTotalXP && !hasEnoughETH && (
                    <p className="text-[11px] text-red-400 text-center mt-3 font-black uppercase animate-pulse tracking-widest">
                        ⚠️ Insufficient ETH for Minting Fee
                    </p>
                )}
            </div>
        </div>
    );
}
