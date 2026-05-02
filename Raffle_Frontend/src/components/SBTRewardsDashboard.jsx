import React, { useState, useEffect } from 'react';
import { Award, DollarSign, ShieldAlert, CheckCircle, ExternalLink, Timer as TimerIcon, Globe, User, Info, Zap } from 'lucide-react';
import { useSBT } from '../hooks/useSBT';
import { useCMS } from '../hooks/useCMS';
import { formatEther, formatUnits } from 'viem';
import { usePublicClient, useAccount, useSignMessage } from 'wagmi';
import { useUserInfo, useV12Stats } from '../hooks/useContract';
import { calculateMultipliers } from '../lib/economy';
import toast from 'react-hot-toast';

export function SBTRewardsDashboard() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { totalPoolBalance, userTier, claimableAmount, maxGasPrice, claimRewards, isLoading: loadingSBT } = useSBT();
    const { ethPrice, poolSettings, isLoading: loadingCMS } = useCMS();
    const { stats: userStats } = useUserInfo(address);
    const { totalUsers } = useV12Stats();
    const publicClient = usePublicClient();

    const multis = calculateMultipliers(userStats, totalUsers);
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
        const interval = setInterval(fetchGas, 30000);
        return () => clearInterval(interval);
    }, [publicClient]);

    const tierNames = ["None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];
    const tierColors = [
        "text-slate-500",
        "text-[#CD7F32]",
        "text-[#C0C0C0]",
        "text-[#FFD700]",
        "text-[#E5E4E2]",
        "text-[#00FFFF]"
    ];

    const handleClaim = async () => {
        const gasInGwei = Number(currentGasPrice) / 1e9;
        if (gasInGwei > 200) {
            const proceed = window.confirm(`⚠️ GAS ALERT: Current gas price is ${gasInGwei.toFixed(1)} Gwei (Very High). You might spend more on gas than you claim. Proceed anyway?`);
            if (!proceed) return;
        }
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
                    <a href={`https://sepolia.basescan.org/tx/${hash}`} target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                        Proof on Basescan <ExternalLink className="w-3 h-3" />
                    </a>
                </div>,
                { id: tid, duration: 6000 }
            );

            // Sync to DB Log
            try {
                const timestamp = new Date().toISOString();
                const message = `Log activity for ${address}\nAction: Pool Sharing Claim\nTimestamp: ${timestamp}`;

                // Use EIP-6963 compliant signMessageAsync
                const signature = await signMessageAsync({ message });

                await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'sync-pool-claim',
                        wallet: address,
                        signature,
                        message,
                        payload: {
                            amountETH: formatEther(claimableAmount),
                            tier: userTier,
                            txHash: hash
                        }
                    })
                });
            } catch (syncErr) {
                console.warn('Pool Sync failed:', syncErr);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Pool Balance Card */}
            <div className="glass-card relative overflow-hidden group bg-slate-900/40 border-indigo-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-50" />
                <div className="relative z-10 p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <p className="label-native text-indigo-400">Pool Reward Collected</p>
                                <span className="label-native bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">SYNC v2</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-black text-white tracking-tight uppercase italic">
                                    ${((parseFloat(formatEther(totalPoolBalance || 0n)) * ethPrice)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </h2>
                                <span className="label-native text-slate-500 italic">USDC</span>
                            </div>
                            <p className="value-native text-slate-500 mt-1 flex items-center gap-1">
                                ≈ {parseFloat(formatEther(totalPoolBalance || 0n)).toFixed(6)} ETH
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="label-native flex items-center gap-2 text-green-400 bg-green-400/5 px-3 py-1.5 rounded-full border border-green-400/10">
                                <CheckCircle className="w-3 h-3" />
                                On-Chain Verified
                            </div>
                            <p className="label-native text-slate-500 italic">* Rate: 1 ETH = ${ethPrice.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="mt-6 space-y-2">
                        <div className="label-native flex justify-between items-center text-slate-500">
                            <span>Reward Progress</span>
                            <span className="text-indigo-400">
                                {Math.min(((parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice) / (poolSettings?.targetUSDC || 5000)) * 100, 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div
                                style={{ width: `${Math.min(((parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice) / (poolSettings?.targetUSDC || 5000)) * 100, 100)}%` }}
                                className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all duration-1000 ease-out"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. User Tier + Claimable */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-5 flex items-center gap-4 bg-slate-900/50">
                    <div className={`p-4 rounded-full bg-white/5 ${tierColors[userTier]}`}>
                        <Award className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="label-native text-slate-400">YOUR SOULBOUND STATUS</p>
                        <p className={`text-xl font-black italic uppercase tracking-tighter ${tierColors[userTier]}`}>{tierNames[userTier]} Tier</p>
                    </div>
                </div>
                <div className="glass-card p-5 flex flex-col justify-between bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-2">
                        <p className="label-native text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            COMMUNITY POOL
                        </p>
                    </div>
                    <div className="mb-4 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                        <p className="label-native text-indigo-300 flex items-center gap-2">
                            <TimerIcon className="w-3 h-3" />
                            DATA UPDATES EVERY 24H AT 07:00 UTC
                        </p>
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                            {parseFloat(formatEther(claimableAmount)).toFixed(6)} <span className="label-native text-slate-500 italic">ETH</span>
                        </h3>
                        <button
                            onClick={handleClaim}
                            disabled={isClaiming || claimableAmount === 0n || userTier === 0 || (parseFloat(formatEther(totalPoolBalance || 0n)) * ethPrice < (poolSettings?.targetUSDC || 5000))}
                            className={`px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg border border-white/10 ${(claimableAmount > 0n && (parseFloat(formatEther(totalPoolBalance || 0n)) * ethPrice >= (poolSettings?.targetUSDC || 5000)))
                                ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white hover:scale-105 active:scale-95 shadow-indigo-500/30'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            {isClaiming ? "PROCESSING..." : 
                             (parseFloat(formatEther(totalPoolBalance || 0n)) * ethPrice < (poolSettings?.targetUSDC || 5000)) 
                             ? "POOL FUNDING..." 
                             : "CLAIM REWARDS"}
                            {!isClaiming && claimableAmount > 0n && (parseFloat(formatEther(totalPoolBalance || 0n)) * ethPrice >= (poolSettings?.targetUSDC || 5000)) && <DollarSign className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. NEW: Community Tier Breakdown from sbt_pool_stats */}
            <SBTTierBreakdown ethPrice={ethPrice} totalPoolBalance={totalPoolBalance} />

            {/* 4. Nexus Economy Transparency (v3.41.2) */}
            <NexusEconomyPanel multipliers={multis} totalUsers={totalUsers} />

            {/* 5. Gas Warning */}
            {Number(currentGasPrice) / 1e9 > 150 && (
                <div className="flex items-center justify-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500">
                    <ShieldAlert className="w-4 h-4 animate-pulse" />
                    <span className="label-native">
                        NETWORK CONGESTION: {(Number(currentGasPrice) / 1e9).toFixed(0)} GWEI. RECOMMEND WAITING.
                    </span>
                </div>
            )}

            <div className="text-center">
                <p className="label-native text-slate-600">
                    POWERED BY ANTI-GRAVITY REVENUE DISTRIBUTION LOGIC (NO-RIBA GUARANTEED)
                </p>
            </div>
        </div>
    );
}

// ============================================================
// SBTTierBreakdown — reads from sbt_pool_stats (Supabase, READ-only)
// ============================================================
function SBTTierBreakdown({ ethPrice, totalPoolBalance }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function fetchStats() {
            try {
                const { supabase } = await import('../lib/supabaseClient');
                const { data, error } = await supabase
                    .from('sbt_pool_stats')
                    .select('*')
                    .maybeSingle();
                if (!error && data && mounted) setStats(data);
            } catch (e) {
                console.warn('[SBTTierBreakdown] fetch error:', e.message);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        fetchStats();
        return () => { mounted = false; };
    }, []);

    const TIERS = [
        { key: 'diamond_holders', label: 'Diamond', shareKey: 'share_legendary', rank: 'Rank 1-5', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20', emoji: '💎' },
        { key: 'platinum_holders', label: 'Platinum', shareKey: 'share_epic', rank: 'Rank 6-20', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', emoji: '🔮' },
        { key: 'gold_holders', label: 'Gold', shareKey: 'share_rare', rank: 'Rank 21-50', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', emoji: '🥇' },
        { key: 'silver_holders', label: 'Silver', shareKey: 'share_common', rank: 'Rank 51-100', color: 'text-slate-300', bg: 'bg-slate-300/10', border: 'border-slate-300/20', emoji: '🥈' },
        { key: 'bronze_holders', label: 'Bronze', shareKey: 'share_participation', rank: 'Holders', color: 'text-amber-600', bg: 'bg-amber-600/10', border: 'border-amber-600/20', emoji: '🥉' },
    ];

    const totalHolders = stats ? TIERS.reduce((sum, t) => sum + (stats[t.key] || 0), 0) : 0;
    const lastDist = stats?.last_distribution_at
        ? new Date(stats.last_distribution_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

    return (
        <div className="glass-card p-5 bg-slate-900/40 border-white/5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="label-native text-slate-400">COMMUNITY TIER BREAKDOWN</p>
                    <p className="label-native text-slate-600 mt-0.5">LAST DISTRIBUTION: {lastDist}</p>
                </div>
                <div className="text-right">
                    <p className="text-white font-black text-lg italic tracking-tighter">{loading ? '—' : totalHolders}</p>
                    <p className="label-native text-slate-500">TOTAL HOLDERS</p>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-5 gap-2">
                    {TIERS.map(t => <div key={t.key} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />)}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {TIERS.map((t) => {
                        const count = stats?.[t.key] || 0;
                        const sharePct = stats?.[t.shareKey] || 0;
                        const poolShare = ((parseFloat(formatEther(totalPoolBalance || 0n)) * ethPrice) * (sharePct / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 });
                        
                        return (
                            <div key={t.key} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border relative overflow-hidden ${t.bg} ${t.border}`}>
                                <div className="absolute top-1 right-2 text-[8px] font-black uppercase opacity-40">{t.rank}</div>
                                <span className="text-xl mb-1">{t.emoji}</span>
                                <p className={`text-base font-black ${t.color}`}>{count}</p>
                                <p className={`label-native ${t.color} opacity-80`}>{t.label}</p>
                                <div className="mt-2 w-full pt-2 border-t border-white/5 text-center">
                                    <p className="text-[10px] font-black text-white italic">${poolShare}</p>
                                    <p className="text-[8px] uppercase font-bold text-slate-500">{sharePct}% POOL</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ============================================================
// NexusEconomyPanel — Transparency for XP Scaling (v3.41.2)
// ============================================================
function NexusEconomyPanel({ multipliers, totalUsers }) {
    return (
        <div className="glass-card p-5 bg-indigo-500/5 border-indigo-500/20">
            <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">Nexus Economy Status</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Global Factor */}
                <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-3 h-3 text-slate-500" />
                        <span className="label-native mb-0">Macro-Scaling</span>
                    </div>
                    <p className="text-xl font-black text-white italic">{multipliers.global}x</p>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                        Based on {totalUsers.toLocaleString()} Users
                    </p>
                </div>

                {/* Personal Factor */}
                <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="label-native mb-0">Micro-Scaling</span>
                    </div>
                    <p className="text-xl font-black text-white italic">{multipliers.individual}x</p>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                        Personal XP Multiplier
                    </p>
                </div>

                {/* Catch-up Factor */}
                <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className={`w-3 h-3 ${multipliers.isUnderdogActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                        <span className="label-native mb-0">Catch-Up Bonus</span>
                    </div>
                    <p className={`text-xl font-black italic ${multipliers.isUnderdogActive ? 'text-indigo-400' : 'text-slate-500 opacity-40'}`}>
                        {multipliers.underdog}x
                    </p>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                        {multipliers.isUnderdogActive ? 'ACTIVE (Tier 0-2)' : 'INACTIVE'}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex items-start gap-3 p-3 bg-black/40 rounded-xl">
                <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-medium text-slate-500 leading-tight uppercase tracking-tight">
                    The Nexus Hybrid Formula prevents reward inflation by scaling XP based on total ecosystem size (Macro) and prevents whale dominance by scaling based on individual XP (Micro). Underdogs receive a +10% boost.
                </p>
            </div>
        </div>
    );
}
