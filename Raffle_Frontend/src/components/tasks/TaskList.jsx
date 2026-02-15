import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase } from '../../lib/supabaseClient';
import { Loader2, CheckCircle2, Zap, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePoints } from '../../shared/context/PointsContext';


export function TaskList() {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [tasks, setTasks] = useState([]);
    const [userScore, setUserScore] = useState(0);
    const [userClaims, setUserClaims] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [hasProfile, setHasProfile] = useState(false);
    const [claimingTask, setClaimingTask] = useState(null);
    const { refetch } = usePoints();


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

            // 2. Fetch User Claims & Score (if connected)
            let claimsSet = new Set();
            if (address) {
                const today = new Date().toISOString().split('T')[0];

                // Parallel Fetch for Performance
                const [claimsResult, profileResult] = await Promise.all([
                    supabase
                        .from('user_task_claims')
                        .select('task_id')
                        .eq('wallet_address', address.toLowerCase())
                        .gte('claimed_at', `${today}T00:00:00.000Z`)
                        .lte('claimed_at', `${today}T23:59:59.999Z`),

                    supabase
                        .from('user_profiles')
                        .select('neynar_score')
                        .eq('wallet_address', address.toLowerCase())
                        .single()
                ]);

                if (claimsResult.data) {
                    claimsResult.data.forEach(claim => claimsSet.add(claim.task_id));
                }

                if (profileResult.data) {
                    setUserScore(profileResult.data.neynar_score || 0);
                    setHasProfile(true);
                } else {
                    setHasProfile(false);
                }
            }

            setTasks(tasksData || []);
            setUserClaims(claimsSet);
        } catch (error) {
            console.group("TaskList Fetch Error");
            console.error('Error fetching tasks:', error.message);
            console.debug('Full error context:', error);
            console.groupEnd();
            toast.error(`Failed to load daily tasks: ${error.message || 'Network error'}`);
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

        if (task.min_neynar_score > 0 && userScore < task.min_neynar_score) {
            toast.error(`Low Reputation: Requires Neynar Score ${task.min_neynar_score}`);
            return;
        }

        setClaimingTask(task.id);
        const toastId = toast.loading("Requesting signature...");

        try {
            // 1. Prepare Message
            const timestamp = new Date().toISOString();
            const message = `Claim Task: ${task.description}\nID: ${task.id}\nWallet: ${address.toLowerCase()}\nTime: ${timestamp}`;

            // 2. Request Signature
            const signature = await signMessageAsync({ message });

            toast.loading("Verifying on server...", { id: toastId });

            // 3. Call Secure API
            const response = await fetch('/api/tasks/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    task_id: task.id,
                    xp_reward: task.xp_reward
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Claim failed");
            }

            toast.success(`Claimed +${task.xp_reward} XP!`, { id: toastId });
            setUserClaims(prev => new Set(prev).add(task.id));
            if (refetch) refetch();

        } catch (err) {
            console.error("Claim error:", err);
            const errMsg = err.message || "Unknown error";
            if (err.code === 4001 || errMsg.toLowerCase().includes("rejected")) {
                toast.error("Signature rejected", { id: toastId });
            } else {
                toast.error("Claim failed: " + errMsg, { id: toastId });
            }
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

                    // Anti-Sybil Check
                    const requiresScore = task.min_neynar_score && task.min_neynar_score > 0;
                    const isScoreLow = requiresScore && userScore < task.min_neynar_score;
                    const isDisabled = isClaimed || isClaiming || !isConnected || isScoreLow;

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
                                <div className="flex flex-col items-end gap-1">
                                    <div className={`px-2 py-1 rounded-md text-xs font-black font-mono flex items-center gap-1 ${isClaimed ? 'bg-slate-800 text-slate-500' : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        <span>+{task.xp_reward} XP</span>
                                    </div>
                                    {requiresScore && (
                                        <div className={`text-[10px] font-bold ${isScoreLow ? 'text-red-400' : 'text-slate-500'}`}>
                                            Min Score: {task.min_neynar_score}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h4 className={`text-sm font-bold mb-4 ${isClaimed ? 'text-slate-500 line-through' : 'text-white'}`}>
                                {task.description}
                            </h4>

                            <div className="relative group/btn">
                                <button
                                    onClick={() => !isDisabled && handleClaim(task)}
                                    disabled={isDisabled}
                                    className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isClaimed
                                        ? 'bg-transparent text-green-500 cursor-default'
                                        : isScoreLow
                                            ? 'bg-red-900/20 text-red-500 border border-red-500/30 cursor-not-allowed'
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
                                    ) : isScoreLow ? (
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            Low Reputation
                                        </div>
                                    ) : (
                                        "Claim Reward"
                                    )}
                                </button>

                                {isScoreLow && (
                                    <div className="absolute bottom-full left-0 w-full mb-2 p-2 bg-black/90 text-white text-[10px] rounded pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity z-10 text-center">
                                        Your Neynar Score ({userScore || 0}) is below {task.min_neynar_score}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
