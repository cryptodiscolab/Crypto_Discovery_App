import React, { useState, useEffect } from 'react';
import { Database, TrendingUp, RefreshCw, Timer as TimerIcon } from 'lucide-react';
import { formatUnits } from 'viem';
import toast from 'react-hot-toast';

export function PoolTab({ balance, onDistribute, ethPrice, settings, onUpdateSettings }) {
    const [isBusy, setIsBusy] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Local form state
    const [formData, setFormData] = useState({
        targetUSDC: settings?.targetUSDC || 5000,
        claimTimestamp: settings?.claimTimestamp || 0
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                targetUSDC: settings.targetUSDC || 5000,
                claimTimestamp: settings.claimTimestamp || 0
            });
        }
    }, [settings]);

    const currentETH = parseFloat(formatUnits(balance || 0n, 18));
    const currentUSDC = currentETH * ethPrice;
    const progress = Math.min((currentUSDC / formData.targetUSDC) * 100, 100);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating pool settings...");
        try {
            await onUpdateSettings(formData);
            toast.success("Pool Settings Updated!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || "Update failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDistribute = async () => {
        if (!window.confirm("Open Community Claim? This will lock the current balance for distribution.")) return;

        setIsBusy(true);
        const tid = toast.loading("Processing distribution...");
        try {
            await onDistribute();
            toast.success("Community Rewards unlocked!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || "Distribution failed", { id: tid });
        } finally {
            setIsBusy(false);
        }
    };

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
                    <div className="flex items-center justify-center gap-2 mb-8 text-indigo-400 font-mono font-bold">
                        <TrendingUp className="w-4 h-4" />
                        ~${currentUSDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                        <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full ml-2">@ ${ethPrice}/ETH</span>
                    </div>

                    <button
                        onClick={handleDistribute}
                        disabled={isBusy || (balance || 0n) === 0n}
                        className={`px-12 py-4 rounded-2xl font-black text-lg shadow-2xl transition-all ${balance > 0n
                            ? 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-indigo-500/30'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                    >
                        {isBusy ? "Opening..." : "Open Community Claim"}
                    </button>
                    <p className="text-xs text-slate-500 mt-6 italic max-w-lg mx-auto leading-relaxed">
                        "Opening the claim will distribute the balance above to Bronze, Silver, and Gold tiers based on the active weights."
                    </p>
                </div>
            </div>

            {/* Pool Settings Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration form */}
                <div className="glass-card p-8 bg-slate-900/40 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <RefreshCw className={`w-5 h-5 text-indigo-400 ${isSaving ? 'animate-spin' : ''}`} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Pool Settings</h3>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Pool (USDC)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                <input
                                    type="number"
                                    value={formData.targetUSDC}
                                    onChange={(e) => setFormData({ ...formData, targetUSDC: Number(e.target.value) })}
                                    className="w-full bg-black/40 border border-white/5 p-3 pl-8 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Claim Schedule (Automatic Activation)</label>
                            <input
                                type="datetime-local"
                                value={formData.claimTimestamp ? new Date(formData.claimTimestamp).toISOString().slice(0, 16) : ''}
                                onChange={(e) => setFormData({ ...formData, claimTimestamp: new Date(e.target.value).getTime() })}
                                className="w-full bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all cursor-pointer"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-indigo-500/20"
                            >
                                Update Settings
                            </button>
                            <button
                                onClick={() => setFormData({ targetUSDC: settings?.targetUSDC || 5000, claimTimestamp: settings?.claimTimestamp || 0 })}
                                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-slate-300 transition-all border border-white/5"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress Visualizer */}
                <div className="glass-card p-8 bg-indigo-600/5 border border-indigo-500/10 flex flex-col justify-between rounded-2xl">
                    <div>
                        <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-6">Target Completion</h4>

                        <div className="mb-8">
                            <div className="flex justify-between items-end mb-3">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Current Status</p>
                                    <p className="text-3xl font-black text-white">${currentUSDC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Target</p>
                                    <p className="text-xl font-bold text-slate-400">${formData.targetUSDC ? formData.targetUSDC.toLocaleString() : '0'}</p>
                                </div>
                            </div>

                            {/* Modern Progress Bar */}
                            <div className="h-4 bg-black/40 rounded-full border border-white/5 p-1 relative overflow-hidden">
                                <div
                                    style={{ width: `${progress}%` }}
                                    className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out"
                                />
                            </div>
                            <p className="text-[11px] text-right mt-2 text-indigo-400 font-bold">{progress.toFixed(1)}% Completed</p>
                        </div>
                    </div>

                    <div className="p-4 bg-black/30 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center">
                                <TimerIcon className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black">Next Claim Phase</p>
                                <p className="text-sm font-bold text-white">
                                    {formData.claimTimestamp
                                        ? new Date(formData.claimTimestamp).toLocaleString()
                                        : 'Manual Execution Only'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
