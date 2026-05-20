import { useState, useEffect } from 'react';
import { Sparkles, Flame } from 'lucide-react';
import { useAccount, useWriteContract, usePublicClient, useSignMessage, useChainId } from 'wagmi';
import toast from 'react-hot-toast';
import { useUserInfo } from '../../../../hooks/useContract';
import { usePoints } from '../../../../shared/context/PointsContext';
import { DAILY_APP_ABI, CONTRACTS } from '../../../../lib/contracts';
import { usePendingSyncRecovery } from '../../../../hooks/usePendingSyncRecovery';

interface PointSettings {
    daily_claim?: number;
}

interface DailyClaimModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    pointSettings?: PointSettings;
    streakCount?: number;
}

/**
 * DailyClaimModal Component
 * [v3.60.0] Modular Feature-Based Architecture
 */
export function DailyClaimModal({ onClose, onSuccess, pointSettings, streakCount }: DailyClaimModalProps) {
    const { address } = useAccount();
    const chainId = useChainId();
    const { recordFailure: recordPendingSync } = usePendingSyncRecovery();
    const { writeContractAsync } = useWriteContract();
    const { signMessageAsync } = useSignMessage();
    const publicClient = usePublicClient();
    const { refetch: refetchPoints, ecosystemSettings } = usePoints();
    const [isClaiming, setIsClaiming] = useState(false);
    const [countdown, setCountdown] = useState('');
    const [isCooldown, setIsCooldown] = useState(false);

    const { stats: userData, refetch: refetchOnChainStats, isLoading: isStatsLoading } = useUserInfo(address);
    const dailyReward = pointSettings?.daily_claim || (ecosystemSettings as { daily_claim?: number })?.daily_claim || 0;

    const lastDailyClaim = userData?.lastDailyBonusClaim ? Number(userData.lastDailyBonusClaim) : 0;
    const nextClaimTime = lastDailyClaim > 0
        ? (lastDailyClaim + ((ecosystemSettings as { daily_claim_cooldown_sec?: number })?.daily_claim_cooldown_sec || 86400)) * 1000
        : 0;

    useEffect(() => {
        const tick = () => {
            const diff = nextClaimTime - Date.now();
            if (diff <= 0) { setIsCooldown(false); setCountdown(''); return; }
            setIsCooldown(true);
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [nextClaimTime]);

    const handleClaim = async () => {
        if (isCooldown) return toast.error("Cooldown active!");
        setIsClaiming(true);
        const tid = toast.loading("Preparing claim...");
        try {
            const hash = await writeContractAsync({ address: CONTRACTS.DAILY_APP as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'claimDailyBonus' });
            toast.loading('Mining transaction...', { id: tid });
            await publicClient!.waitForTransactionReceipt({ hash });
            toast.loading('Syncing XP...', { id: tid });
            try {
                const syncMsg = `Sync Daily Claim\nTx: ${hash}\nWallet: ${address}`;
                const syncSig = await signMessageAsync({ message: syncMsg });
                const syncRes = await fetch('/api/user-bundle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'xp', wallet_address: address, tx_hash: hash, signature: syncSig, message: syncMsg }) });
                if (!syncRes.ok) throw new Error(`Sync API returned ${syncRes.status}`);
                await new Promise(r => setTimeout(r, 1500));
                await Promise.all([refetchOnChainStats(), refetchPoints()]);
                toast.success(`+${dailyReward} XP Claimed! 🎉`, { id: tid });
                if (onSuccess) onSuccess();
                onClose();
            } catch (syncErr: unknown) {
                const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
                // Chain succeeded but backend XP sync failed — record for reconciliation cron.
                recordPendingSync({
                    actionType: 'daily_claim',
                    txHash: hash,
                    chainId,
                    contractAddress: CONTRACTS.DAILY_APP as string,
                    payload: { reward_xp: dailyReward },
                    errorMessage: syncMsg
                }).catch(() => {});
                toast.success('Claim confirmed on-chain. XP sync pending — will retry automatically.', { id: tid, duration: 6000 });
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err: unknown) {
            const error = err as { shortMessage?: string; message?: string };
            toast.error('Claim failed: ' + (error.shortMessage || error.message || 'Try again'), { id: tid });
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-sm p-8 space-y-6 text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all ${isCooldown ? 'bg-slate-500/10' : 'bg-emerald-500/20 animate-pulse'}`}>
                    <Sparkles size={40} className={isCooldown ? 'text-slate-500' : 'text-emerald-400'} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">DAILY <span className="text-emerald-500">MOJO</span></h2>
                    <p className="text-[11px] text-slate-400 mt-2 font-black uppercase tracking-widest">
                        {isCooldown ? "COOLDOWN ACTIVE" : `CLAIM YOUR DAILY ${dailyReward} XP BOOST!`}
                    </p>
                </div>
                {(streakCount ?? 0) > 0 && (
                    <div className="flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/20 py-2 px-4 rounded-xl w-fit mx-auto">
                        <Flame size={16} className="text-orange-500 fill-current" />
                        <span className="text-[11px] font-black text-orange-400 uppercase tracking-widest italic">{streakCount} DAY STREAK 🔥</span>
                    </div>
                )}
                {isCooldown && countdown && (
                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl py-4 px-6">
                        <p className="text-3xl font-black font-mono text-indigo-400 tracking-widest">{countdown}</p>
                    </div>
                )}
                <button
                    onClick={handleClaim}
                    disabled={isClaiming || isCooldown || isStatsLoading}
                    className={`w-full py-4 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all ${isCooldown || isStatsLoading ? 'bg-slate-800 cursor-not-allowed text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                >
                    {isClaiming ? 'PROCESSING...' : isCooldown ? `COOLDOWN: ${countdown}` : `CLAIM DAILY (+${dailyReward} XP)`}
                </button>
                <button onClick={onClose} className="text-[11px] text-slate-500 uppercase font-black tracking-widest">MAYBE LATER</button>
            </div>
        </div>
    );
}
