import { Shield, Sparkles, CheckCircle, Clock, ExternalLink, Loader2, Award, Zap, Twitter, MessageSquare, ArrowRight, Gift } from 'lucide-react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { useAllTasks, useTaskInfo, useDoTask } from '../hooks/useContract';
import { useVerification } from '../hooks/useVerification';
import { usePoints } from '../shared/context/PointsContext';
import { DAILY_APP_ABI, CONTRACTS } from '../lib/contracts';
import toast from 'react-hot-toast';
import { TaskList } from '../components/tasks/TaskList';

function TaskRow({ taskId, userStats, refetchStats }) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { doTask, isLoading: isDoing } = useDoTask();
    const { address } = useAccount();
    const { userTier } = usePoints();
    const { verifyTask, isVerifying, registerTaskStart, lastActionTime } = useVerification(refetchStats);

    // NEW: Check if task is already completed (One-time logic)
    const { data: isCompleted, refetch: refetchCompletion } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasCompletedTask',
        args: [address, taskId],
        query: { enabled: !!address && !!task && task.sponsorshipId > 0 }
    });

    if (isLoading || !task || !task.isActive) return null;

    const isTierLocked = Number(userTier) < Number(task.minTier);
    const canDo = !isTierLocked && !isCompleted;

    const handleAction = async () => {
        if (!address) {
            toast.error("Please connect your wallet");
            return;
        }

        if (isTierLocked) {
            toast.error(`Tier ${task.minTier} required for this task!`);
            return;
        }

        if (isCompleted) {
            toast.error("You have already completed this sponsored task!");
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
        if (!canDo) return;
        const success = await verifyTask(task, address, taskId);
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
                        disabled={isVerifying || isTierLocked}
                        className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-transform disabled:opacity-50"
                    >
                        {isVerifying ? <Loader2 size={14} className="animate-spin" /> : "Verify"}
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
    const { totalTasks: tasksCount } = useAllTasks();
    const totalTasks = tasksCount || 0;
    const { userPoints, userTier, rankName } = usePoints();
    const { refetch } = useUserV12Stats(address);

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
        <div className="min-h-screen bg-[#0B0E14] pb-24 pt-safe">
            <div className="max-w-screen-lg mx-auto">
                {/* Header (Flat) */}
                <div className="px-4 py-6 border-b-subtle">
                    <h1 className="text-2xl font-black text-white mb-1">Daily Tasks</h1>
                    <p className="text-slate-500 text-sm">Earn XP and level up your tier.</p>

                    {/* Stats Row (Inline) */}
                    {isConnected && (
                        <div className="flex items-center gap-6 mt-4">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Your XP</p>
                                <p className="text-xl font-mono font-bold text-white">{String(userPoints)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Rank</p>
                                <p className="text-xl font-bold text-indigo-400">{rankName || `LVL ${userTier}`}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Task List Container */}
                <div className="md:px-4 space-y-4">
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
                        <div className="py-12 text-center col-span-full">
                            <Loader2 className="w-8 h-8 text-slate-700 mx-auto animate-spin mb-2" />
                            <p className="text-sm text-slate-500">Loading Rewards...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SponsoredTaskCard({ sponsorshipId, tasks, refetchStats }) {
    const { address } = useAccount();
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
        <div className={`glass-card overflow-hidden border transition-all duration-500 ${verifyingStatus === 'success' ? 'border-green-500/50 shadow-lg shadow-green-500/10' : 'border-white/10'}`}>
            <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-transparent border-b border-white/5 flex justify-between items-center">
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
                                await writeContractAsync({
                                    address: CONTRACTS.DAILY_APP,
                                    abi: DAILY_APP_ABI,
                                    functionName: 'claimRewards',
                                });
                                toast.success("Mission Reward Claimed!", { id: tid });
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
