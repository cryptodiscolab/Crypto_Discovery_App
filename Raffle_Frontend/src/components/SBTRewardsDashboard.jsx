import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Award, DollarSign, ShieldAlert, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useSBT } from '../hooks/useSBT';
import { formatEther } from 'ethers';
import { usePublicClient } from 'wagmi';
import toast from 'react-hot-toast';

export function SBTRewardsDashboard() {
    const { totalPoolBalance, userTier, claimableAmount, maxGasPrice, claimRewards, refetchAll } = useSBT();
    const publicClient = usePublicClient();
    const [currentGasPrice, setCurrentGasPrice] = useState(0n);
    const [isClaiming, setIsClaiming] = useState(false);

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
            {/* 1. Global Stats: Community Pool */}
            <div className="glass-card p-6 border-t-4 border-t-indigo-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <TrendingUp className="w-24 h-24 text-indigo-500" />
                </div>

                <div className="relative z-10">
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Disco Community Pool</p>
                    <h2 className="text-4xl font-black text-white flex items-center gap-2">
                        <DollarSign className="w-8 h-8 text-green-400" />
                        {parseFloat(formatEther(totalPoolBalance)).toFixed(6)} <span className="text-xl text-slate-500 font-normal">ETH</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Locked & Distributed On-Chain
                    </p>
                    <p className="text-[10px] text-indigo-400/60 mt-1 italic">
                        * Rewards distributed in ETH based on current USD exchange rate
                    </p>
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
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">Available to Claim</p>
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
                            className={`px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg ${claimableAmount > 0n
                                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:scale-105 active:scale-95 shadow-indigo-500/20'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                                }`}
                        >
                            {isClaiming ? "Processing..." : "Claim My Rewards"}
                            {!isClaiming && claimableAmount > 0n && <CheckCircle className="w-4 h-4" />}
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
