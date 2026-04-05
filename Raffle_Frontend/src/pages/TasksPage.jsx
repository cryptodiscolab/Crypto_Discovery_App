import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Shield, Sparkles, CheckCircle, CheckCircle2, Clock, ExternalLink, Loader2, Award, Zap, Twitter, MessageSquare, ArrowRight, Gift, Megaphone } from 'lucide-react';
import { useAccount, useSignMessage, useReadContract, useWriteContract } from 'wagmi';
import { useAllTasks, useTaskInfo, useDoTask, useUserV12Stats } from '../hooks/useContract';
import { useVerification } from '../hooks/useVerification';
import { usePoints } from '../shared/context/PointsContext';
import { useFarcaster } from '../hooks/useFarcaster';
import { ABIS, CONTRACTS, APP_CONFIG, DAILY_APP_ABI } from '../lib/contracts';
import toast from 'react-hot-toast';
import { TaskList } from '../components/tasks/TaskList';
import { OffersList } from '../components/tasks/OffersList';
import { useNavigate } from 'react-router-dom';

function TaskRow({ taskId, userStats, refetchStats }) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { doTask, isLoading: isDoing } = useDoTask();
    const { address } = useAccount();
    const { userTier } = usePoints();
    const { profileData } = useFarcaster();
    const { verifyTask, isVerifying, registerTaskStart, lastActionTime } = useVerification(refetchStats);
    const [timeLeft, setTimeLeft] = useState(0);
    const navigate = useNavigate();

    // Countdown Logic
    useEffect(() => {
        const lastTime = lastActionTime[taskId];
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

    // NEW: Check if task is already completed (One-time logic)
    const { data: isCompleted, refetch: refetchCompletion } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasCompletedTask',
        args: [address, taskId],
        query: { enabled: !!address && !!task }
    });

    const isBaseLocked = task?.isBaseSocialRequired && !profileData?.is_base_social_verified;
    const isTierLocked = Number(userTier) < Number(task?.minTier);
    const canDo = !isTierLocked && !isCompleted && !isBaseLocked;

    if (isLoading || !task || !task.isActive || isCompleted) return null;

    const handleAction = async () => {
        if (!address) {
            toast.error("Please connect your wallet");
            return;
        }

        if (isTierLocked) {
            toast.error(`Tier ${task.minTier} required for this task! Upgrade in your Profile.`, {
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
        if (!profileData?.fid && (task.link.includes('warpcast.com') || task.link.includes('farcaster'))) {
            toast((t) => (
                <div className="flex flex-col gap-3 p-1">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        Farcaster Required
                    </span>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                        This task requires a Farcaster account. Join now to start earning XP!
                    </p>
                    <a
                        href={APP_CONFIG.FARCASTER_REFERRAL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-indigo-600 rounded-lg text-white text-[11px] font-black uppercase tracking-[0.2em] text-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Sign Up for Farcaster
                    </a>
                </div>
            ), { duration: 8000, id: 'fc-referral-nudge' });
            return;
        }

        // Base Social Identity Check (v3.42.0 Hardening)
        if (task.isBaseSocialRequired && !profileData?.is_base_social_verified) {
            toast((t) => (
                <div className="flex flex-col gap-3 p-1">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <Shield className="w-3 h-3 text-blue-400" />
                        Identity Verification Required
                    </span>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                        THIS PREMIUM TASK REQUIRES A VERIFIED <span className="text-blue-400">BASE SOCIAL (BASENAMES)</span> IDENTITY.
                    </p>
                    <button
                        onClick={() => {
                            toast.dismiss(t.id);
                            navigate('/profile');
                        }}
                        className="w-full py-2 bg-blue-600 rounded-lg text-white text-[11px] font-black uppercase tracking-[0.2em] text-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                    >
                        GO TO PROFILE TO VERIFY
                    </button>
                </div>
            ), { duration: 8000, id: 'base-social-nudge' });
            return;
        }

        // 1. Register start time for anti-fraud (30s)
        registerTaskStart(taskId);

        // 2. Open link in new tab
        window.open(task.link, '_blank');

        // 3. Call doTask on-chain (registers intent/cooldown)
        try {
            toast.loading("Registering task action...", { id: `task-${taskId}` });
            await doTask(taskId);
            toast.success("Action registered! Wait 30s before Verification.", { id: `task-${taskId}` });
            refetchCompletion();
        } catch (error) {
            console.error("DoTask error:", error);
            toast.error("Action failed: " + (error.shortMessage || error.message), { id: `task-${taskId}` });
        }
    };

    const handleVerify = async (e) => {
        e.stopPropagation();
        if (!canDo || isVerifying || timeLeft > 0) return;

        // Farcaster Referral Nudge
        if (!profileData?.fid && (task.link.includes('warpcast.com') || task.link.includes('farcaster'))) {
            toast((t) => (
                <div className="flex flex-col gap-3 p-1">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        Verification Blocked
                    </span>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                        Cannot verify Farcaster tasks without a connected account.
                    </p>
                    <a
                        href={APP_CONFIG.FARCASTER_REFERRAL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-indigo-600 rounded-lg text-white text-[11px] font-black uppercase tracking-[0.2em] text-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Join Farcaster
                    </a>
                </div>
            ), { duration: 8000, id: 'fc-verify-blocked' });
            return;
        }

        const success = await verifyTask(task, address, taskId, profileData?.fid);
        if (success) refetchCompletion();
    };

    return (
        <div
            onClick={(!isTierLocked && !isCompleted) ? (isBaseLocked ? handleAction : handleAction) : undefined}
            className={`flex items-center justify-between p-4 border-b border-white/5 active:bg-white/5 transition-colors cursor-pointer group ${(!isTierLocked && !isCompleted) ? (isBaseLocked ? 'bg-blue-500/5' : '') : 'opacity-50 cursor-not-allowed'}`}
        >
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Icon Box */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-500/10' : isBaseLocked ? 'bg-blue-500/10' : isTierLocked ? 'bg-slate-800' : task.requiresVerification ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {isCompleted ? <CheckCircle size={18} className="text-green-500" /> : isBaseLocked ? <Shield size={18} className="text-blue-400" /> : isTierLocked ? <Shield size={18} className="text-slate-500" /> : task.platform?.toLowerCase() === 'twitter' || task.title.toLowerCase().includes('twitter') ? <Twitter size={18} /> : <Zap size={18} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="value-native text-white truncate">{task.title}</span>
                        {isCompleted && (
                            <span className="label-native bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">COMPLETED</span>
                        )}
                        {isBaseLocked && (
                            <span className="label-native bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                                <Shield size={10} /> IDENTITY GUARD
                            </span>
                        )}
                        {task.requiresVerification && !isCompleted && !isBaseLocked && (
                            <Shield size={12} className="text-green-500 flex-shrink-0" />
                        )}
                        {isTierLocked && (
                            <span className="label-native bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                LVL {task.minTier}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 label-native">
                        <span className="text-yellow-500 flex items-center gap-1">
                            +{Number(task.baseReward)} XP
                        </span>
                        {!isCompleted && task.sponsorshipId == 0 && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Clock size={10} /> {Number(task.cooldown) / 3600}h
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Area */}
            <div className="flex items-center gap-3 pl-4">
                {isCompleted ? (
                    <CheckCircle className="text-green-500" size={20} />
                ) : isBaseLocked ? (
                   <div className="flex items-center gap-2 text-blue-400 label-native border border-blue-400/30 bg-blue-400/5 px-2 py-1 rounded-lg">
                      <Shield size={12} /> VERIFY REQ
                   </div>
                ) : task.requiresVerification ? (
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

export function TasksPage() {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { totalTasks: tasksCount } = useAllTasks();
    const totalTasks = tasksCount || 0;
    const { userPoints, userTier, rankName } = usePoints();
    const { refetch } = useUserV12Stats(address);
    const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'offers'

    // Fetch all task data in one batch
    const { data: allTasksRaw, isLoading: isTasksLoading } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'getTasksInRange',
        args: [BigInt(1), BigInt(totalTasks > 0 ? totalTasks : 0)], // Adjusted range to include totalTasks
        query: { enabled: totalTasks > 0 }
    });

    const taskGroups = useMemo(() => {
        if (!allTasksRaw) return { regulars: [], sponsored: {} };
        const regs = [];
        const spons = {};

        allTasksRaw.forEach((t, index) => {
            const taskId = index + 1;
            const taskObj = {
                id: taskId,
                baseReward: Number(t.baseReward),
                isActive: t.isActive,
                cooldown: Number(t.cooldown),
                minTier: Number(t.minTier),
                title: t.title,
                link: t.link,
                requiresVerification: t.requiresVerification,
                sponsorshipId: Number(t.sponsorshipId)
            };

            if (taskObj.sponsorshipId === 0) {
                regs.push(taskObj);
            } else {
                if (!spons[taskObj.sponsorshipId]) spons[taskObj.sponsorshipId] = [];
                spons[taskObj.sponsorshipId].push(taskObj);
            }
        });
        return { regulars: regs, sponsored: spons };
    }, [allTasksRaw]);

    return (
        <div className="w-full bg-[#050505] min-h-screen">
            <div className="max-w-screen-lg mx-auto pb-28 md:pb-8">
                {/* Header (Flat) */}
                <div className="px-4 py-8 border-b border-white/5">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-1 uppercase tracking-tighter italic">EARN REWARDS</h1>
                                <p className="label-native text-slate-500">COMPLETE MISSIONS AND LEVEL UP YOUR STATUS.</p>
                            </div>
                            <button 
                                onClick={() => navigate('/create-mission')}
                                className="px-5 py-2.5 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 rounded-xl text-indigo-400 hover:text-white label-native transition-all flex items-center justify-center w-fit"
                            >
                                Sponsor Mission
                            </button>
                        </div>

                        {/* Stats Row (Inline) */}
                        {isConnected && (
                            <div className="flex items-center gap-8 bg-white/5 border border-white/5 p-4 rounded-2xl">
                                <div>
                                    <p className="label-native text-slate-500 mb-0.5">YOUR XP</p>
                                    <p className="text-xl font-mono font-black text-white">{String(userPoints)}</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div>
                                    <p className="label-native text-slate-500 mb-0.5">CURRENT RANK</p>
                                    <div className="flex items-center gap-1.5">
                                        <Award className="w-4 h-4 text-indigo-400" />
                                        <p className="text-xl font-black text-indigo-400 uppercase tracking-tighter">{rankName || `LVL ${userTier}`}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-2 mt-8 p-1 bg-[#080808] border border-white/5 rounded-xl w-full max-w-sm mx-auto md:mx-0 shadow-lg">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`flex-1 py-3 rounded-xl label-native transition-all flex items-center justify-center ${activeTab === 'tasks' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                        >
                            Daily Tasks
                        </button>
                        <button
                            onClick={() => setActiveTab('offers')}
                            className={`flex-1 py-3 rounded-xl label-native transition-all flex items-center justify-center ${activeTab === 'offers' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                        >
                            Partner Offers
                        </button>
                    </div>
                </div>

                {/* Task Content */}
                {activeTab === 'tasks' ? (
                    <div className="px-4 mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
                        {/* Supabase Tasks Injection Point */}
                        <TaskList />

                        {/* Regular On-Chain Tasks */}
                        {taskGroups.regulars.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {taskGroups.regulars.map(task => (
                                    <TaskRow
                                        key={task.id}
                                        taskId={task.id}
                                        userStats={null}
                                        refetchStats={refetch}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Sponsored Cards */}
                        {Object.entries(taskGroups.sponsored).map(([sId, tasks]) => (
                            <SponsoredTaskCard
                                key={sId}
                                sponsorshipId={sId}
                                tasks={tasks}
                                refetchStats={refetch}
                            />
                        ))}

                        {isTasksLoading && (
                            <div className="py-24 text-center">
                                <Loader2 className="w-10 h-10 text-indigo-500 mx-auto animate-spin mb-4" />
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">CHECKING REWARDS...</p>
                            </div>
                        )}

                        {!isTasksLoading && taskGroups.regulars.length === 0 && Object.keys(taskGroups.sponsored).length === 0 && (
                            <div className="py-24 text-center glass-card border-dashed bg-indigo-500/5 transition-all animate-in fade-in zoom-in duration-500">
                                <CheckCircle2 className="w-12 h-12 text-green-500/30 mx-auto mb-4" />
                                <h3 className="text-white font-black text-[11px] uppercase tracking-widest">YOU ARE ALL CAUGHT UP!</h3>
                                <p className="text-slate-500 text-[10px] uppercase font-bold mt-2">Check back later for new sponsored missions</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Offers Content */
                    <div className="px-4 mt-6">
                        <OffersList />
                    </div>
                )}
            </div>
        </div>
    );
}

function SponsoredTaskCard({ sponsorshipId, tasks, refetchStats }) {
    const navigate = useNavigate();
    const { profileData } = useFarcaster();
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useWriteContract();
    const { verifyTask, registerTaskStart, isVerifying } = useVerification(refetchStats);
    const [verifyingStatus, setVerifyingStatus] = useState(null); // 'success', 'fail', null
    const [timer, setTimer] = useState(0);
    const [isClaiming, setIsClaiming] = useState(false);

    // Track on-chain rewards for this specific user
    const { data: rawClaimable, refetch: refetchRewards } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'claimableRewards',
        args: [address],
        query: { enabled: !!address }
    });

    const claimable = rawClaimable ? Number(rawClaimable) / 1e18 : 0;

    // Track completion for the whole card
    const { data: progress } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'userSponsorshipProgress',
        args: [address, BigInt(sponsorshipId)],
        query: { enabled: !!address }
    });

    const progressCount = Number(progress || 0);
    const isGlobalCompleted = progressCount >= tasks.length;
    
    // Identity Guard Hardening (v3.42.1)
    const hasGatedTask = tasks.some(t => t.isBaseSocialRequired);
    const isIdentityBlocked = hasGatedTask && !profileData?.is_base_social_verified;

    if (isGlobalCompleted) return null;



    const handleVerifyCard = async () => {
        setVerifyingStatus(null);
        let allSuccess = true;
        const tid = toast.loading("System verifying tasks...");

        try {
            for (const t of tasks) {
                const success = await verifyTask(t, address, t.id);
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
                        onAction={() => registerTaskStart(task.id)}
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

                {verifyingStatus === 'success' && timer === 0 && (
                    <button
                        onClick={async () => {
                            const tid = toast.loading("Claiming Mission Reward...");
                            setIsClaiming(true);
                            try {
                                 const hash = await writeContractAsync({
                                    address: CONTRACTS.DAILY_APP,
                                    abi: DAILY_APP_ABI,
                                    functionName: 'claimRewards',
                                });

                                // v3.40+: Fast Sync via TxHash (No second signature required)
                                toast.loading("Mining & Syncing XP...", { id: tid });
                                
                                fetch('/api/user-bundle', {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'xp',
                                        wallet_address: address,
                                        signature: null, 
                                        message: null,
                                        tx_hash: hash, 
                                    }),
                                })
                                .then(async (res) => {
                                    if (res.ok) {
                                        console.log('[TasksPage] XP synchronized via txHash');
                                        await Promise.all([
                                            refetchRewards(),
                                            refetchStats()
                                        ]);
                                    }
                                })
                                .catch((err) => console.error('[Sync Fetch Error]', err));

                                toast.success("Mission Reward Claimed! 🎉", { id: tid });
                                setVerifyingStatus(null);
                            } catch (err) {
                                toast.error(err.shortMessage || "Claim failed", { id: tid });
                            } finally {
                                setIsClaiming(false);
                            }
                        }}
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

function IndividualTaskRow({ task, address, onAction }) {
    const { data: isVerified } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'isTaskVerified',
        args: [address, BigInt(task.id)],
        query: { enabled: !!address }
    });

    const { data: isCompleted } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasCompletedTask',
        args: [address, BigInt(task.id)],
        query: { enabled: !!address }
    });

    if (isCompleted) return null;

    return (
        <div className="flex items-center justify-between px-4 py-4 hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isVerified ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-white/5 text-slate-500 border-white/5'}`}>
                    {isVerified ? <CheckCircle size={18} /> : <Zap size={18} />}
                </div>
                <div>
                    <h4 className={`value-native ${isVerified ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</h4>
                    <p className="label-native text-slate-500 font-mono opacity-60">Task ID #{task.id}</p>
                </div>
            </div>

            {!isVerified ? (
                <button
                    onClick={() => {
                        window.open(task.link, '_blank');
                        onAction();
                    }}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all active:scale-90"
                >
                    <ExternalLink size={16} />
                </button>
            ) : (
                <div className="w-10 h-10 flex items-center justify-center text-green-500">
                    <CheckCircle size={20} />
                </div>
            )}
        </div>
    );
}
