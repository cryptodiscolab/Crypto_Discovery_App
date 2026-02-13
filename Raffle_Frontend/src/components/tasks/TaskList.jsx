import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '../../lib/supabaseClient';
import { createAuthenticatedClient } from '../../lib/supabaseClient_enhanced';
import { Loader2, CheckCircle2, Zap, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function TaskList() {
    const { address, isConnected } = useAccount();
    const [tasks, setTasks] = useState([]);
    const [userClaims, setUserClaims] = useState(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [claimingTask, setClaimingTask] = useState(null);

    // Fetch Tasks & User Claims
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Active Tasks
            const { data: tasksData, error: tasksError } = await supabase
                .from('daily_tasks')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (tasksError) throw tasksError;

            // 2. Fetch User Claims (if connected)
            let claimsSet = new Set();
            if (address) {
                const today = new Date().toISOString().split('T')[0];
                const { data: claimsData, error: claimsError } = await supabase
                    .from('user_task_claims')
                    .select('task_id')
                    .eq('wallet_address', address.toLowerCase())
                    .gte('claimed_at', `${today}T00:00:00.000Z`)
                    .lte('claimed_at', `${today}T23:59:59.999Z`);

                if (claimsError) console.error("Error fetching claims:", claimsError);

                if (claimsData) {
                    claimsData.forEach(claim => claimsSet.add(claim.task_id));
                }
            }

            setTasks(tasksData || []);
            setUserClaims(claimsSet);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            toast.error('Failed to load daily tasks');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [address]);

    const handleClaim = async (task) => {
        if (!isConnected || !address) {
            toast.error("Please connect wallet first");
            return;
        }

        setClaimingTask(task.id);
        const toastId = toast.loading("Claiming reward...");

        try {
            const authClient = createAuthenticatedClient(address);

            // Insert claim
            const { error } = await authClient
                .from('user_task_claims')
                .insert({
                    wallet_address: address.toLowerCase(),
                    task_id: task.id,
                    xp_earned: task.xp_reward
                });

            if (error) {
                if (error.code === '23505') { // Unique violation
                    toast.error("You already claimed this task today", { id: toastId });
                    setUserClaims(prev => new Set(prev).add(task.id)); // Optimistic update fix
                } else {
                    throw error;
                }
            } else {
                toast.success(`Claimed +${task.xp_reward} XP!`, { id: toastId });
                setUserClaims(prev => new Set(prev).add(task.id));
                // Optional: trigger a global points refresh if available via context
            }
        } catch (err) {
            console.error("Claim error:", err);
            toast.error("Claim failed: " + err.message, { id: toastId });
        } finally {
            setClaimingTask(null);
        }
    };

    if (isLoading && tasks.length === 0) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (tasks.length === 0) {
        return null; // Don't show anything if no DB tasks active
    }

    return (
        <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2 mb-4 px-1">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="text-xl font-bold text-white">Quick Tasks</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {tasks.map(task => {
                    const isClaimed = userClaims.has(task.id);
                    const isClaiming = claimingTask === task.id;

                    return (
                        <div
                            key={task.id}
                            className={`relative group p-4 rounded-xl border transition-all duration-300 ${isClaimed
                                    ? 'bg-slate-900/40 border-slate-800' // Claimed Style
                                    : 'glass-card border-white/10 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10' // Active Style
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className={`p-2 rounded-lg ${isClaimed ? 'bg-slate-800' : 'bg-indigo-500/20'}`}>
                                    {isClaimed
                                        ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        : <Clock className="w-5 h-5 text-indigo-400" />
                                    }
                                </div>
                                <div className={`px-2 py-1 rounded-md text-xs font-black font-mono flex items-center gap-1 ${isClaimed ? 'bg-slate-800 text-slate-500' : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    <span>+{task.xp_reward} XP</span>
                                </div>
                            </div>

                            <h4 className={`text-sm font-bold mb-4 ${isClaimed ? 'text-slate-500 line-through' : 'text-white'}`}>
                                {task.description}
                            </h4>

                            <button
                                onClick={() => !isClaimed && handleClaim(task)}
                                disabled={isClaimed || isClaiming || !isConnected}
                                className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isClaimed
                                        ? 'bg-transparent text-green-500 cursor-default'
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                    }`}
                            >
                                {isClaiming ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isClaimed ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Completed
                                    </>
                                ) : (
                                    "Claim Reward"
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
