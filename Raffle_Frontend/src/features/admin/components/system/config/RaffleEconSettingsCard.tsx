import { ShieldCheck } from 'lucide-react';
import { useAccount, useSignMessage, useWriteContract, usePublicClient } from 'wagmi';
import { CONTRACTS, RAFFLE_ABI } from '../../../../../lib/contracts';
import axios from 'axios';
import toast from 'react-hot-toast';
import { RaffleFees, RaffleLimits, RaffleXp } from '../../../../types/admin';

interface RaffleEconSettingsCardProps {
    raffleFees: RaffleFees;
    setRaffleFees: (f: RaffleFees) => void;
    raffleLimits: RaffleLimits;
    setRaffleLimits: (l: RaffleLimits) => void;
    raffleXp: RaffleXp;
    setRaffleXp: (x: RaffleXp) => void;
    drift: boolean;
    isSaving: boolean;
    setIsSaving: (s: boolean) => void;
}

export function RaffleEconSettingsCard({ 
    raffleFees, setRaffleFees, 
    raffleLimits, setRaffleLimits, 
    raffleXp, setRaffleXp, 
    drift, isSaving, setIsSaving 
}: RaffleEconSettingsCardProps) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const handleSaveRaffleFees = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Raffle Fees...");
        try {
            const hash = await writeContractAsync({
                address: CONTRACTS.RAFFLE as `0x${string}`,
                abi: RAFFLE_ABI,
                functionName: 'setRaffleFees',
                args: [BigInt(raffleFees.rake), BigInt(raffleFees.surcharge)],
            });
            await publicClient!.waitForTransactionReceipt({ hash });
            toast.success("Raffle Fees Updated!", { id: tid });
        } catch (e: any) { 
            toast.error(e.shortMessage || e.message, { id: tid }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleSaveRaffleLimits = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Raffle Limits...");
        try {
            const hash = await writeContractAsync({
                address: CONTRACTS.RAFFLE as `0x${string}`,
                abi: RAFFLE_ABI,
                functionName: 'setRaffleLimits',
                args: [BigInt(raffleLimits.maxUser), BigInt(raffleLimits.maxParticipants)],
            });
            await publicClient!.waitForTransactionReceipt({ hash });
            toast.success("Raffle Limits Updated!", { id: tid });
        } catch (e: any) { 
            toast.error(e.shortMessage || e.message, { id: tid }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleSaveRaffleXp = async () => {
        const tid = toast.loading('Updating Raffle XP on-chain...');
        try {
            const hash = await writeContractAsync({
                address: CONTRACTS.RAFFLE as `0x${string}`,
                abi: RAFFLE_ABI,
                functionName: 'setXpRewards',
                args: [BigInt(raffleXp.create), BigInt(raffleXp.claim), BigInt(raffleXp.purchase)],
            });
            await publicClient!.waitForTransactionReceipt({ hash });

            toast.loading('Syncing to Database...', { id: tid });
            const message = `Sync Raffle XP: Create=${raffleXp.create}, Claim=${raffleXp.claim}, Buy=${raffleXp.purchase}`;
            const signature = await signMessageAsync({ message });

            await axios.post('/api/admin-bundle', {
                wallet_address: address,
                signature,
                message,
                action: 'BATCH_UPDATE_POINTS',
                payload: [
                    { activity_key: 'raffle_create', points_value: parseInt(raffleXp.create) },
                    { activity_key: 'raffle_claim', points_value: parseInt(raffleXp.claim) },
                    { activity_key: 'raffle_buy', points_value: parseInt(raffleXp.purchase) }
                ]
            });

            toast.success('Raffle XP updated on-chain & in DB!', { id: tid });
        } catch (err: any) {
            toast.error(err.message, { id: tid });
        }
    };

    return (
        <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                    Raffle Economics
                    {drift && <span className="ml-2 px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded-full animate-pulse">XP DRIFT</span>}
                </h2>
                <div className="flex gap-2">
                    <button onClick={handleSaveRaffleFees} disabled={isSaving} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50">
                        Update Fees
                    </button>
                    <button onClick={handleSaveRaffleLimits} disabled={isSaving} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50">
                        Update Limits
                    </button>
                    <button onClick={handleSaveRaffleXp} disabled={isSaving} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
                        Update XP
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Rake BP (2000 = 20%)</label>
                    <input type="number" value={raffleFees.rake} onChange={e => setRaffleFees({ ...raffleFees, rake: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Surcharge BP (500 = 5%)</label>
                    <input type="number" value={raffleFees.surcharge} onChange={e => setRaffleFees({ ...raffleFees, surcharge: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                </div>
            </div>

            <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Max Tickets/User</label>
                    <input type="number" value={raffleLimits.maxUser} onChange={e => setRaffleLimits({ ...raffleLimits, maxUser: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Max Participants</label>
                    <input type="number" value={raffleLimits.maxParticipants} onChange={e => setRaffleLimits({ ...raffleLimits, maxParticipants: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                </div>
            </div>
        </div>
    );
}
