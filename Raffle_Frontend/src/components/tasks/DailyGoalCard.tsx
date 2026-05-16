import { useState, useEffect } from 'react';
import { Target, Trophy, CheckCircle2, Lock, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useAccount } from 'wagmi';
import { useFarcaster } from '../../hooks/useFarcaster';

export function DailyGoalCard() {
    const { address, isConnected } = useAccount();
    const { profileData, isLoading: _isIdentityLoading } = useFarcaster();
    const [progress, setProgress] = useState<{ completed_count: number; bonus_claimed: boolean }>({ completed_count: 0, bonus_claimed: false });
    const [bonusAmount, setBonusAmount] = useState<number>(50);
    const [_loading, setLoading] = useState(true);

    const isVerified = profileData?.is_base_social_verified === true;

    const fetchProgress = async () => {
        if (!address) return;
        try {
            const res = await axios.get(`/api/user-bundle?action=get-daily-progress&wallet=${address.toLowerCase()}`);
            if (res.data.success) {
                setProgress(res.data.progress);
                setBonusAmount(res.data.bonus_amount);
            }
        } catch (err) {
            console.error('[DailyGoal] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected && address) {
            fetchProgress();
            const interval = setInterval(fetchProgress, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [address, isConnected]);

    if (!isConnected || !address) return null;

    const goal = 3;
    const current = Math.min(progress.completed_count, goal);
    const isCompleted = progress.completed_count >= goal;
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (current / goal) * circumference;

    return (
        <div className="relative overflow-hidden glass-card p-6 border-white/5 group transition-all duration-500 hover:shadow-[0_0_40px_rgba(99,102,241,0.1)]">
            {/* Background Aesthetic */}
            <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[120px] transition-all duration-1000 opacity-20 ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`} />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Nexus Daily Goal</h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {isCompleted ? "Goal Reached! +50 XP Active 🚀" : `Complete 3 Tasks for +${bonusAmount} XP Bonus`}
                        </p>
                    </div>

                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                        isVerified
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                    }`}>
                        {isVerified ? (
                            <><ShieldCheck className="w-3 h-3" /> VERIFIED</>
                        ) : (
                            <><Lock className="w-3 h-3" /> IDENTITY REQ</>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-8">
                    {/* Circular Progress Section */}
                    <div className="relative flex-shrink-0">
                        <svg className="w-32 h-32 transform -rotate-90">
                            {/* Track */}
                            <circle
                                cx="64"
                                cy="64"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-white/5"
                            />
                            {/* Progress */}
                            <circle
                                cx="64"
                                cy="64"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="8"
                                strokeDasharray={circumference}
                                style={{ strokeDashoffset: offset }}
                                strokeLinecap="round"
                                fill="transparent"
                                className={`transition-all duration-1000 ease-out ${
                                    isCompleted ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                                }`}
                            />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-white tabular-nums tracking-tighter italic">
                                {current}
                            </span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                OF {goal}
                            </span>
                        </div>
                    </div>

                    {/* Stats & Info Section */}
                    <div className="flex-1 space-y-5 w-full">
                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map((step) => {
                                const isDone = progress.completed_count >= step;
                                return (
                                    <div
                                        key={step}
                                        className={`p-3 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                                            isDone
                                                ? 'bg-emerald-500/10 border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                                                : 'bg-white/5 border-white/5 opacity-50'
                                        }`}
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                                            {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Zap className="w-3 h-3" />}
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDone ? 'text-emerald-400' : 'text-slate-600'}`}>STEP {step}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Reward Banner */}
                        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-500 ${
                            !isVerified
                                ? 'bg-amber-500/5 border-amber-500/10 grayscale opacity-70'
                                : progress.bonus_claimed
                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                    : isCompleted
                                        ? 'bg-indigo-500/20 border-indigo-500/30 animate-pulse'
                                        : 'bg-white/5 border-white/5'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${progress.bonus_claimed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-slate-400'}`}>
                                    <Trophy className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">
                                        {progress.bonus_claimed ? 'BONUS SECURED' : 'DAILY REWARD'}
                                    </p>
                                    <p className={`text-[11px] font-bold uppercase tracking-tight ${progress.bonus_claimed ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {progress.bonus_claimed ? `+${bonusAmount} XP COLLECTED` : `+${bonusAmount} XP PENDING`}
                                    </p>
                                </div>
                            </div>

                            {!isVerified ? (
                                <div className="flex items-center gap-2 text-amber-400">
                                    <Lock size={12} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">LOCKED</span>
                                </div>
                            ) : isCompleted && !progress.bonus_claimed ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    SYNCING
                                </div>
                            ) : progress.bonus_claimed ? (
                                <CheckCircle2 className="text-emerald-400 w-5 h-5" />
                            ) : (
                                <div className="text-slate-700">
                                    <ArrowRight size={14} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Identity Required Overlay (v3.60.4) */}
                {!isVerified && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center gap-3">
                        <Lock size={14} className="text-amber-400 shrink-0" />
                        <p className="text-[10px] font-bold text-amber-200 uppercase tracking-tight leading-tight">
                            Identity verification required to unlock daily XP bonuses.
                        </p>
                        <button
                            onClick={() => window.open('https://warpcast.com', '_blank')}
                            className="bg-amber-500 text-amber-950 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap active:scale-95 transition-all"
                        >
                            VERIFY NOW
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

