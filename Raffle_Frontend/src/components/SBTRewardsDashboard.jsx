import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, DollarSign, ShieldAlert, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useSBT } from '../hooks/useSBT';
import { useCMS } from '../hooks/useCMS';
import { formatUnits } from 'viem';
import { usePublicClient } from 'wagmi';
import toast from 'react-hot-toast';

export function SBTRewardsDashboard() {
    const { totalPoolBalance, userTier, claimableAmount, maxGasPrice, claimRewards, refetchAll, isLoading: loadingSBT } = useSBT();
    const { ethPrice, poolSettings, isLoading: loadingCMS } = useCMS();
    const publicClient = usePublicClient();
    const [currentGasPrice, setCurrentGasPrice] = useState(0n);
    const [isClaiming, setIsClaiming] = useState(false);

    const isLoading = loadingSBT || loadingCMS;

    // Monitor Network Gas Price (for Transparency & Safety)
    useEffect(() => {
        const fetchGas = async () => {
            try {
                const gasPrice = await publicClient.getGasPrice();
                setCurrentGasPrice(gasPrice);
            } catch (e) {
                console.error("Failed to fetch gas price", e);
            }
        };
        fetchGas();
        const interval = setInterval(fetchGas, 30000); // Pulse every 30s
        return () => clearInterval(interval);
    }, [publicClient]);

    const tierNames = ["None", "Bronze", "Silver", "Gold"];
    const tierColors = [
        "text-slate-500",
        "text-[#CD7F32]", // Bronze
        "text-[#C0C0C0]", // Silver
        "text-[#FFD700]"  // Gold
    ];

    const handleClaim = async () => {
        // 🛡️ Gas Protection check (Frontend warning)
        const gasInGwei = Number(currentGasPrice) / 1e9;
        if (gasInGwei > 200) {
            const proceed = window.confirm(`⚠️ GAS ALERT: Current gas price is ${gasInGwei.toFixed(1)} Gwei (Very High). You might spend more on gas than you claim. Proceed anyway?`);
            if (!proceed) return;
        }

        // 🔒 Contract limit check
        if (currentGasPrice > maxGasPrice) {
            toast.error(`Gas price exceeds contract limit (${Number(maxGasPrice) / 1e9} Gwei). Please wait for gas to drop.`);
            return;
        }

        setIsClaiming(true);
        const tid = toast.loading("Processing community pool claim...");

        try {
            const hash = await claimRewards();
            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-bold">Claim Successful!</span>
                    <a
                        href={`https://sepolia.basescan.org/tx/${hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 flex items-center gap-1 hover:underline"
                    >
                        Proof on Basescan <ExternalLink className="w-3 h-3" />
                    </a>
                </div>,
                { id: tid, duration: 6000 }
            );
            refetchAll();
        } catch (err) {
            console.error(err);
            toast.error(err.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Global Stats: Community Pool (Modernized) */}
            <div className="glass-card relative overflow-hidden group bg-slate-900/40 border-indigo-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-50" />

                <div className="relative z-10 p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                    Disco Community Pool (TVL)
                                </p>
                                <span className="bg-indigo-500/20 text-indigo-400 text-[8px] px-1.5 py-0.5 rounded font-black tracking-tighter">SYNC v2</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-black text-white tracking-tight">
                                    ${((parseFloat(formatEther(totalPoolBalance || 0n)) * ethPrice)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </h2>
                                <span className="text-slate-500 font-bold text-sm uppercase italic">USDC</span>
                            </div>
                            <p className="text-slate-500 text-xs mt-1 flex items-center gap-1 font-mono">
                                ≈ {parseFloat(formatEther(totalPoolBalance || 0n)).toFixed(6)} ETH
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 text-[10px] text-green-400 font-bold uppercase tracking-widest bg-green-400/5 px-3 py-1.5 rounded-full border border-green-400/10">
                                <CheckCircle className="w-3 h-3" />
                                On-Chain Verified
                            </div>
                            <p className="text-[10px] text-slate-500 italic">
                                * Rate: 1 ETH = ${ethPrice.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Simple Progress Bar for context */}
                    <div className="mt-6 space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <span>Progress to Phase Target</span>
                            <span className="text-indigo-400">
                                {Math.min(((parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice) / (poolSettings?.targetUSDC || 5000)) * 100, 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(((parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice) / (poolSettings?.targetUSDC || 5000)) * 100, 100)}%` }}
                                className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. User Stats: Eligibility & Tier */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tier Card */}
                <div className="glass-card p-5 flex items-center gap-4 bg-slate-900/50">
                    <div className={`p-4 rounded-full bg-white/5 ${tierColors[userTier]}`}>
                        <Award className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">Your Soulbound Status</p>
                        <p className={`text-xl font-black ${tierColors[userTier]}`}>{tierNames[userTier]} Tier</p>
                    </div>
                </div>

                {/* Claimable Card */}
                <div className="glass-card p-5 flex flex-col justify-between bg-slate-900/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                COMMUNITY POOL
                            </p>
                        </div>
                        <button onClick={() => refetchAll()} className="p-1 hover:bg-white/5 rounded-md transition-colors">
                            <RefreshCw className="w-3 h-3 text-slate-500" />
                        </button>
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-bold text-white">
                            {parseFloat(formatEther(claimableAmount)).toFixed(6)} <span className="text-sm text-slate-500">ETH</span>
                        </h3>

                        <button
                            onClick={handleClaim}
                            disabled={isClaiming || claimableAmount === 0n || userTier === 0}
                            className={`px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg border border-white/10 ${claimableAmount > 0n
                                ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white hover:scale-105 active:scale-95 shadow-indigo-500/30'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            {isClaiming ? "Processing..." : "Claim Investment"}
                            {!isClaiming && claimableAmount > 0n && <DollarSign className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Safety Check: Network Gas Indicator */}
            <AnimatePresence>
                {Number(currentGasPrice) / 1e9 > 150 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500"
                    >
                        <ShieldAlert className="w-4 h-4 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-tighter">
                            Network Congestion: {(Number(currentGasPrice) / 1e9).toFixed(0)} Gwei. Recommend waiting.
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="text-center">
                <p className="text-[10px] text-slate-600 font-mono uppercase tracking-[0.2em]">
                    Powered by Anti-Gravity Revenue Distribution Logic (No-Riba Guaranteed)
                </p>
            </div>
        </div>
    );
}
