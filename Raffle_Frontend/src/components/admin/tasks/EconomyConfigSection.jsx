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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            {/* Platform Fee & Limits */}
            <div className="glass-card p-8 border border-white/10 bg-slate-900/50 rounded-3xl">
                <h4 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-yellow-500" /> ECONOMIC PARAMETERS
                </h4>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Sponsorship Listing Fee (USDC)</label>
                        <input
                            type="number"
                            value={newPlatformFee}
                            onChange={(e) => onNewPlatformFeeChange(e.target.value)}
                            placeholder={currentPlatformFee ? (Number(currentPlatformFee) / 1e6).toString() : "1.00"}
                            className="w-full bg-black border border-white/10 p-4 rounded-xl text-white outline-none focus:border-indigo-500 transition-all font-mono"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Min Pool (USD)</label>
                            <input
                                type="number"
                                value={newMinPoolUSD}
                                onChange={(e) => onNewMinPoolUSDChange(e.target.value)}
                                placeholder="5.00"
                                className="w-full bg-black border border-white/10 p-4 rounded-xl text-white outline-none focus:border-indigo-500 transition-all font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Min Reward (USD)</label>
                            <input
                                type="number"
                                value={newMinRewardUSD}
                                onChange={(e) => onNewMinRewardUSDChange(e.target.value)}
                                placeholder="0.01"
                                className="w-full bg-black border border-white/10 p-4 rounded-xl text-white outline-none focus:border-indigo-500 transition-all font-mono"
                            />
                        </div>
                    </div>
                    <button onClick={onUpdateEconomy} className="w-full bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 py-4 rounded-2xl text-xs font-black uppercase text-white transition-all shadow-lg active:scale-[0.98]">
                        Push Economy Update
                    </button>
                </div>
            </div>

            {/* Price Oracle Control */}
            <div className="glass-card p-8 border border-white/10 bg-slate-900/50 rounded-3xl">
                <h4 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" /> PRICE ORACLE HUB
                </h4>
                <div className="space-y-6">
                    <div className="p-4 bg-black rounded-2xl border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Current Oracle Price</p>
                        <p className="text-2xl font-black text-white font-mono">
                            ${currentTokenPrice ? (Number(currentTokenPrice) / 1e18).toFixed(4) : "0.0000"} <span className="text-xs text-slate-600">USD/CT</span>
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Target New Price (USD)</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={newTokenPriceUSD}
                                onChange={(e) => onNewTokenPriceUSDChange(e.target.value)}
                                placeholder="0.1000"
                                className="w-full bg-black border border-white/10 p-4 rounded-xl text-white font-mono outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={onSchedulePrice} className="bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 py-4 rounded-2xl text-[10px] font-black uppercase text-white transition-all">
                                <Clock className="w-4 h-4 mx-auto mb-1" />
                                Schedule (24h)
                            </button>
                            <button
                                onClick={onExecutePrice}
                                disabled={!pendingPrice?.[2]}
                                className="bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 disabled:opacity-30 py-4 rounded-2xl text-[10px] font-black uppercase text-white transition-all"
                            >
                                <Zap className="w-4 h-4 mx-auto mb-1" />
                                Execute Update
                            </button>
                        </div>
                        {pendingPrice?.[2] && (
                            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                                <p className="text-[9px] text-blue-300 font-bold uppercase tracking-widest">
                                    Price Change Pending: ${(Number(pendingPrice[0]) / 1e18).toFixed(4)} USD
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
