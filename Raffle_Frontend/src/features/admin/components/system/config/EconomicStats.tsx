import { useAccount, useSignMessage } from 'wagmi';
import axios from 'axios';
import toast from 'react-hot-toast';
import { RewardSettings, RaffleXp, TierWeights } from '../../../../types/admin';

interface EconomicStatsProps {
    totalPoolBalance: bigint;
    rewards: RewardSettings;
    drift: {
        rewards: boolean;
        raffleXp: boolean;
        tierWeights: boolean;
    };
    raffleXp: RaffleXp;
    tierWeights: TierWeights;
}

export function EconomicStats({ totalPoolBalance, rewards, drift, raffleXp, tierWeights }: EconomicStatsProps) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const handleEmergencySync = async () => {
        const tid = toast.loading('Force Syncing all settings to DB...');
        try {
            const message = `Emergency Parity Sync\nTime: ${new Date().toISOString()}`;
            const signature = await signMessageAsync({ message });

            await axios.post('/api/admin-bundle', {
                wallet_address: address,
                signature,
                message,
                action: 'BATCH_UPDATE_POINTS',
                payload: [
                    { activity_key: 'daily_claim', points_value: parseInt(rewards.daily) },
                    { activity_key: 'referral_invite', points_value: parseInt(rewards.referral) },
                    { activity_key: 'raffle_create', points_value: parseInt(raffleXp.create) },
                    { activity_key: 'raffle_claim', points_value: parseInt(raffleXp.claim) },
                    { activity_key: 'raffle_buy', points_value: parseInt(raffleXp.purchase) }
                ]
            });

            await axios.post('/api/admin-bundle', {
                wallet_address: address,
                signature,
                message,
                action: 'SYNC_WEIGHTS',
                payload: tierWeights
            });

            toast.success('Full System Parity Restored!', { id: tid });
        } catch (e: unknown) {
            toast.error(e.message, { id: tid });
        }
    };

    const sustainabilityDays = ((Number(totalPoolBalance) / 1e18) / (Number(rewards.daily) * 0.0001 || 1)).toFixed(1);
    const isHealthy = !drift.rewards && !drift.raffleXp && !drift.tierWeights;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Pool Sustainability</p>
                <div className="flex items-end justify-between">
                    <span className="text-2xl font-black text-white">
                        {sustainabilityDays} Days
                    </span>
                    <span className="text-[10px] text-slate-500 mb-1">at current rate</span>
                </div>
            </div>

            <div className="glass-card p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">System Health</p>
                <div className="flex items-end justify-between">
                    <span className="text-2xl font-black text-white">
                        {isHealthy ? 'HEALTHY' : 'WARNING'}
                    </span>
                    <span className={`text-[10px] mb-1 font-bold ${!isHealthy ? 'text-red-400' : 'text-emerald-400'}`}>
                        {!isHealthy ? 'Drift Detected' : 'Parity Locked'}
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <button
                    onClick={handleEmergencySync}
                    className="h-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                >
                    Emergency Parity Sync
                </button>
            </div>
        </div>
    );
}

