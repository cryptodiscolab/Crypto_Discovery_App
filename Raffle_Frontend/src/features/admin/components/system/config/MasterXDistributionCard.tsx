import { useAdminContract } from '../../../../../hooks/useAdminContract';
import { Activity } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { CONTRACTS, MASTER_X_ABI } from '../../../../../lib/contracts';
import axios from 'axios';
import toast from 'react-hot-toast';
import { EconShares, TierWeights } from '../../../../types/admin';

interface MasterXDistributionCardProps {
    econShares: EconShares;
    setEconShares: (_s: EconShares) => void;
    tierWeights: TierWeights;
    setTierWeights: (_w: TierWeights) => void;
    drift: boolean;
    isSaving: boolean;
    setIsSaving: (_s: boolean) => void;
}

export function MasterXDistributionCard({
    econShares, setEconShares,
    tierWeights, setTierWeights,
    drift, isSaving, setIsSaving
}: MasterXDistributionCardProps) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useAdminContract();

    const handleSaveEconShares = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing MasterX Shares...");
        try {
            await writeContractAsync({
                address: CONTRACTS.MASTER_X as `0x${string}`,
                abi: MASTER_X_ABI,
                functionName: 'setRevenueShares',
                args: [BigInt(econShares.owner), BigInt(econShares.ops), BigInt(econShares.treasury), BigInt(econShares.sbt)],
            });
            toast.success("Revenue Shares Updated!", { id: tid });
        } catch (e: unknown) {
            toast.error(e.shortMessage || e.message, { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTierWeights = async () => {
        const tid = toast.loading('Updating Tier Weights on-chain...');
        try {
            await writeContractAsync({
                address: CONTRACTS.MASTER_X as `0x${string}`,
                abi: MASTER_X_ABI,
                functionName: 'setTierWeights',
                args: [
                    BigInt(tierWeights.diamond),
                    BigInt(tierWeights.platinum),
                    BigInt(tierWeights.gold),
                    BigInt(tierWeights.silver),
                    BigInt(tierWeights.bronze)
                ],
            });

            toast.loading('Syncing to Database...', { id: tid });
            const message = `Sync Weights: D=${tierWeights.diamond}, P=${tierWeights.platinum}, G=${tierWeights.gold}, S=${tierWeights.silver}, B=${tierWeights.bronze}`;
            const signature = await signMessageAsync({ message });

            await axios.post('/api/admin-bundle', {
                wallet_address: address,
                signature,
                message,
                action: 'SYNC_WEIGHTS',
                payload: tierWeights
            });

            toast.success('Weights updated on-chain & in DB!', { id: tid });
        } catch (err: unknown) {
            toast.error(err.message, { id: tid });
        }
    };

    return (
        <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 lg:col-span-2 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    Protocol Distribution (MasterX)
                    {drift && <span className="ml-2 px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded-full animate-pulse">WEIGHT DRIFT</span>}
                </h2>
                <div className="flex gap-2">
                    <button onClick={handleSaveEconShares} disabled={isSaving} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                        Update Revenue Shares
                    </button>
                    <button onClick={handleSaveTierWeights} disabled={isSaving} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50">
                        Update Tier Weights
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Shares (BP - Total 10000)</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase text-left">Owner</label>
                            <input type="number" value={econShares.owner} onChange={e => setEconShares({ ...econShares, owner: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase">Operations</label>
                            <input type="number" value={econShares.ops} onChange={e => setEconShares({ ...econShares, ops: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase">Treasury</label>
                            <input type="number" value={econShares.treasury} onChange={e => setEconShares({ ...econShares, treasury: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase">SBT Pool</label>
                            <input type="number" value={econShares.sbt} onChange={e => setEconShares({ ...econShares, sbt: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SBT Pool Distribution Weights</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-cyan-400 uppercase">Diamond</label>
                            <input type="number" value={tierWeights.diamond} onChange={e => setTierWeights({ ...tierWeights, diamond: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-indigo-300 uppercase">Platinum</label>
                            <input type="number" value={tierWeights.platinum} onChange={e => setTierWeights({ ...tierWeights, platinum: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-amber-400 uppercase">Gold</label>
                            <input type="number" value={tierWeights.gold} onChange={e => setTierWeights({ ...tierWeights, gold: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Silver</label>
                            <input type="number" value={tierWeights.silver} onChange={e => setTierWeights({ ...tierWeights, silver: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-amber-700 uppercase">Bronze</label>
                            <input type="number" value={tierWeights.bronze} onChange={e => setTierWeights({ ...tierWeights, bronze: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

