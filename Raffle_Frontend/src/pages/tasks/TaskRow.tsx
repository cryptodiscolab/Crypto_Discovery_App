import { useState, useEffect } from 'react';
import { Shield, Zap, Clock, Loader2, Twitter, ArrowRight } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { useTaskInfo, useDoTask } from '../../hooks/useContract';
import { useVerification } from '../../hooks/useVerification';
import { usePoints } from '../../shared/context/PointsContext';
import { useFarcaster } from '../../hooks/useFarcaster';
import { CONTRACTS, APP_CONFIG, DAILY_APP_ABI } from '../../lib/contracts';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Task, FarcasterProfile } from '../../types/tasks';

interface TaskRowProps {
    taskId: string | number;
    refetchStats: () => void;
    offChainClaims: Set<string>;
}

export function TaskRow({ taskId, refetchStats, offChainClaims }: TaskRowProps) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { doTask, isLoading: isDoing } = useDoTask();
    const { address } = useAccount();
    const { userTier } = usePoints();
    const { profileData } = useFarcaster() as { profileData: FarcasterProfile | null };
    const { verifyTask, isVerifying, registerTaskStart, lastActionTime } = useVerification(refetchStats);
    const [timeLeft, setTimeLeft] = useState(0);
    const navigate = useNavigate();

    // Countdown Logic
    useEffect(() => {
        const lastTime = (lastActionTime as Record<string | number, number>)[taskId];
        if (!lastTime) return;

        const updateTimer = () => {
            const now = Date.now();
            const diff = Math.floor((now - lastTime) / 1000);
            const remaining = Math.max(0, APP_CONFIG.SOCIAL_INDEX_DELAY_SEC - diff);
            setTimeLeft(remaining);
            return remaining;
        };

        const initialRemaining = updateTimer();
        if (initialRemaining <= 0) return;

        const interval = setInterval(() => {
            const remaining = updateTimer();
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [lastActionTime, taskId]);

    const { data: isCompleted, refetch: refetchCompletion } = useReadContract({
        address: CONTRACTS.DAILY_APP as `0x${string}`,
        abi: DAILY_APP_ABI,
        functionName: 'hasCompletedTask',
        args: [address as `0x${string}`, BigInt(taskId)],
        query: { enabled: !!address && !!task }
    });

    const typedTask = task as Task | null;
    const isBaseLocked = typedTask?.isBaseSocialRequired && !profileData?.is_base_social_verified;
    const isTierLocked = Number(userTier) < Number(typedTask?.minTier);
    const isOffChainCompleted = offChainClaims?.has(String(taskId).toLowerCase());
    const canDo = !isTierLocked && !isCompleted && !isBaseLocked && !isOffChainCompleted;

    if (isLoading || !typedTask || !typedTask.isActive || isCompleted || isOffChainCompleted) return null;

    const handleAction = async () => {
        if (!address) {
            toast.error("Please connect your wallet");
            return;
        }

        if (isTierLocked) {
            toast.error(`Tier ${typedTask.minTier} required for this task! Upgrade in your Profile.`, {
                icon: '🔒',
                duration: 4000
            });
            return;
        }

        if (isCompleted) {
            toast.error("You have already completed this sponsored task!");
            return;
        }

        // Farcaster Account Check
        if (!profileData?.fid && (typedTask.link.includes('warpcast.com') || typedTask.link.includes('farcaster'))) {
            toast.error("Farcaster account required for this task.");
            return;
        }

        // Base Social Identity Check
        if (typedTask.isBaseSocialRequired && !profileData?.is_base_social_verified) {
            toast.error("Identity verification required. Go to Profile.");
            navigate('/profile');
            return;
        }

        registerTaskStart(taskId);
        window.open(typedTask.link, '_blank');

        try {
            toast.loading("Registering task action...", { id: `task-${taskId}` });
            await doTask(taskId);
            toast.success("Action registered! Wait 30s before Verification.", { id: `task-${taskId}` });
            refetchCompletion();
        } catch (error: unknown) {
            console.error("DoTask error:", error);
            const err = error as { shortMessage?: string; message?: string };
            toast.error("Action failed: " + (err.shortMessage || err.message || "Unknown error"), { id: `task-${taskId}` });
        }
    };

    const handleVerify = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canDo || isVerifying || timeLeft > 0) return;

        const success = await verifyTask(typedTask, address!, taskId, profileData?.fid);
        if (success) refetchCompletion();
    };

    return (
        <div
            onClick={(!isTierLocked && !isCompleted) ? handleAction : undefined}
            className={`flex items-center justify-between p-4 border-b border-white/5 active:bg-white/5 transition-colors cursor-pointer group ${(!isTierLocked && !isCompleted) ? (isBaseLocked ? 'bg-blue-500/5' : '') : 'opacity-50 cursor-not-allowed'}`}
        >
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-500/10' : isBaseLocked ? 'bg-blue-500/10' : isTierLocked ? 'bg-slate-800' : typedTask.requiresVerification ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {isCompleted ? <Shield size={18} className="text-green-500" /> : isBaseLocked ? <Shield size={18} className="text-blue-400" /> : isTierLocked ? <Shield size={18} className="text-slate-500" /> : typedTask.platform?.toLowerCase() === 'twitter' || typedTask.title.toLowerCase().includes('twitter') ? <Twitter size={18} /> : <Zap size={18} />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="value-native text-white truncate">{typedTask.title}</span>
                        {isCompleted && (
                            <span className="label-native bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">COMPLETED</span>
                        )}
                        {isBaseLocked && (
                            <span className="label-native bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                                <Shield size={10} /> IDENTITY GUARD
                            </span>
                        )}
                        {typedTask.requiresVerification && !isCompleted && !isBaseLocked && (
                            <Shield size={12} className="text-green-500 flex-shrink-0" />
                        )}
                        {isTierLocked && (
                            <span className="label-native bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                LVL {typedTask.minTier}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 label-native">
                        <span className="text-yellow-500 flex items-center gap-1">
                            +{Number(typedTask.baseReward)} XP
                        </span>
                        {!isCompleted && typedTask.sponsorshipId === 0 && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Clock size={10} /> {Number(typedTask.cooldown) / 3600}h
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 pl-4">
                {isCompleted ? (
                    <Shield className="text-green-500" size={20} />
                ) : isBaseLocked ? (
                   <div className="flex items-center gap-2 text-blue-400 label-native border border-blue-400/30 bg-blue-400/5 px-2 py-1 rounded-lg">
                      <Shield size={12} /> VERIFY REQ
                   </div>
                ) : typedTask.requiresVerification ? (
                    <button
                        onClick={handleVerify}
                        disabled={isVerifying || isTierLocked || timeLeft > 0}
                        className={`px-4 py-1.5 rounded-full text-white label-native shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 ${timeLeft > 0 ? 'bg-zinc-800 shadow-none' : 'bg-[#0052FF] premium-glow shadow-blue-500/10'}`}
                    >
                        {isVerifying ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : timeLeft > 0 ? (
                            <>
                                <Clock size={12} className="animate-pulse" />
                                {timeLeft}s
                            </>
                        ) : (
                            "Verify"
                        )}
                    </button>
                ) : (
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                        {isDoing ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <ArrowRight size={16} className="text-slate-400 group-hover:text-white" />}
                    </div>
                )}
            </div>
        </div>
    );
}
