import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase } from '../../lib/supabaseClient';
import { Loader2, CheckCircle2, Zap, Clock, AlertCircle, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePoints } from '../../shared/context/PointsContext';
import { useVerifiedAction } from '../../hooks/useVerifiedAction';


export function TaskList() {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [tasks, setTasks] = useState([]);
    const [userScore, setUserScore] = useState(0);
    const [userClaims, setUserClaims] = useState([]); // Array of {task_id, claimed_at}
    const [isLoading, setIsLoading] = useState(false);
    const [hasProfile, setHasProfile] = useState(false);
    const [isBaseVerified, setIsBaseVerified] = useState(false); // v3.42.0
    const [claimingTask, setClaimingTask] = useState(null); 
    const { execute: executeClaim } = useVerifiedAction();
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
                .neq('task_type', 'system')
                .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
                .order('created_at', { ascending: false });

            if (tasksError) throw tasksError;

            setTasks(tasksData || []); // Set tasks immediately after fetching

            // 2. Fetch User Claims & Score (if connected)
            if (address) {
                const [claimsResult, profileResult] = await Promise.all([
                    supabase
                        .from('user_task_claims')
                        .select('task_id, claimed_at')
                        .eq('wallet_address', address.toLowerCase()),

                    supabase
                        .from('user_profiles')
                        .select('neynar_score, is_base_social_verified')
                        .eq('wallet_address', address.toLowerCase())
                        .maybeSingle()
                ]);

                if (claimsResult.data) {
                    setUserClaims(claimsResult.data); // Store full objects with claimed_at
                } else {
                    setUserClaims([]); // Clear claims if no data
                }

                if (profileResult.data) {
                    setUserScore(profileResult.data.neynar_score || 0);
                    setIsBaseVerified(!!profileResult.data.is_base_social_verified);
                    setHasProfile(true);
                } else {
                    setUserScore(0);
                    setIsBaseVerified(false);
                    setHasProfile(false);
                }
            } else {
                // If not connected, clear user-specific states
                setUserClaims([]);
                setUserScore(0);
                setHasProfile(false);
            }

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

        if (task.is_base_social_required && !isBaseVerified) {
            toast.error("Identity Guard: Base Social (Basenames) required!");
            return;
        }

        setClaimingTask(task.id);
        const toastId = toast.loading("PROCESSING CLAIM...");

        try {
            // ── SECURE CLAIM FLOW ──
            // Using unified secure API route via custom hook
            await executeClaim('claim_task', {
                task_id: task.id,
                xp_earned: task.xp_reward
            });

            toast.success(`Claimed +${task.xp_reward} XP!`, { id: toastId });
            // Optimistic update: immediately hide task from UI
            setUserClaims(prev => [...prev, { task_id: task.id, claimed_at: new Date().toISOString() }]);
            if (refetch) refetch();
            // Server-sync after a small delay to ensure DB is committed
            setTimeout(() => fetchData(), 1500);

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


    const activeTasks = tasks.filter(task => {
        const history = userClaims.filter(c => c.task_id === task.id);
        const hasAnyClaim = history.length > 0;

        // All tasks are treated as one-time per unique task ID now to match backend rules
        if (hasAnyClaim) return false;

        // System tasks are handled separately, but we exclude them here too
        if (task.task_type === 'system') return false;

        return true;
    });

    const isTaskCompletedForInterval = (task) => {
        return userClaims.some(c => c.task_id === task.id);
    };

    if (isLoading && tasks.length === 0) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (activeTasks.length === 0 && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-green-400">ALL MISSIONS COMPLETED</p>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">Check back tomorrow for new tasks</p>
            </div>
        );
    }

    return (
        <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2 mb-4 px-1">
                <Zap className="w-4 h-4 text-yellow-400" />
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">QUICK MISSIONS</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {activeTasks.map(task => {
                    const isClaimed = isTaskCompletedForInterval(task);

                    const isClaiming = claimingTask === task.id;

                    // Anti-Sybil Check
                    const requiresScore = task.min_neynar_score && task.min_neynar_score > 0;
                    const isScoreLow = requiresScore && userScore < task.min_neynar_score;
                    const isBaseLocked = task.is_base_social_required && !isBaseVerified; // v3.42.0
                    const isDisabled = isClaimed || isClaiming || !isConnected || isScoreLow || isBaseLocked;

                    return (
                        <div
                            key={task.id}
                            className={`relative group p-4 rounded-xl border transition-all duration-300 ${isClaimed
                                ? 'bg-slate-900/40 border-slate-800' // Claimed Style
                                : 'glass-card border-white/10 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10' // Active Style
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className={`p-2 rounded-lg ${isClaimed ? 'bg-slate-800' : isBaseLocked ? 'bg-blue-500/10' : 'bg-indigo-500/20'}`}>
                                    {isClaimed
                                        ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        : isBaseLocked
                                            ? <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                            : <Clock className="w-5 h-5 text-indigo-400" />
                                    }
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className={`px-2 py-1 rounded-md text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isClaimed ? 'bg-slate-800 text-slate-500' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        <Coins size={12} />
                                        <span>+{task.xp_reward} XP</span>
                                    </div>
                                    {requiresScore && (
                                        <div className={`text-[11px] font-black uppercase tracking-widest ${isScoreLow ? 'text-red-400' : 'text-slate-500'}`}>
                                            MIN SCORE: {task.min_neynar_score}
                                        </div>
                                    )}
                                    {isClaimed && (
                                        <div className="text-[11px] font-black text-green-400 uppercase tracking-widest flex items-center gap-1 bg-green-400/10 px-2 py-1 rounded-lg border border-green-400/20 mt-1">
                                            <CheckCircle2 size={12} />
                                            DONE
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h4 className={`text-[11px] font-black uppercase tracking-widest leading-relaxed mb-4 ${isClaimed ? 'text-slate-500 line-through' : 'text-white'}`}>
                                {task.description.toUpperCase()}
                            </h4>

                            <div className="relative group/btn">
                                <button
                                    onClick={() => !isDisabled && handleClaim(task)}
                                    disabled={isDisabled}
                                    className={`w-full py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isClaimed
                                        ? 'bg-transparent text-green-500 cursor-default'
                                        : isScoreLow
                                            ? 'bg-red-900/20 text-red-500 border border-red-500/30 cursor-not-allowed'
                                            : isBaseLocked
                                                ? 'bg-blue-900/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                        }`}
                                >
                                    {isClaiming ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : isClaimed ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            CLAIMED
                                        </>
                                    ) : isScoreLow ? (
                                        <div className="flex items-center gap-2">
                                            <AlertCircle size={14} className="text-red-400" />
                                            <span className="text-red-400">LOW REPUTATION</span>
                                        </div>
                                    ) : isBaseLocked ? (
                                        <div className="flex items-center gap-2 text-blue-400">
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                            <span>IDENTITY REQUIRED</span>
                                        </div>
                                    ) : (
                                        "CLAIM REWARD"
                                    )}
                                </button>

                                {isBaseLocked && (
                                    <div className="absolute bottom-full left-0 w-full mb-2 p-3 bg-blue-950 border border-blue-500/30 rounded-xl text-blue-200 text-[10px] font-black uppercase tracking-widest pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity z-10 text-center shadow-2xl">
                                        BASE APP SOCIAL (BASENAMES) REQUIRED. LINK YOUR PROFILE TO UNLOCK.
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
