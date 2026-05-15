import { useAdminContract } from '../../../../../../hooks/useAdminContract';
import { Zap, Save } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../../../../../lib/contracts';
import axios from 'axios';
import toast from 'react-hot-toast';
import { RewardSettings } from '../../../../types/admin';

interface RewardSettingsCardProps {
    rewards: RewardSettings;
    setRewards: (r: RewardSettings) => void;
    drift: boolean;
}

export function RewardSettingsCard({ rewards, setRewards, drift }: RewardSettingsCardProps) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useAdminContract();

    const handleSaveRewards = async () => {
        const tid = toast.loading('Updating Global Rewards on-chain...');
        try {
            await writeContractAsync({
                address: CONTRACTS.DAILY_APP as `0x${string}`,
                abi: DAILY_APP_ABI,
                functionName: 'setGlobalRewards',
                args: [BigInt(rewards.daily), BigInt(rewards.referral)],
            });
            
            toast.loading('Syncing to Database...', { id: tid });
            const message = `Sync Rewards: Daily=${rewards.daily}, Ref=${rewards.referral}`;
            const signature = await signMessageAsync({ message });

            await axios.post('/api/admin-bundle', {
                wallet_address: address,
                signature,
                message,
                action: 'BATCH_UPDATE_POINTS',
                payload: [
                    { activity_key: 'daily_claim', points_value: parseInt(rewards.daily) },
                    { activity_key: 'referral_invite', points_value: parseInt(rewards.referral) }
                ]
            });

            toast.success('Rewards updated on-chain & in DB!', { id: tid });
        } catch (err: any) {
            toast.error(err.message, { id: tid });
        }
    };

    return (
        <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Global Rewards (DailyApp)
                    {drift && <span className="ml-2 px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded-full animate-pulse">DRIFT DETECTED</span>}
                </h3>
                <button onClick={handleSaveRewards} className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/20 active:scale-95">
                    <Save className="w-4 h-4" /> Save Rewards
                </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Daily Claim XP</label>
                    <input 
                        type="number" 
                        value={rewards.daily} 
                        onChange={e => setRewards({ ...rewards, daily: e.target.value })} 
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" 
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Referral XP</label>
                    <input 
                        type="number" 
                        value={rewards.referral} 
                        onChange={e => setRewards({ ...rewards, referral: e.target.value })} 
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" 
                    />
                </div>
            </div>
        </div>
    );
}
