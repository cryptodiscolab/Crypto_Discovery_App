import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Shield, Sparkles, CheckCircle, Clock, ExternalLink, Loader2, Award, Zap, Twitter, MessageSquare, ArrowRight, Gift, Megaphone } from 'lucide-react';
import { useAccount, useSignMessage, useReadContract, useWriteContract } from 'wagmi';
import { useAllTasks, useTaskInfo, useDoTask, useUserV12Stats } from '../hooks/useContract';
import { useVerification } from '../hooks/useVerification';
import { usePoints } from '../shared/context/PointsContext';
import { useFarcaster } from '../hooks/useFarcaster';
import { ABIS, CONTRACTS, APP_CONFIG, DAILY_APP_ABI } from '../lib/contracts';
import toast from 'react-hot-toast';
import { TaskList } from '../components/tasks/TaskList';
import { OffersList } from '../components/tasks/OffersList';

function TaskRow({ taskId, userStats, refetchStats }) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { doTask, isLoading: isDoing } = useDoTask();
    const { address } = useAccount();
    const { userTier } = usePoints();
    const { profileData } = useFarcaster();
    const { verifyTask, isVerifying, registerTaskStart, lastActionTime } = useVerification(refetchStats);
    const [timeLeft, setTimeLeft] = useState(0);

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

    if (isLoading || !task || !task.isActive || isCompleted) return null;

    const isTierLocked = Number(userTier) < Number(task.minTier);
    const canDo = !isTierLocked && !isCompleted;

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
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">
                        This task requires a Farcaster account. Join now to start earning XP!
                    </p>
                    <a
                        href={APP_CONFIG.FARCASTER_REFERRAL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-indigo-600 rounded-lg text-white text-[9px] font-black uppercase tracking-[0.2em] text-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Sign Up for Farcaster
                    </a>
                </div>
            ), { duration: 8000, id: 'fc-referral-nudge' });
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
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">
                        Cannot verify Farcaster tasks without a connected account.
                    </p>
                    <a
                        href={APP_CONFIG.FARCASTER_REFERRAL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-indigo-600 rounded-lg text-white text-[9px] font-black uppercase tracking-[0.2em] text-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
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
            onClick={canDo ? handleAction : undefined}
            className={`flex items-center justify-between p-4 border-b-subtle active:bg-white/5 transition-colors cursor-pointer group ${!canDo ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Icon Box */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${!canDo ? 'bg-slate-800' : task.requiresVerification ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {isCompleted ? <CheckCircle size={18} className="text-green-500" /> : isTierLocked ? <Shield size={18} className="text-slate-500" /> : task.title.toLowerCase().includes('twitter') ? <Twitter size={18} /> : <Zap size={18} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[15px] font-bold text-white truncate">{task.title}</span>
                        {isCompleted && (
                            <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30 font-black uppercase tracking-tighter">Completed</span>
                        )}
                        {task.requiresVerification && !isCompleted && (
                            <Shield size={12} className="text-green-500 flex-shrink-0" />
                        )}
                        {isTierLocked && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                LVL {task.minTier}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-bold text-yellow-500 flex items-center gap-1">
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
                ) : task.requiresVerification ? (
                    <button
                        onClick={handleVerify}
                        disabled={isVerifying || isTierLocked || timeLeft > 0}
                        className={`px-4 py-1.5 rounded-full text-white text-xs font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 ${timeLeft > 0 ? 'bg-slate-700 shadow-none' : 'bg-blue-600 shadow-blue-900/20'}`}
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
        <div className="w-full bg-[#0B0E14] min-h-screen">
            <div className="max-w-screen-lg mx-auto pb-12">
                {/* Header (Flat) */}
                <div className="px-4 py-8 border-b-subtle">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-black text-white mb-1 uppercase tracking-tighter italic">Earn Rewards</h1>
                            <p className="text-slate-500 text-sm font-medium">Complete missions and level up your status.</p>
                        </div>

                        {/* Stats Row (Inline) */}
                        {isConnected && (
                            <div className="flex items-center gap-8 bg-white/5 border border-white/5 p-4 rounded-2xl">
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Your XP</p>
                                    <p className="text-xl font-mono font-black text-white">{String(userPoints)}</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Current Rank</p>
                                    <div className="flex items-center gap-1.5">
                                        <Award className="w-4 h-4 text-indigo-400" />
                                        <p className="text-xl font-black text-indigo-400 uppercase tracking-tighter">{rankName || `LVL ${userTier}`}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-2 mt-8 p-1.5 bg-zinc-900 border border-white/5 rounded-2xl w-full max-w-md mx-auto md:mx-0">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'tasks' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Zap className={activeTab === 'tasks' ? 'w-3 h-3 fill-white' : 'w-3 h-3'} />
                            Daily Tasks
                        </button>
                        <button
                            onClick={() => setActiveTab('offers')}
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'offers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Megaphone className={activeTab === 'offers' ? 'w-3 h-3 fill-white' : 'w-3 h-3'} />
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
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Checking Rewards...</p>
                            </div>
                        )}

                        {!isTasksLoading && taskGroups.regulars.length === 0 && Object.keys(taskGroups.sponsored).length === 0 && (
                            <div className="py-24 text-center glass-card border-dashed bg-indigo-500/5">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-50" />
                                <h3 className="text-white font-bold text-lg">All Tasks Completed!</h3>
                                <p className="text-slate-500 text-sm mt-1">You've finished all available daily missions. Check back tomorrow!</p>
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

    const isGlobalCompleted = Number(progress || 0) >= tasks.length;
    
    if (isGlobalCompleted) return null;

    // Safety: signWithTimeout helper
    const signWithTimeout = useCallback(async (params, timeoutMs = 10000) => {
        return Promise.race([
            signMessageAsync(params),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Wallet signature timeout – wallet extension conflict detected')), timeoutMs)
            ),
        ]);
    }, [signMessageAsync]);

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
            <div className="px-4 py-3 bg-zinc-800/60 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Award className="text-yellow-400" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white italic">Sponsored Mission</span>
                </div>
                {isGlobalCompleted && (
                    <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-md border border-green-500/30 font-black uppercase tracking-tighter">Mission Accomplished</span>
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
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">Status: Verified</p>
                        <p className="text-xs font-bold">Claim rewarding in {timer}s...</p>
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
                                toast.success("Mission Reward Claimed!", { id: tid });
                                // BUG-4 fix: sync XP on-chain ke DB (Secured)
                                 const timestamp = new Date().toISOString();
                                 const message = `Sync XP for ${address}\nTimestamp: ${timestamp}`;
                                 
                                 let signature = null;
                                 try {
                                     // 10s timeout: if wallet is locked (EIP-6963 conflict), we'll try to sync via txHash proof alone
                                     signature = await signWithTimeout({ message }, 10000);
                                 } catch (signErr) {
                                     console.warn('[TasksPage] Signature skipped/timed out, attempting sync via txHash only:', signErr.message);
                                 }

                                 fetch('/api/user-bundle', {
                                     method: 'POST',
                                     headers: { 'content-type': 'application/json' },
                                     body: JSON.stringify({
                                         action: 'xp',
                                         wallet_address: address,
                                         signature,
                                         message: signature ? message : null,
                                         tx_hash: hash, // Added for backend verification fallback
                                     }),
                                 })
                                     .then(async (res) => {
                                         if (!res.ok) {
                                             const errorData = await res.json();
                                             console.error('[Sync Error]', errorData.error || 'Unknown error');
                                         } else {
                                             console.log('[Sync Success] XP synchronized');
                                         }
                                     })
                                     .catch((err) => {
                                         console.error('[Sync Fetch Error]', err);
                                     });
                                setVerifyingStatus(null);
                                refetchRewards();
                                refetchStats();
                            } catch (err) {
                                toast.error(err.shortMessage || "Claim failed", { id: tid });
                            } finally {
                                setIsClaiming(false);
                            }
                        }}
                        disabled={isClaiming}
                        className="w-full bg-green-600 hover:bg-green-500 py-3.5 rounded-xl text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-900/20"
                    >
                        {isClaiming ? <Loader2 className="animate-spin" size={14} /> : <Gift size={14} />}
                        Claim Task Reward
                    </button>
                )}

                {verifyingStatus === 'fail' && (
                    <div className="bg-red-500/10 text-red-400 p-3 rounded-xl border border-red-500/20 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">Verification Failed</p>
                        <p className="text-xs font-bold">Please ensure all tasks are completed</p>
                    </div>
                )}

                {!isGlobalCompleted && verifyingStatus !== 'success' && (
                    <button
                        onClick={handleVerifyCard}
                        disabled={isVerifying}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-indigo-900/20"
                    >
                        {isVerifying ? "SYSTEM CHECKING..." : "VERIFY MISSION"}
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

    return (
        <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isVerified ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-white/5 text-slate-500 border-white/5'}`}>
                    {isVerified ? <CheckCircle size={18} /> : <Zap size={18} />}
                </div>
                <div>
                    <h4 className={`text-[14px] font-bold tracking-tight ${isVerified ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</h4>
                    <p className="text-[10px] text-slate-500 font-mono uppercase opacity-60">Task ID #{task.id}</p>
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
