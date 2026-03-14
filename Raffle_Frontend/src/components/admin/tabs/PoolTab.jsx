import React, { useState, useEffect } from 'react';
import { Database, TrendingUp, RefreshCw, Timer as TimerIcon } from 'lucide-react';
import { formatUnits } from 'viem';
import toast from 'react-hot-toast';

export function PoolTab({ balance, ethPrice, settings }) {
    const currentETH = parseFloat(formatUnits(balance || 0n, 18));
    const currentUSDC = currentETH * ethPrice;
    const targetUSDC = settings?.targetUSDC || 5000;
    const progress = Math.min((currentUSDC / targetUSDC) * 100, 100);

    return (
        <div className="space-y-8">
            {/* Main Stats Card */}
            <div className="glass-card p-10 bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 relative overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                    <Database className="w-64 h-64 text-indigo-500" />
                </div>

                <div className="relative z-10 text-center">
                    <Database className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                    <p className="text-slate-400 uppercase font-black tracking-widest text-xs mb-2">Total SBT Community Pool</p>
                    <h2 className="text-6xl font-black text-white mb-2">
                        {currentETH.toFixed(4)} <span className="text-2xl text-slate-500">ETH</span>
                    </h2>
                    <div className="flex flex-col items-center justify-center gap-1 mb-8">
                        <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold">
                            <TrendingUp className="w-4 h-4" />
                            ~${currentUSDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                            <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full ml-2">@ ${ethPrice}/ETH</span>
                        </div>
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Source: Chainlink Oracle (On-Chain)</p>
                    </div>

                    <div className="inline-block px-8 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 text-xs font-black uppercase tracking-widest">
                        Monitoring Mode Active
                    </div>
                </div>
            </div>

            {/* Progress Visualizer */}
            <div className="grid grid-cols-1 gap-6">
                <div className="glass-card p-8 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl">
                    <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-6">Target Completion Progress</h4>

                    <div className="mb-8">
                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Current Status (USDC Equiv.)</p>
                                <p className="text-4xl font-black text-white">${currentUSDC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Protocol Target</p>
                                <p className="text-xl font-bold text-slate-400">${targetUSDC.toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Modern Progress Bar */}
                        <div className="h-4 bg-black/40 rounded-full border border-white/5 p-1 relative overflow-hidden">
                            <div
                                style={{ width: `${progress}%` }}
                                className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out"
                            />
                        </div>
                        <div className="flex justify-between mt-2">
                             <p className="text-[10px] text-slate-500 italic uppercase">Auto-distribution configured in System Settings</p>
                             <p className="text-[11px] text-indigo-400 font-bold">{progress.toFixed(1)}% Completed</p>
                        </div>
                    </div>

                    <div className="p-5 bg-black/30 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center">
                                <TimerIcon className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black">Next Activation Window</p>
                                <p className="text-sm font-bold text-white">
                                    {settings?.claimTimestamp
                                        ? new Date(settings.claimTimestamp).toLocaleString()
                                        : 'Manual Execution Required'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="text-center px-4">
                             <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1 animate-bounce" />
                             <p className="text-[9px] font-black text-emerald-500 uppercase">Growth Active</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
