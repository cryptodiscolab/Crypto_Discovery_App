import { Shield, Sparkles, CheckCircle, Clock, ExternalLink, Loader2, Award, Zap, Twitter, MessageSquare } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAllTasks, useTaskInfo, useDoTask } from '../hooks/useContract';
import { useVerification } from '../hooks/useVerification';
import { usePoints } from '../shared/context/PointsContext';
import toast from 'react-hot-toast';
import { TaskList } from '../components/tasks/TaskList';

function TaskCard({ taskId, userStats, refetchStats }) {
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

    const handleVerify = async () => {
        if (isTierLocked) return;
        await verifyTask(task, address, taskId);
    };

    return (
        <div
            className={`glass-card p-6 border-white/5 hover:border-blue-500/30 transition-all group animate-scale-in ${isTierLocked ? 'opacity-60 grayscale-[0.5]' : ''}`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${isTierLocked ? 'from-slate-700 to-slate-800' : task.requiresVerification ? 'from-purple-500 to-indigo-600' : 'from-blue-500 to-indigo-600'} shadow-lg group-hover:scale-110 transition-transform`}>
                    {isTierLocked ? <Shield className="w-6 h-6 text-slate-500" /> : task.title.toLowerCase().includes('twitter') ? <Twitter className="w-6 h-6 text-white" /> : <Shield className="w-6 h-6 text-white" />}
                </div>
                <div className="text-right">
                    <span className="text-xs font-mono text-slate-500">ID: #{Number(taskId)}</span>
                    <div className={`flex items-center ${isTierLocked ? 'text-slate-500' : 'text-yellow-500'} mt-1`}>
                        <Zap className="w-3 h-3 mr-1 fill-current" />
                        <span className="text-sm font-bold">+{Number(task.baseReward)} XP</span>
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{String(task.title || '')}</h3>

            <div className="flex flex-wrap gap-2 mb-6 text-[10px] font-black uppercase tracking-tighter">
                <div className="flex items-center bg-slate-800/50 px-2 py-1 rounded-md text-slate-400">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>{Number(task.cooldown) / 3600}h CD</span>
                </div>
                <div className={`flex items-center px-2 py-1 rounded-md ${isTierLocked ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    <Award className="w-3 h-3 mr-1" />
                    <span>Tier {Number(task.minTier)}+</span>
                </div>

                {/* Advanced Requirements */}
                {(Number(task.minNeynarScore || 0) > 0) && (
                    <div className="flex items-center bg-purple-500/20 text-purple-400 px-2 py-1 rounded-md">
                        <Sparkles className="w-3 h-3 mr-1" />
                        <span>Score {Number(task.minNeynarScore)}+</span>
                    </div>
                )}
                {task.powerBadgeRequired && (
                    <div className="flex items-center bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/30">
                        <Shield className="w-3 h-3 mr-1" />
                        <span>Power User</span>
                    </div>
                )}
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={handleAction}
                    disabled={isDoing || isTierLocked}
                    className={`flex-1 ${isTierLocked ? 'bg-slate-800 text-slate-500 border-white/5 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white border-white/10'} py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 border`}
                >
                    {isDoing ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : isTierLocked ? <Clock className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                    <span>{isTierLocked ? `LVL ${task.minTier} Required` : 'Start Task'}</span>
                </button>

                {task.requiresVerification && (
                    <button
                        onClick={handleVerify}
                        disabled={isVerifying || isTierLocked}
                        className={`flex-1 ${isTierLocked ? 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 shadow-lg'} text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2`}
                    >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        <span>Verify</span>
                    </button>
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
        <div className="min-h-screen pt-8 pb-20 md:py-20 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2"></div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-6xl mx-auto">
                    {/* User Progress Header */}
                    <div
                        className="glass-card mb-12 overflow-hidden animate-slide-up"
                    >
                        <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-8 flex flex-col md:flex-row items-center justify-between border-b border-white/5">
                            <div className="mb-6 md:mb-0">
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="bg-yellow-500 p-1.5 rounded-lg shadow-lg">
                                        <Award className="w-6 h-6 text-slate-900" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-white">Daily Tasks</h2>
                                </div>
                                <p className="text-slate-400">Complete tasks to earn points and upgrade your tier.</p>
                            </div>

                            {isConnected && (
                                <div className="flex items-center space-x-8">
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Total XP</p>
                                        <p className="text-3xl font-black text-blue-400">{String(userPoints)}</p>
                                    </div>
                                    <div className="h-12 w-px bg-white/10 hidden md:block"></div>
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Current Rank</p>
                                        <p className="text-3xl font-black text-indigo-400">{rankName || `LVL ${userTier}`}</p>
                                    </div>
                                    <div className="h-12 w-px bg-white/10 hidden md:block"></div>
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Tasks Done</p>
                                        <p className="text-3xl font-black text-green-400">{String(totalTasksCompleted)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Supabase Tasks (New Phase 5) */}
                    <TaskList />

                    {/* Task Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {taskIds.length > 0 ? (
                            taskIds.map(id => (
                                <TaskCard
                                    key={id}
                                    taskId={id}
                                    userStats={null} // Deprecated prop
                                    refetchStats={refetch}
                                />
                            ))
                        ) : (
                            <div className="col-span-full py-20 text-center">
                                <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Loader2 className="w-10 h-10 text-slate-700" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Syncing Tasks...</h3>
                                <p className="text-slate-400">Loading new opportunities from the blockchain</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
