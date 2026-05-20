import { useAdminContract } from '../../../../../hooks/useAdminContract';
import { Cpu } from 'lucide-react';
import { CONTRACTS, MASTER_X_ABI } from '../../../../../lib/contracts';
import toast from 'react-hot-toast';
import { MasterParams } from '../../../../types/admin';

interface MasterXProtocolParamsCardProps {
    masterParams: MasterParams;
    setMasterParams: (_p: MasterParams) => void;
    isSaving: boolean;
    setIsSaving: (_s: boolean) => void;
}

export function MasterXProtocolParamsCard({
    masterParams, setMasterParams,
    isSaving, setIsSaving
}: MasterXProtocolParamsCardProps) {
    const { writeContractAsync } = useAdminContract();

    const handleSaveMasterParams = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating MasterX Protocol Parameters...");
        try {
            await writeContractAsync({
                address: CONTRACTS.MASTER_X as `0x${string}`,
                abi: MASTER_X_ABI,
                functionName: 'setParams',
                args: [
                    BigInt(masterParams.tUSDC),
                    BigInt(masterParams.mGas),
                    BigInt(masterParams.pPerTicket),
                    masterParams.desc
                ],
            });
            toast.success("MasterX Parameters Updated!", { id: tid });
        } catch (e: unknown) {
            const error = e as { shortMessage?: string; message?: string };
            toast.error(error.shortMessage || error.message || "Update failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="glass-card p-6 bg-blue-900/10 border border-blue-500/10 space-y-4 rounded-2xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" /> MASTERX PROTOCOL PARAMETERS
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Ticket Price (USDC - 6 Dec)</label>
                    <input type="number" value={masterParams.tUSDC} onChange={e => setMasterParams({ ...masterParams, tUSDC: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                    <p className="text-[9px] text-slate-500 italic">150000 = $0.15</p>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Points Per Ticket</label>
                    <input type="number" value={masterParams.pPerTicket} onChange={e => setMasterParams({ ...masterParams, pPerTicket: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Max Gas Price (Wei)</label>
                    <input type="text" value={masterParams.mGas} onChange={e => setMasterParams({ ...masterParams, mGas: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Ticket Description</label>
                    <input type="text" value={masterParams.desc} onChange={e => setMasterParams({ ...masterParams, desc: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                </div>
            </div>
            <button onClick={handleSaveMasterParams} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                Push Protocol Settings to Contract
            </button>
        </div>
    );
}

