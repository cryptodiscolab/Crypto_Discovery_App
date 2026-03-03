import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useReadContract, useWriteContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../../../lib/contracts';
import toast from 'react-hot-toast';

export function SponsorshipConfigSection() {
    const [fee, setFee] = useState('1');
    const [autoApprove, setAutoApprove] = useState(false);
    const [rewardPerClaim, setRewardPerClaim] = useState('100');
    const [tasksForReward, setTasksForReward] = useState('3');
    const [minPool, setMinPool] = useState('10');
    const [isSaving, setIsSaving] = useState(false);

    const { data: currentFee } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: currentAutoApprove } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'autoApproveSponsorship' });
    const { data: currentReward } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipRewardPerClaim' });
    const { data: currentTasks } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipTasksForReward' });
    const { data: currentMinPool } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipMinPoolValue' });

    useEffect(() => {
        if (currentFee) setFee((Number(currentFee) / 1e6).toString());
        if (currentAutoApprove !== undefined) setAutoApprove(currentAutoApprove);
        if (currentReward) setRewardPerClaim(currentReward.toString());
        if (currentTasks) setTasksForReward(currentTasks.toString());
        if (currentMinPool) setMinPool((Number(currentMinPool) / 1e6).toString());
    }, [currentFee, currentAutoApprove, currentReward, currentTasks, currentMinPool]);

    const { writeContractAsync } = useWriteContract();

    const handleSaveSponsorshipConfig = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating Sponsorship Params...");
        try {
            // Update Platform Fee if changed
            if (fee !== (Number(currentFee) / 1e6).toString()) {
                await writeContractAsync({
                    address: CONTRACTS.DAILY_APP,
                    abi: DAILY_APP_ABI,
                    functionName: 'setSponsorshipPlatformFee',
                    args: [BigInt(Number(fee) * 1e6)],
                });
            }

            // Update Global Params
            await writeContractAsync({
                address: CONTRACTS.DAILY_APP,
                abi: DAILY_APP_ABI,
                functionName: 'setSponsorshipParams',
                args: [
                    BigInt(rewardPerClaim),
                    BigInt(tasksForReward),
                    BigInt(Number(minPool) * 1e6),
                    BigInt(Number(fee) * 1e6)
                ],
            });

            // Update Auto-Approve if changed
            if (autoApprove !== currentAutoApprove) {
                await writeContractAsync({
                    address: CONTRACTS.DAILY_APP,
                    abi: DAILY_APP_ABI,
                    functionName: 'setAutoApproveSponsorship',
                    args: [autoApprove],
                });
            }

            toast.success("Sponsorship Settings Updated!", { id: tid });
        } catch (error) {
            console.error(error);
            toast.error("Update Failed: " + (error.shortMessage || error.message), { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="glass-card p-8 bg-slate-900/40 border border-white/5 space-y-6 rounded-3xl">
            <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-500" /> SPONSORSHIP CONTROL
                </h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1 text-left">Configure UGC Task parameters</p>
            </div>

            <div className="space-y-4 text-left">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Platform Fee (USDC)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                            <input
                                type="number"
                                value={fee}
                                onChange={(e) => setFee(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Min Pool (USDC)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                            <input
                                type="number"
                                value={minPool}
                                onChange={(e) => setMinPool(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Reward/Claim (XP)</label>
                        <input
                            type="number"
                            value={rewardPerClaim}
                            onChange={(e) => setRewardPerClaim(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Tasks/Reward</label>
                        <input
                            type="number"
                            value={tasksForReward}
                            onChange={(e) => setTasksForReward(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                    <div>
                        <p className="text-xs font-bold text-white uppercase">Auto-Approve UGC</p>
                        <p className="text-[9px] text-slate-500">When enabled, user tasks go live instantly after payment.</p>
                    </div>
                    <button
                        onClick={() => setAutoApprove(!autoApprove)}
                        className={`w-12 h-6 rounded-full transition-all relative ${autoApprove ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoApprove ? 'right-1' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            <button
                onClick={handleSaveSponsorshipConfig}
                disabled={isSaving}
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/10 active:scale-[0.98] disabled:opacity-50"
            >
                {isSaving ? "TRANSACTING..." : "PUSH CONFIG TO BLOCKCHAIN"}
            </button>
        </div>
    );
}
