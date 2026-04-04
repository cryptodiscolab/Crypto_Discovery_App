import React, { useState } from 'react';
import { Database, TrendingUp, Zap, Timer as TimerIcon, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { formatUnits, formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { useSBT } from '../../../hooks/useSBT';
import toast from 'react-hot-toast';

export function PoolTab({ balance, ethPrice, settings }) {
    const { address } = useAccount();
    const {
        totalPoolBalance,
        lastDistributeTimestamp,
        distributeRevenue,
        contractOwner,
        refetchAll,
        diamondWeight, platinumWeight, goldWeight, silverWeight, bronzeWeight,
    } = useSBT();

    const [isDistributing, setIsDistributing] = useState(false);

    // Use prop 'balance' if passed, fallback to hook
    const effectiveBalance = balance ?? totalPoolBalance ?? 0n;
    const currentETH  = parseFloat(formatUnits(effectiveBalance, 18));
    const currentUSDC = currentETH * ethPrice;
    const targetUSDC  = settings?.targetUSDC || 5000;
    const progress    = Math.min((currentUSDC / targetUSDC) * 100, 100);

    const isOwner = address && contractOwner &&
        address.toLowerCase() === contractOwner.toLowerCase();

    const lastDistDate = lastDistributeTimestamp && lastDistributeTimestamp > 0n
        ? new Date(Number(lastDistributeTimestamp) * 1000).toLocaleString()
        : 'Never triggered';

    const handleDistribute = async () => {
        if (!isOwner) {
            toast.error('Only the contract owner can trigger distribution.');
            return;
        }
        if (effectiveBalance === 0n) {
            toast.error('Pool balance is 0. No revenue to distribute.');
            return;
        }

        setIsDistributing(true);
        const tid = toast.loading('Triggering on-chain revenue distribution...');
        try {
            const hash = await distributeRevenue();
            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-bold">Distribution Successful!</span>
                    <a
                        href={`https://sepolia.basescan.org/tx/${hash}`}
                        target="_blank" rel="noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                    >
                        View on Basescan ↗
                    </a>
                </div>,
                { id: tid, duration: 8000 }
            );
            refetchAll();
        } catch (err) {
            console.error('[PoolTab] distributeRevenue error:', err);
            toast.error(err.shortMessage || 'Distribution failed. Check owner wallet & gas.', { id: tid });
        } finally {
            setIsDistributing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ── Main Stats Card ── */}
            <div className="glass-card p-10 bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 relative overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                    <Database className="w-64 h-64 text-indigo-500" />
                </div>
                <div className="relative z-10 text-center">
                    <Database className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Total SBT Community Pool</p>
                    <h2 className="text-6xl font-black text-white mb-2">
                        {currentETH.toFixed(4)} <span className="text-2xl text-slate-500">ETH</span>
                    </h2>
                    <div className="flex flex-col items-center justify-center gap-1 mb-8">
                        <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold">
                            <TrendingUp className="w-4 h-4" />
                            ~${currentUSDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                            <span className="text-[11px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full ml-2">@ ${ethPrice}/ETH</span>
                        </div>
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Source: Chainlink Oracle (On-Chain)</p>
                    </div>
                </div>
            </div>

            {/* ── Tier Weights Grid ── */}
            <div className="glass-card p-6 rounded-2xl border border-white/10">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4">Tier Weight Configuration</p>
                <div className="grid grid-cols-5 gap-2">
                    {[
                        { name: 'Diamond',  w: diamondWeight,  color: 'text-cyan-400'   },
                        { name: 'Platinum', w: platinumWeight, color: 'text-violet-400'  },
                        { name: 'Gold',     w: goldWeight,     color: 'text-yellow-400'  },
                        { name: 'Silver',   w: silverWeight,   color: 'text-slate-300'   },
                        { name: 'Bronze',   w: bronzeWeight,   color: 'text-amber-600'   },
                    ].map(t => (
                        <div key={t.name} className="flex flex-col items-center p-3 rounded-xl bg-black/30 border border-white/5">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t.name}</span>
                            <span className={`text-[12px] font-bold ${t.color}`}>{t.w ?? '—'}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Progress & Distribution Panel ── */}
            <div className="glass-card p-8 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-6">Target Completion Progress</h4>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-3">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Current (USDC Equiv.)</p>
                            <p className="text-4xl font-black text-white">${currentUSDC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Protocol Target</p>
                            <p className="text-xl font-bold text-slate-400">${targetUSDC.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="h-4 bg-black/40 rounded-full border border-white/5 p-1 relative overflow-hidden">
                        <div
                            style={{ width: `${progress}%` }}
                            className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out"
                        />
                    </div>
                    <div className="flex justify-between mt-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Auto-distribution via System Settings</p>
                        <p className="text-[12px] font-bold text-indigo-400">{progress.toFixed(1)}% Filled</p>
                    </div>
                </div>

                {/* Last Distribution Info */}
                <div className="p-4 bg-black/30 rounded-2xl border border-white/5 flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center">
                            <TimerIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Last Distribution</p>
                            <p className="text-[13px] font-medium text-white">{lastDistDate}</p>
                        </div>
                    </div>
                    <div className="text-center px-4">
                        <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1 animate-bounce" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Growth Active</p>
                    </div>
                </div>

                {/* ── DISTRIBUTE REVENUE BUTTON (Owner Only) ── */}
                <div className={`rounded-2xl border p-5 ${isOwner ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/5 bg-black/20'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <Zap className={`w-4 h-4 ${isOwner ? 'text-indigo-400' : 'text-slate-600'}`} />
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Manual Revenue Distribution</p>
                        {isOwner
                            ? <span className="ml-auto text-[11px] font-black uppercase tracking-widest text-green-400 flex items-center gap-1"><CheckCircle2 size={11} /> Owner Verified</span>
                            : <span className="ml-auto text-[11px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1"><AlertCircle size={11} /> Owner Only</span>
                        }
                    </div>
                    <p className="text-[13px] font-medium text-slate-500 leading-relaxed mb-4">
                        Distributes accumulated ETH from the pool to all SBT tier holders proportional to their tier weight.
                        Only callable by the contract owner.
                    </p>
                    <button
                        onClick={handleDistribute}
                        disabled={!isOwner || isDistributing || effectiveBalance === 0n}
                        className={`w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                            ${isOwner && !isDistributing && effectiveBalance > 0n
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                            }`}
                    >
                        {isDistributing
                            ? <><RefreshCw size={13} className="animate-spin" /> Distributing...</>
                            : !isOwner
                                ? '🔒 Owner Access Required'
                                : effectiveBalance === 0n
                                    ? '⚠️ Pool Empty — Nothing to Distribute'
                                    : <><Zap size={13} /> Trigger Distribution ({currentETH.toFixed(4)} ETH)</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
