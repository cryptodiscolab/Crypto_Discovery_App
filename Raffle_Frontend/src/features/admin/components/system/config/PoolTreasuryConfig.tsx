import { Database, Landmark, ArrowUpRight } from 'lucide-react';
import { formatUnits, parseEther } from 'viem';
import { SAFE_MULTISIG } from '../../../../../lib/contracts';
import { PoolFormData } from '../../../../types/admin';

interface PoolTreasuryConfigProps {
    totalPoolBalance: bigint;
    poolFormData: PoolFormData;
    setPoolFormData: (_f: PoolFormData) => void;
    handleSavePoolSettings: () => Promise<void>;
    handleDistribute: () => Promise<void>;
    handleWithdrawTreasury: (_amount: bigint) => Promise<void>;
    withdrawAmount: string;
    setWithdrawAmount: (_a: string) => void;
    isSaving: boolean;
}

export function PoolTreasuryConfig({
    totalPoolBalance,
    poolFormData,
    setPoolFormData,
    handleSavePoolSettings,
    handleDistribute,
    handleWithdrawTreasury,
    withdrawAmount,
    setWithdrawAmount,
    isSaving
}: PoolTreasuryConfigProps) {

    const onWithdraw = async () => {
        if (!window.confirm(`Withdraw ${withdrawAmount} ETH to Safe Multisig (${SAFE_MULTISIG})?`)) return;
        await handleWithdrawTreasury(parseEther(withdrawAmount));
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Community Pool Management */}
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-white/5 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                        <Database className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Pool Configuration</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-black">Community Reward Meta-Settings</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target USDC</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold">$</span>
                                <input
                                    type="number"
                                    value={poolFormData.targetUSDC}
                                    onChange={(e) => setPoolFormData({ ...poolFormData, targetUSDC: Number(e.target.value) })}
                                    className="w-full bg-black/40 border border-white/5 p-2 px-6 rounded-xl text-white font-mono text-xs focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projected ETH Status</label>
                            <div className="bg-black/40 border border-white/5 p-2 rounded-xl text-indigo-400 font-mono text-xs flex items-center justify-center">
                                {formatUnits(totalPoolBalance || 0n, 18).slice(0, 6)} ETH
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Automatic Schedule</label>
                        <input
                            type="datetime-local"
                            value={poolFormData.claimTimestamp ? new Date(poolFormData.claimTimestamp).toISOString().slice(0, 16) : ''}
                            onChange={(e) => setPoolFormData({ ...poolFormData, claimTimestamp: new Date(e.target.value).getTime() })}
                            className="w-full bg-black/40 border border-white/5 p-2 rounded-xl text-white font-mono text-xs focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSavePoolSettings}
                            disabled={isSaving}
                            className="flex-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-400 hover:text-white py-2.5 rounded-xl text-[10px] font-black transition-all border border-indigo-500/30 uppercase"
                        >
                            Save Configuration
                        </button>
                        <button
                            onClick={handleDistribute}
                            disabled={isSaving || totalPoolBalance === 0n}
                            className="flex-1 bg-emerald-500/20 hover:bg-emerald-600 text-emerald-400 hover:text-white py-2.5 rounded-xl text-[10px] font-black transition-all border border-emerald-500/30 uppercase"
                        >
                            Trigger Distribute
                        </button>
                    </div>
                </div>
            </div>

            {/* Treasury Management */}
            <div className="bg-emerald-950/10 p-6 rounded-2xl border border-emerald-500/10 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Treasury Safebox</h3>
                        <p className="text-[10px] text-emerald-500 font-black uppercase">Project Reserve (10%) Allocation</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-3 bg-black/40 rounded-xl border border-emerald-500/10 mb-4">
                        <p className="text-[9px] text-slate-500 uppercase font-black leading-tight">
                            Funds will be transferred to:
                            <br />
                            <span className="text-emerald-400 font-mono text-[10px]">{SAFE_MULTISIG}</span>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Withdrawal Amount (ETH)</label>
                        <div className="flex gap-3">
                            <input
                                type="number"
                                step="0.01"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                className="flex-1 bg-black/40 border border-emerald-500/10 p-3 rounded-xl text-white font-mono text-sm focus:border-emerald-500 outline-none"
                            />
                            <button
                                onClick={onWithdraw}
                                disabled={isSaving}
                                className="px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
                            >
                                <ArrowUpRight className="w-4 h-4" />
                                Withdraw
                            </button>
                        </div>
                    </div>

                    <p className="text-[9px] text-slate-500 italic mt-2">
                        *Treasury balance accumulates automatically. Multisig security required for processing.
                    </p>
                </div>
            </div>
        </div>
    );
}

