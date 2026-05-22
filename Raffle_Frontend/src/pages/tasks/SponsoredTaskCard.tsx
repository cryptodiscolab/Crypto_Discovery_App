import { useState } from 'react';
import { Shield, Award, Gift, Loader2 } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { useVerification } from '../../hooks/useVerification';
import { useFarcaster } from '../../hooks/useFarcaster';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Task, FarcasterProfile } from '../../types/tasks';
import { IndividualTaskRow } from './IndividualTaskRow';

interface SponsoredTaskCardProps {
    sponsorshipId: string | number;
    tasks: Task[];
    refetchStats: () => void;
    offChainClaims: Set<string>;
}

export function SponsoredTaskCard({ sponsorshipId, tasks, refetchStats, offChainClaims }: SponsoredTaskCardProps) {
    const navigate = useNavigate();
    const { profileData } = useFarcaster() as { profileData: FarcasterProfile | null };
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { verifyTask, registerTaskStart, isVerifying } = useVerification(refetchStats);
    const [verifyingStatus, setVerifyingStatus] = useState<'success' | 'fail' | null>(null);
    const [timer, setTimer] = useState(0);
    const [isClaiming, setIsClaiming] = useState(false);

    const rawClaimable = 0n;
    const progress = 0;
    const refetchRewards = async () => {};

    const progressCount = Number(progress || 0);
    const isGlobalCompleted = progressCount >= tasks.length;

    const hasGatedTask = tasks.some(t => t.isBaseSocialRequired);
    const isIdentityBlocked = hasGatedTask && !profileData?.is_base_social_verified;

    if (isGlobalCompleted && (!rawClaimable || rawClaimable === 0n)) return null;

    const handleVerifyCard = async () => {
        setVerifyingStatus(null);
        let allSuccess = true;
        const tid = toast.loading("System verifying tasks...");

        try {
            for (const t of tasks) {
                const success = await verifyTask(t, address as string, t.id as number);
                if (!success) {
                    allSuccess = false;
                    break;
                }
            }

            if (allSuccess) {
                setVerifyingStatus('success');
                setTimer(30);
                toast.success("Verified by system!", { id: tid });
                const interval = setInterval(() => {
                    setTimer(prev => {
                        if (prev <= 1) {
                            clearInterval(interval);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                setVerifyingStatus('fail');
                toast.error("You are not Verified, please complete task", { id: tid });
            }
        } catch (err) {
            toast.error("Verification error", { id: tid });
        }
    };

    const handleClaim = async () => {
        const tid = toast.loading("Claiming Mission Reward...");
        setIsClaiming(true);
        try {
            toast.loading("Syncing verified mission...", { id: tid });
            const syncMsg = `Sync verified sponsored mission\nWallet: ${address}\nSponsorship: ${sponsorshipId}`;
            const syncSig = await signMessageAsync({ message: syncMsg });

            const res = await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'xp',
                    wallet_address: address,
                    signature: syncSig,
                    message: syncMsg,
                }),
            });

            if (res.ok) {
                await Promise.all([
                    refetchRewards(),
                    refetchStats()
                ]);
            }

            toast.success("Mission Reward Claimed! 🎉", { id: tid });
            setVerifyingStatus(null);
        } catch (err: unknown) {
            const error = err as { shortMessage?: string; message?: string };
            toast.error(error.shortMessage || error.message || "Claim failed", { id: tid });
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <div className={`glass-card overflow-hidden transition-colors ${verifyingStatus === 'success' ? 'ring-1 ring-green-500/40' : ''}`}>
            <div className="px-4 py-3 bg-[#080808]/80 border-b border-white/5 flex justify-between items-center backdrop-blur-3xl">
                <div className="flex items-center gap-2">
                    {hasGatedTask ? (
                        <Shield className="text-blue-400 animate-pulse" size={18} />
                    ) : (
                        <Award className="text-yellow-400" size={18} />
                    )}
                    <span className={`label-native italic ${hasGatedTask ? 'text-blue-400 font-black' : 'text-white'}`}>
                        {hasGatedTask ? 'IDENTITY GUARDED MISSION' : 'Sponsored Mission'}
                    </span>
                </div>
                {isGlobalCompleted && (
                    <span className="label-native bg-green-500/20 text-green-400 px-2 py-0.5 rounded-md border border-green-500/30">Mission Accomplished</span>
                )}
            </div>

            <div className="divide-y divide-white/5">
                {tasks.map((task) => (
                    <IndividualTaskRow
                        key={task.id}
                        task={task}
                        address={address}
                        onAction={() => registerTaskStart(task.id as number)}
                        offChainClaims={offChainClaims}
                    />
                ))}
            </div>

            <div className="p-4 bg-black/20 border-t border-white/5 space-y-4">
                {verifyingStatus === 'success' && timer > 0 && (
                    <div className="bg-green-500/10 text-green-400 p-3 rounded-xl border border-green-500/20 text-center animate-pulse">
                        <p className="label-native mb-1">Status: Verified</p>
                        <p className="label-native">Claim rewarding in {timer}s...</p>
                    </div>
                )}

                {((verifyingStatus === 'success' && timer === 0) || rawClaimable > 0n) && (
                    <button
                        onClick={handleClaim}
                        disabled={isClaiming}
                        className="w-full bg-green-600 hover:bg-green-500 py-3.5 rounded-xl text-white label-native transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-900/20"
                    >
                        {isClaiming ? <Loader2 className="animate-spin" size={14} /> : <Gift size={14} />}
                        Claim Task Reward
                    </button>
                )}

                {verifyingStatus === 'fail' && (
                    <div className="bg-red-500/10 text-red-400 p-3 rounded-xl border border-red-500/20 text-center">
                        <p className="label-native mb-1">Verification Failed</p>
                        <p className="label-native">Please ensure all tasks are completed</p>
                    </div>
                )}

                {!isGlobalCompleted && verifyingStatus !== 'success' && (
                    <button
                        onClick={isIdentityBlocked ? () => {
                            toast.error("Identity verification required to start this mission!");
                            navigate('/profile');
                        } : handleVerifyCard}
                        disabled={isVerifying}
                        className={`w-full py-3.5 rounded-xl text-white label-native transition-all active:scale-95 disabled:opacity-50 shadow-xl
                          ${isIdentityBlocked
                            ? 'bg-blue-600/10 border border-blue-500/30 text-[#0052FF] hover:bg-blue-600/20'
                            : 'bg-[#0052FF] premium-glow shadow-blue-500/20'}`}
                    >
                        {isVerifying ? "SYSTEM CHECKING..." : isIdentityBlocked ? "VERIFY IDENTITY TO UNLOCK" : "VERIFY MISSION"}
                    </button>
                )}
            </div>
        </div>
    );
}
