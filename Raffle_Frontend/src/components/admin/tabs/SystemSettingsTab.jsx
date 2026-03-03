import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Shield, Save } from 'lucide-react';
import { useSBT } from '../../../hooks/useSBT';
import { formatUnits } from 'viem';
import toast from 'react-hot-toast';

export function SystemSettingsTab() {
    const {
        ticketPriceUSDC,
        pointsPerTicket,
        ticketDescription,
        maxGasPrice,
        setMasterParams,
        distributeRevenue,
        lastDistributeTimestamp,
        refetchAll
    } = useSBT();

    const [isSaving, setIsSaving] = useState(false);
    const [isDistributing, setIsDistributing] = useState(false);
    const [formData, setFormData] = useState({
        tUSDC: 150000,
        mGas: 100000000000n,
        pPerTicket: 15,
        desc: ''
    });

    useEffect(() => {
        setFormData({
            tUSDC: Number(ticketPriceUSDC),
            mGas: maxGasPrice || 100000000000n,
            pPerTicket: Number(pointsPerTicket),
            desc: ticketDescription || ''
        });
    }, [ticketPriceUSDC, maxGasPrice, pointsPerTicket, ticketDescription]);

    const handleSave = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating MasterX Parameters...");
        try {
            await setMasterParams(
                BigInt(formData.tUSDC),
                BigInt(formData.mGas),
                BigInt(formData.pPerTicket),
                formData.desc
            );
            toast.success("MasterX Updated!", { id: tid });
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass-card p-8 bg-blue-900/10 border border-blue-500/10 rounded-2xl">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Settings className="w-6 h-6 text-blue-400" /> MasterX System Controls
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ticket Price (USDC - 6 Decimals)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                            <input
                                type="number"
                                value={formData.tUSDC}
                                onChange={(e) => setFormData({ ...formData, tUSDC: e.target.value })}
                                className="w-full bg-slate-900 border border-white/5 p-3 pl-8 rounded-xl text-white focus:border-blue-500/50 outline-none transition-all font-mono"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 italic">150000 = $0.15</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Max Gas Price (Wei)</label>
                        <input
                            type="text"
                            value={formData.mGas.toString()}
                            onChange={(e) => setFormData({ ...formData, mGas: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none transition-all font-mono"
                        />
                        <p className="text-[10px] text-slate-500 mt-1 italic">Current Limit: {formatUnits(formData.mGas, 9)} Gwei</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Points Per Ticket</label>
                        <input
                            type="number"
                            value={formData.pPerTicket}
                            onChange={(e) => setFormData({ ...formData, pPerTicket: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none transition-all font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ticket Description</label>
                        <input
                            type="text"
                            value={formData.desc}
                            onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-xl font-black shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 text-white"
                    >
                        <Save className="w-5 h-5" />
                        {isSaving ? "Updating MasterX..." : "Push Settings to Contract"}
                    </button>

                    <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                        <p className="text-[11px] text-yellow-500/70 leading-relaxed flex items-start gap-2">
                            <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                            <strong>Security Note:</strong> This action updates parameters directly on the blockchain. Ensure ETH balance is sufficient for gas. Changes take effect on the next transaction.
                        </p>
                    </div>
                </div>
            </div>

            {/* BATCH DISTRIBUTION CONTROL */}
            <div className="glass-card p-8 bg-emerald-900/10 border border-emerald-500/10 rounded-2xl">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <RefreshCw className="w-6 h-6 text-emerald-400" /> Revenue Batch Management
                </h3>

                <div className="mb-8 p-4 bg-black/40 rounded-xl border border-white/5 grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Last Distribution</p>
                        <p className="text-sm font-mono text-white">
                            {lastDistributeTimestamp > 0
                                ? new Date(Number(lastDistributeTimestamp) * 1000).toLocaleString()
                                : 'Never'}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Next Auto-Batch (ETA)</p>
                        <p className="text-sm font-mono text-emerald-400">
                            {lastDistributeTimestamp > 0
                                ? new Date((Number(lastDistributeTimestamp) + 432000) * 1000).toLocaleString()
                                : 'Ready Now'}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={async () => {
                            if (!window.confirm("Distribute accumulated revenue to all wallets & SBT pool?")) return;
                            setIsDistributing(true);
                            const tid = toast.loading("Executing Batch Distribution...");
                            try {
                                await distributeRevenue();
                                toast.success("Revenue Distributed Successfully!", { id: tid });
                                refetchAll();
                            } catch (e) {
                                toast.error(e.shortMessage || "Distribution failed", { id: tid });
                            } finally {
                                setIsDistributing(false);
                            }
                        }}
                        disabled={isDistributing}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-xl font-black shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-white"
                    >
                        <RefreshCw className={`w-5 h-5 ${isDistributing ? 'animate-spin' : ''}`} />
                        {isDistributing ? "Processing Batch..." : "Force Batch Distribution (Manual)"}
                    </button>

                    <p className="text-[10px] text-slate-500 italic text-center">
                        * Manual distribution bypasses the 5-day cooldown. Regular distribution is open to anyone every 5 days.
                    </p>
                </div>
            </div>
        </div>
    );
}
