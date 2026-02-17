import { Shield, Sparkles, CheckCircle, Clock, ExternalLink, Loader2, Award, Zap, Twitter, MessageSquare, ArrowRight } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAllTasks, useTaskInfo, useDoTask } from '../hooks/useContract';
import { useVerification } from '../hooks/useVerification';
import { usePoints } from '../shared/context/PointsContext';
import toast from 'react-hot-toast';
import { TaskList } from '../components/tasks/TaskList';

function TaskRow({ taskId, userStats, refetchStats }) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { doTask, isLoading: isDoing } = useDoTask();
    const { address } = useAccount();
    const { userTier } = usePoints();
    const { verifyTask, isVerifying, registerTaskStart, lastActionTime } = useVerification(refetchStats);

    if (isLoading || !task || !task.isActive) return null;

    const isTierLocked = Number(userTier) < Number(task.minTier);

    const handleAction = async () => {
        if (!address) {
            toast.error("Please connect your wallet");
            return;
        }

        if (isTierLocked) {
            toast.error(`Tier ${task.minTier} required for this task!`);
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
            toast.success("Action registered! Tunggu 30 detik untuk sinkronisasi sosial sebelum Verifikasi.", { id: `task-${taskId}` });
        } catch (error) {
            toast.error("Action failed: " + (error.shortMessage || error.message), { id: `task-${taskId}` });
        }
    };

    const handleVerify = async (e) => {
        e.stopPropagation();
        if (isTierLocked) return;
        await verifyTask(task, address, taskId);
    };

    return (
        <div
            onClick={!isTierLocked ? handleAction : undefined}
            className={`flex items-center justify-between p-4 border-b-subtle active:bg-white/5 transition-colors cursor-pointer group ${isTierLocked ? 'opacity-50' : ''}`}
        >
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Icon Box */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isTierLocked ? 'bg-slate-800' : task.requiresVerification ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {isTierLocked ? <Shield size={18} className="text-slate-500" /> : task.title.toLowerCase().includes('twitter') ? <Twitter size={18} /> : <Zap size={18} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[15px] font-bold text-white truncate">{task.title}</span>
                        {task.requiresVerification && (
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
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <Clock size={10} /> {Number(task.cooldown) / 3600}h
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Area */}
            <div className="flex items-center gap-3 pl-4">
                {task.requiresVerification ? (
                    <button
                        onClick={handleVerify}
                        disabled={isVerifying || isTierLocked}
                        className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
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
    const { totalTasks } = useAllTasks();
    const { userPoints, userTier, rankName, totalTasksCompleted, refetch } = usePoints();
    const taskIds = Array.from({ length: totalTasks }, (_, i) => i);

    return (
        <div className="min-h-screen bg-[#0B0E14] pb-24 pt-safe">
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
            <div className="divide-y divide-white/5">
                {/* Supabase Tasks Injection Point (If any) */}
                <TaskList />

                {/* On-Chain Tasks */}
                {taskIds.length > 0 ? (
                    taskIds.map(id => (
                        <TaskRow
                            key={id}
                            taskId={id}
                            userStats={null}
                            refetchStats={refetch}
                        />
                    ))
                ) : (
                    <div className="py-12 text-center">
                        <Loader2 className="w-8 h-8 text-slate-700 mx-auto animate-spin mb-2" />
                        <p className="text-sm text-slate-500">Loading Tasks...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
