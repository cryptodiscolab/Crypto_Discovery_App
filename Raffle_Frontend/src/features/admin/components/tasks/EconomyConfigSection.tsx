import { Shield, BarChart3, RefreshCw } from 'lucide-react';

interface EconomyConfigSectionProps {
    newPlatformFee: string;
    onNewPlatformFeeChange: (_val: string) => void;
    newMinPoolUSD: string;
    onNewMinPoolUSDChange: (_val: string) => void;
    newMinRewardUSD: string;
    onNewMinRewardUSDChange: (_val: string) => void;
    newTokenPriceUSD: string;
    onNewTokenPriceUSDChange: (_val: string) => void;
    currentPlatformFee?: bigint;
    currentTokenPrice?: bigint;
    pendingPrice?: unknown[];
    onUpdateEconomy: () => void;
    onSchedulePrice: () => void;
    onExecutePrice: () => void;
}

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
    onExecutePrice: _onExecutePrice
}: EconomyConfigSectionProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 text-left relative">
            {/* Platform Fee & Limits */}
            <div className="glass-card p-10 border border-white/5 bg-[#121214] rounded-[3rem] relative overflow-hidden group/card1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover/card1:bg-indigo-500/10 transition-all duration-700" />
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                        <Shield className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h4 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">PROTOCOL <span className="text-indigo-500">PARAMS</span></h4>
                        <p className="label-native text-slate-500 mt-2">Governance Controls</p>
                    </div>
                </div>
                <div className="space-y-8">
                    <div className="space-y-3">
                        <label className="block label-native text-slate-500 px-1 mb-1">Sponsorship Fee (USDC)</label>
                        <div className="relative group">
                            <input
                                type="number"
                                value={newPlatformFee}
                                onChange={(e) => onNewPlatformFeeChange(e.target.value)}
                                placeholder={currentPlatformFee ? (Number(currentPlatformFee) / 1e6).toString() : "1.00"}
                                className="w-full bg-[#0a0a0c] border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all value-native font-mono"
                            />
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-700 label-native pointer-events-none group-focus-within:text-indigo-500 transition-colors">FIXED</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="block label-native text-slate-500 px-1 mb-1">Min Pool (USD)</label>
                            <input type="number" value={newMinPoolUSD} onChange={(e) => onNewMinPoolUSDChange(e.target.value)} placeholder="5.00" className="w-full bg-[#0a0a0c] border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all value-native font-mono" />
                        </div>
                        <div className="space-y-3">
                            <label className="block label-native text-slate-500 px-1 mb-1">Min Reward (USD)</label>
                            <input type="number" value={newMinRewardUSD} onChange={(e) => onNewMinRewardUSDChange(e.target.value)} placeholder="0.01" className="w-full bg-[#0a0a0c] border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all value-native font-mono" />
                        </div>
                    </div>
                    <button onClick={onUpdateEconomy} className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-6 rounded-[2rem] label-native transition-all shadow-2xl shadow-indigo-500/20 active:scale-[0.98] mt-4">
                        PUSH UPDATE TO CHAIN
                    </button>
                </div>
            </div>

            {/* Price Oracle Control */}
            <div className="glass-card p-10 border border-white/5 bg-[#121214] rounded-[3rem] relative overflow-hidden group/card2">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover/card2:bg-emerald-500/10 transition-all duration-700" />
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                        <BarChart3 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h4 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">LIQUIDITY <span className="text-emerald-500">ORACLE</span></h4>
                        <p className="label-native text-slate-500 mt-2">Token Price Calibration</p>
                    </div>
                </div>
                <div className="space-y-8">
                    <div className="p-8 bg-black/60 rounded-[2rem] border border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20" />
                        <p className="label-native text-slate-500 mb-3">Live Feed Status</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white font-mono tracking-tighter">
                                ${currentTokenPrice ? (Number(currentTokenPrice) / 1e18).toFixed(4) : "0.0000"}
                            </span>
                            <span className="label-native text-slate-500">USD / CT</span>
                        </div>
                    </div>
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="block label-native text-slate-500 px-1 mb-1">Adjust Targeted Value (USD)</label>
                            <input type="number" step="0.0001" value={newTokenPriceUSD} onChange={(e) => onNewTokenPriceUSDChange(e.target.value)} placeholder="0.1000" className="w-full bg-[#0a0a0c] border border-white/5 p-6 rounded-[1.5rem] text-emerald-400 value-native font-mono outline-none focus:border-emerald-500/50 transition-all" />
                        </div>
                        <button onClick={onSchedulePrice} className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-6 rounded-[2rem] label-native transition-all shadow-2xl shadow-emerald-500/20 active:scale-[0.98]">
                            SYNC ORACLE PRICE
                        </button>
                        {Boolean(pendingPrice?.[2]) && (
                            <div className="p-5 bg-blue-500/5 rounded-2xl border border-blue-500/20 flex items-center justify-between group/pending animate-pulse">
                                <div className="flex items-center gap-4">
                                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                                    <div className="flex flex-col">
                                        <p className="label-native text-blue-400">Pending Transaction</p>
                                        <p className="value-native text-white font-mono mt-1">
                                            TARGET: ${(Number((pendingPrice as unknown[])?.[0] || 0) / 1e18).toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                                <div className="label-native text-blue-500/50 italic">Awaiting...</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
