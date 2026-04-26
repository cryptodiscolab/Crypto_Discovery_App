import React from 'react';
import { Shield, BarChart3, Clock, Zap, RefreshCw } from 'lucide-react';

export function EconomyConfigSection({
    newPlatformFee, onNewPlatformFeeChange,
    newMinPoolUSD, onNewMinPoolUSDChange,
    newMinRewardUSD, onNewMinRewardUSDChange,
    newTokenPriceUSD, onNewTokenPriceUSDChange,
    currentPlatformFee,
    currentTokenPrice,
    pendingPrice,
    onUpdateEconomy,
    onSchedulePrice,
    onExecutePrice
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 text-left relative">
            {/* Platform Fee & Limits */}
            <div className="glass-card p-10 border border-indigo-500/10 bg-indigo-950/5 rounded-[3rem] relative overflow-hidden group/card1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover/card1:bg-indigo-500/10 transition-all duration-700" />
                
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                        <Shield className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-[0.2em] leading-none">PROTOCOL <span className="text-indigo-500">PARAMS</span></h4>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Governance Controls</p>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Sponsorship Fee (USDC)</label>
                        <div className="relative group">
                            <input
                                type="number"
                                value={newPlatformFee}
                                onChange={(e) => onNewPlatformFeeChange(e.target.value)}
                                placeholder={currentPlatformFee ? (Number(currentPlatformFee) / 1e6).toString() : "1.00"}
                                className="w-full bg-black/40 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all font-mono text-lg"
                            />
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-700 font-black uppercase text-[10px] tracking-widest pointer-events-none group-focus-within:text-indigo-500 transition-colors">FIXED</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Min Pool (USD)</label>
                            <input
                                type="number"
                                value={newMinPoolUSD}
                                onChange={(e) => onNewMinPoolUSDChange(e.target.value)}
                                placeholder="5.00"
                                className="w-full bg-black/40 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all font-mono"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Min Reward (USD)</label>
                            <input
                                type="number"
                                value={newMinRewardUSD}
                                onChange={(e) => onNewMinRewardUSDChange(e.target.value)}
                                placeholder="0.01"
                                className="w-full bg-black/40 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all font-mono"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={onUpdateEconomy} 
                        className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 py-6 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] text-white transition-all shadow-2xl shadow-indigo-500/20 active:scale-[0.98] mt-4"
                    >
                        PUSH UPDATE TO CHAIN
                    </button>
                </div>
            </div>

            {/* Price Oracle Control */}
            <div className="glass-card p-10 border border-emerald-500/10 bg-emerald-950/5 rounded-[3rem] relative overflow-hidden group/card2">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover/card2:bg-emerald-500/10 transition-all duration-700" />
                
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                        <BarChart3 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-[0.2em] leading-none">LIQUIDITY <span className="text-emerald-500">ORACLE</span></h4>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Token Price Calibration</p>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="p-8 bg-black/60 rounded-[2rem] border border-white/5 relative overflow-hidden group/price">
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20" />
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Live Feed Status</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white font-mono tracking-tighter">
                                ${currentTokenPrice ? (Number(currentTokenPrice) / 1e18).toFixed(4) : "0.0000"}
                            </span>
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">USD / CT</span>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Adjust Targeted Value (USD)</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={newTokenPriceUSD}
                                onChange={(e) => onNewTokenPriceUSDChange(e.target.value)}
                                placeholder="0.1000"
                                className="w-full bg-black/40 border border-white/5 p-6 rounded-[1.5rem] text-emerald-400 font-mono text-xl outline-none focus:border-emerald-500/50 transition-all"
                            />
                        </div>
                        
                        <button 
                            onClick={onSchedulePrice} 
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-6 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] text-white transition-all shadow-2xl shadow-emerald-500/20 active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-center gap-3">
                                <Zap className="w-4 h-4 fill-white" />
                                <span>SYNC ORACLE PRICE</span>
                            </div>
                        </button>

                        {pendingPrice?.[2] && (
                            <div className="p-5 bg-blue-500/5 rounded-2xl border border-blue-500/20 flex items-center justify-between group/pending animate-pulse">
                                <div className="flex items-center gap-4">
                                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                                    <div className="flex flex-col">
                                        <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em]">Pending Transaction</p>
                                        <p className="text-xs text-white font-mono font-bold mt-1">
                                            TARGET: ${(Number(pendingPrice[0]) / 1e18).toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-[10px] font-black text-blue-500/50 uppercase italic tracking-widest">Awaiting...</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
