import { useState, useEffect, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase } from '../../lib/supabaseClient';
import { Loader2, CheckCircle2, Zap, Clock, AlertCircle, Coins, ExternalLink, ArrowRight, Gift, Share2, Hash, ShieldCheck } from 'lucide-react';
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
    const [userSocials, setUserSocials] = useState(null);
    // Two-Step Task Flow: track which tasks have been started (link opened)
    const [startedTasks, setStartedTasks] = useState({}); // { task_id: timestamp }
    const [countdowns, setCountdowns] = useState({}); // { task_id: secondsLeft }
    const countdownRefs = useRef({});
    const { execute: executeClaim } = useVerifiedAction();
    const { refetch, gasTracker } = usePoints();
    const { isGasExpensive, isGasHigh } = gasTracker || {};

    // Countdown ticker for started tasks
    useEffect(() => {
        const ids = Object.keys(startedTasks);
        if (ids.length === 0) return;
        const interval = setInterval(() => {
            setCountdowns(prev => {
                const next = { ...prev };
                ids.forEach(id => {
                    const elapsed = Math.floor((Date.now() - startedTasks[id]) / 1000);
                    const remaining = Math.max(0, 15 - elapsed);
                    next[id] = remaining;
                });
                return next;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [startedTasks]);

    const handleGoToTask = (task) => {
        if (!isConnected || !address) {
            toast.error('Please connect wallet first');
            return;
        }
        // Open task link in new tab
        const link = task.task_link || task.action_url || task.link;
        if (link) {
            window.open(link, '_blank', 'noopener,noreferrer');
        } else {
            toast.error('Task link not available');
            return;
        }
        // Register start time for this task
        setStartedTasks(prev => ({ ...prev, [task.id]: Date.now() }));
        setCountdowns(prev => ({ ...prev, [task.id]: 15 }));
        toast.success('Task opened! Complete it, then come back to claim your XP.', { duration: 4000, icon: '🚀' });
    };

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
                        .select('neynar_score, is_base_social_verified, fid, twitter_id, twitter_username, tiktok_username, instagram_username')
                        .eq('wallet_address', address.toLowerCase())
                        .maybeSingle()
                ]);

                if (claimsResult.data) {
                    setUserClaims(prev => {
                        const dbClaimIds = new Set(claimsResult.data.map(c => String(c.task_id).toLowerCase()));
                        const recentOptimistic = prev.filter(c =>
                            !dbClaimIds.has(String(c.task_id).toLowerCase()) &&
                            (Date.now() - new Date(c.claimed_at).getTime() < 15000)
                        );
                        return [...claimsResult.data, ...recentOptimistic];
                    });
                } else {
                    setUserClaims(prev => prev.filter(c => (Date.now() - new Date(c.claimed_at).getTime() < 15000)));
                }

                if (profileResult.data) {
                    setUserScore(profileResult.data.neynar_score || 0);
                    setIsBaseVerified(!!profileResult.data.is_base_social_verified);
                    setHasProfile(true);
                    setUserSocials(profileResult.data);
                } else {
                    setUserScore(0);
                    setIsBaseVerified(false);
                    setHasProfile(false);
                    setUserSocials(null);
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
            const result = await executeClaim('claim_task', {
                task_id: task.id,
                xp_earned: task.xp_reward,
                platform: task.platform,
                action_type: task.action_type,
                target_id: task.target_id,
                // Social Identity for Robust Verification
                fid: userSocials?.fid,
                twitterId: userSocials?.twitter_id,
                tiktokHandle: userSocials?.tiktok_username,
                instagramHandle: userSocials?.instagram_username,
                // Action Params (if any)
                targetFid: task.target_fid || task.target_id,
                tweetId: task.tweet_id || task.target_id,
                targetUserId: task.target_twitter_id || task.target_id
            });

            // Handle already_claimed flag from backend (returns success:true but no new XP)
            if (result?.already_claimed) {
                toast.success("Mission already completed! Syncing...", { id: toastId });
            } else {
                toast.success(`Claimed +${task.xp_reward} XP!`, { id: toastId });
            }
            // Optimistic update: immediately hide task from UI (both paths)
            setUserClaims(prev => [...prev, { task_id: task.id, claimed_at: new Date().toISOString() }]);
            if (refetch) refetch();
            // Server-sync after a small delay to ensure DB is committed
            setTimeout(() => fetchData(), 1500);

        } catch (err) {
            console.error("Claim error:", err);
            const errMsg = err.message || "Unknown error";
            if (err.code === 4001 || errMsg.toLowerCase().includes("rejected")) {
                toast.error("Signature rejected", { id: toastId });
            } else if (errMsg.toLowerCase().includes("already completed") ||
                errMsg.toLowerCase().includes("already claimed") ||
                errMsg.toLowerCase().includes("task already completed")) {
                // Task was already claimed in DB but not reflected in UI — sync immediately
                toast.success("Mission already done! Syncing...", { id: toastId });
                // Force sync: add to local claims so task disappears instantly
                setUserClaims(prev => [...prev, { task_id: task.id, claimed_at: new Date().toISOString() }]);
                // Then do a full server sync after a short delay to ensure everything is consistent
                setTimeout(() => {
                    fetchData();
                    if (refetch) refetch();
                }, 1000);
            } else {
                toast.error("Claim failed: " + errMsg, { id: toastId });
            }
        } finally {
            setClaimingTask(null);
        }
    };

    // Filter Tasks (Zero-Assumption Mandate Applied)
    const activeTasks = tasks.filter(task => {
        const taskIdStr = String(task.id).toLowerCase();
        
        // 1. Hide if claimed (One-time logic per interval/task)
        const hasClaimed = userClaims.some(c => String(c.task_id).toLowerCase() === taskIdStr);
        if (hasClaimed) return false;

        // 2. Hide if expired (Autoritative field from DB)
        if (task.expires_at) {
            if (new Date(task.expires_at) < new Date()) return false;
        } else if (task.task_type === 'daily' && task.created_at) {
            // Fallback for legacy daily tasks
            const createdTime = new Date(task.created_at).getTime();
            if (Date.now() - createdTime > 24 * 60 * 60 * 1000) return false;
        }

        return true;
    });

    if (isLoading) {
        return (
            <div className="py-20 text-center">
                <Loader2 className="w-10 h-10 text-indigo-500 mx-auto animate-spin mb-4" />
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">LOADING MISSIONS...</p>
            </div>
        );
    }

    if (activeTasks.length === 0) {
        return (
            <div className="py-16 glass-card border-dashed flex flex-col items-center justify-center gap-4 bg-green-500/5 animate-fade-in">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-green-400">ALL MISSIONS COMPLETED</p>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">Check back later for new tasks</p>
            </div>
        );
    }

    return (
        <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2 mb-4 px-1">
                <Zap className="w-4 h-4 text-yellow-400" />
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">QUICK MISSIONS</h3>
            </div>

            {isGasHigh && !isGasExpensive && (
                <div className="flex items-center justify-center gap-2 mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest text-center shadow-inner">
                    ⚠️ Network is busy, claim fee might be high
                </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {activeTasks.map(task => {
                    const hasStarted = !!startedTasks[task.id];
                    const countdown = countdowns[task.id] ?? (hasStarted ? 0 : null);
                    const canClaim = hasStarted && countdown === 0;

                    // Anti-Sybil Check
                    const requiresScore = task.min_neynar_score && task.min_neynar_score > 0;
                    const isScoreLow = requiresScore && userScore < task.min_neynar_score;
                    const isBaseLocked = task.is_base_social_required && !isBaseVerified;

                    // Task link (support multiple field names from DB)
                    const taskLink = task.task_link || task.action_url || task.link;
                    
                    // Metadata helpers
                    const creator = task.task_type === 'daily' ? 'ADMIN' : (task.creator_address ? `${task.creator_address.slice(0, 6)}...${task.creator_address.slice(-4)}` : task.platform?.toUpperCase() || 'SYSTEM');
                    const createdAt = new Date(task.created_at);
                    const expiresAt = task.expires_at ? new Date(task.expires_at) : new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
                    
                    return (
                        <div
                            key={task.id}
                            className={`relative group p-4 rounded-xl border transition-all duration-300 ${
                                hasStarted && !canClaim
                                    ? 'glass-card border-amber-500/20 bg-amber-500/5'
                                    : canClaim
                                        ? 'glass-card border-green-500/20 bg-green-500/5'
                                        : 'glass-card border-white/10 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10'
                            }`}
                        >
                            {/* Card Header: Rewards & ID */}
                            <div className="flex justify-between items-start mb-3">
                                <div className={`p-2 rounded-lg ${
                                    isBaseLocked ? 'bg-blue-500/10' :
                                    canClaim ? 'bg-green-500/20' :
                                    hasStarted ? 'bg-amber-500/10' :
                                    'bg-indigo-500/20'
                                }`}>
                                    {isBaseLocked
                                        ? <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                        : canClaim
                                            ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                                            : hasStarted
                                                ? <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                                                : taskLink
                                                    ? <ExternalLink className="w-5 h-5 text-indigo-400" />
                                                    : <Zap className="w-5 h-5 text-indigo-400" />
                                    }
                                </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-yellow-500/5">
                                            <Coins size={10} />
                                            <span>+{task.xp_reward} XP</span>
                                        </div>
                                        {task.token_reward_amount > 0 && (
                                            <div className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-emerald-500/5">
                                                <Gift size={10} />
                                                <span>${task.token_reward_amount} {task.token_reward_symbol || 'USDC'}</span>
                                            </div>
                                        )}
                                    </div>
                            </div>

                            {/* Task Info */}
                            <h4 className="text-[11px] font-black uppercase tracking-widest leading-relaxed mb-1 text-white">
                                {task.description?.toUpperCase()}
                            </h4>
                            
                            {/* Task Metadata Stamps */}
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
                                <div className="flex items-center gap-1.5">
                                    <Hash className="w-3 h-3 text-indigo-400/50" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        ID: <span className="text-white">#{String(task.id).slice(0, 8)}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Share2 className="w-3 h-3 text-indigo-400/50" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        CREATOR: <span className="text-indigo-400">{creator}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-purple-400/50" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        CREATED: <span className="text-slate-400">{createdAt.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <ShieldCheck className="w-3 h-3 text-red-400/50" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        EXPIRES: <span className="text-red-400/70">{expiresAt.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-2">
                                {/* STEP 1: Go to task */}
                                {taskLink && (
                                    <button
                                        onClick={() => handleGoToTask(task)}
                                        disabled={claimingTask === task.id || isScoreLow || isBaseLocked}
                                        className={`w-full py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                            isScoreLow || isBaseLocked
                                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                                : hasStarted
                                                    ? 'bg-white/5 border border-white/10 text-slate-400'
                                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 active:scale-95'
                                        }`}
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        {hasStarted ? 'VISIT AGAIN' : 'GO TO TASK'}
                                    </button>
                                )}

                                {/* STEP 2: Claim reward */}
                                <div className="relative group/btn">
                                    <button
                                        onClick={() => canClaim && !isScoreLow && !isBaseLocked && claimingTask !== task.id && !isGasExpensive && handleClaim(task)}
                                        disabled={claimingTask === task.id || !isConnected || isScoreLow || isBaseLocked || isGasExpensive || (!canClaim && !!taskLink)}
                                        className={`w-full min-h-[44px] py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 ${
                                            isScoreLow
                                                ? 'bg-red-900/20 text-red-500 border border-red-500/30 cursor-not-allowed'
                                                : isBaseLocked
                                                    ? 'bg-blue-900/20 text-blue-400 border border-blue-500/30'
                                                    : isGasExpensive
                                                        ? 'bg-red-900/20 text-red-500 border border-red-500/30 cursor-not-allowed'
                                                        : !hasStarted && taskLink
                                                            ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                                                            : countdown > 0
                                                                ? 'bg-amber-900/20 text-amber-400 border border-amber-500/20'
                                                                : 'bg-green-600/20 hover:bg-green-600 border border-green-500/30 text-green-400 hover:text-white active:scale-95'
                                        }`}
                                    >
                                        {isGasExpensive ? (
                                            <>
                                                <div className="flex items-center gap-1.5"><AlertCircle size={14} /> ⛔ GAS TOO HIGH</div>
                                                <span className="text-[9px] opacity-70 normal-case font-medium tracking-normal leading-none">Wait for fees to drop</span>
                                            </>
                                        ) : claimingTask === task.id ? (
                                            <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /></div>
                                        ) : isScoreLow ? (
                                            <div className="flex items-center gap-2">
                                                <AlertCircle size={14} className="text-red-400" />
                                                <span className="text-red-400">LOW REPUTATION</span>
                                            </div>
                                        ) : isBaseLocked ? (
                                            <div className="flex items-center gap-2 text-blue-400">
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                                <span>IDENTITY REQUIRED</span>
                                            </div>
                                        ) : !hasStarted && taskLink ? (
                                            <div className="flex items-center gap-2"><span className="text-slate-600">COMPLETE TASK FIRST</span></div>
                                        ) : countdown > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <Clock size={12} className="animate-pulse" />
                                                WAIT {countdown}s THEN CLAIM
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Zap size={12} />
                                                CLAIM REWARD
                                            </div>
                                        )}
                                    </button>

                                    {isBaseLocked && (
                                        <div className="absolute bottom-full left-0 w-full mb-2 p-3 bg-blue-950 border border-blue-500/30 rounded-xl text-blue-200 text-[10px] font-black uppercase tracking-widest pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity z-10 text-center shadow-2xl">
                                            BASE APP SOCIAL (BASENAMES) REQUIRED. LINK YOUR PROFILE TO UNLOCK.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
