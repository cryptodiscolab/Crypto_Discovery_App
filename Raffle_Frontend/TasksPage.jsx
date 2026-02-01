import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Sparkles, CheckCircle, Clock, ExternalLink, Loader2, Award, Zap, Twitter, MessageSquare } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useUserV12Stats, useAllTasks, useTaskInfo, useDoTask } from './useContract';
import toast from 'react-hot-toast';

function TaskCard({ taskId, userStats, refetchStats }) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { doTask, isLoading: isDoing } = useDoTask();
    const { address } = useAccount();
    const [isVerifying, setIsVerifying] = useState(false);

    if (isLoading || !task || !task.isActive) return null;

    const handleAction = async () => {
        if (!address) {
            toast.error("Please connect your wallet");
            return;
        }

        // 1. Open link in new tab
        window.open(task.link, '_blank');

        // 2. Call doTask on-chain (registers intent/cooldown)
        try {
            toast.loading("Registering task action...", { id: `task-${taskId}` });
            await doTask(taskId);
            toast.success("Action registered! You can verify after completion.", { id: `task-${taskId}` });
        } catch (error) {
            toast.error("Action failed: " + (error.shortMessage || error.message), { id: `task-${taskId}` });
        }
    };

    const handleVerify = async () => {
        setIsVerifying(true);
        const tid = toast.loading("Verifying action...");

        try {
            // This would call the verification-server
            // Since we don't have the Vercel URL here yet, we simulate or use a placeholder
            // In production, use import.meta.env.VITE_VERIFY_SERVER_URL
            const SERVER_URL = import.meta.env.VITE_VERIFY_SERVER_URL || "http://localhost:3000";
            const API_SECRET = import.meta.env.VITE_VERIFY_API_SECRET;

            const response = await fetch(`${SERVER_URL}/api/verify/social`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-SECRET': API_SECRET
                },
                body: JSON.stringify({
                    platform: task.title.toLowerCase().includes('twitter') ? 'twitter' : 'farcaster',
                    action: 'follow', // simplified for demo
                    userAddress: address,
                    taskId: Number(taskId),
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success("Task Verified! Points awarded.", { id: tid });
                refetchStats();
            } else {
                toast.error(result.error || "Verification failed. Did you complete the action?", { id: tid });
            }
        } catch (error) {
            toast.error("Verification server unreachable", { id: tid });
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 border-white/5 hover:border-blue-500/30 transition-all group"
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${task.requiresVerification ? 'from-purple-500 to-indigo-600' : 'from-blue-500 to-indigo-600'} shadow-lg group-hover:scale-110 transition-transform`}>
                    {task.title.toLowerCase().includes('twitter') ? <Twitter className="w-6 h-6 text-white" /> : <Shield className="w-6 h-6 text-white" />}
                </div>
                <div className="text-right">
                    <span className="text-xs font-mono text-slate-500">ID: #{Number(taskId)}</span>
                    <div className="flex items-center text-yellow-500 mt-1">
                        <Zap className="w-3 h-3 mr-1 fill-current" />
                        <span className="text-sm font-bold">+{Number(task.baseReward)} Pts</span>
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{task.title}</h3>

            <div className="flex items-center space-x-4 mb-6 text-sm text-slate-400">
                <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{Number(task.cooldown) / 3600}h Cooldown</span>
                </div>
                <div className="flex items-center">
                    <Award className="w-4 h-4 mr-1 text-blue-400" />
                    <span>Tier {task.minTier}+</span>
                </div>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={handleAction}
                    disabled={isDoing}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 border border-white/10"
                >
                    {isDoing ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <ExternalLink className="w-4 h-4" />}
                    <span>Start Task</span>
                </button>

                {task.requiresVerification && (
                    <button
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2"
                    >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        <span>Verify</span>
                    </button>
                )}
            </div>
        </motion.div>
    );
}

export function TasksPage() {
    const { address, isConnected } = useAccount();
    const { totalTasks } = useAllTasks();
    const { stats, isLoading: statsLoading } = useUserV12Stats(address);
    const taskIds = Array.from({ length: totalTasks }, (_, i) => i);

    return (
        <div className="min-h-screen py-20 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2"></div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-6xl mx-auto">
                    {/* User Progress Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card mb-12 overflow-hidden"
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

                            {isConnected && stats && (
                                <div className="flex items-center space-x-8">
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Total Points</p>
                                        <p className="text-3xl font-black text-blue-400">{Number(stats.points)}</p>
                                    </div>
                                    <div className="h-12 w-px bg-white/10 hidden md:block"></div>
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Rank Tier</p>
                                        <p className="text-3xl font-black text-indigo-400">LVL {stats.currentTier}</p>
                                    </div>
                                    <div className="h-12 w-px bg-white/10 hidden md:block"></div>
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Tasks Done</p>
                                        <p className="text-3xl font-black text-green-400">{Number(stats.totalTasksCompleted)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Task Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {taskIds.length > 0 ? (
                            taskIds.map(id => (
                                <TaskCard
                                    key={id}
                                    taskId={id}
                                    userStats={stats}
                                    refetchStats={() => { }} // stats will auto-refetch via query
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
