import { useState, useEffect } from 'react';
import { Target, Trophy, CheckCircle2, Circle } from 'lucide-react';
import axios from 'axios';
import { useAccount } from 'wagmi';

export function DailyGoalCard() {
    const { address } = useAccount();
    const [progress, setProgress] = useState<{ completed_count: number; bonus_claimed: boolean }>({ completed_count: 0, bonus_claimed: false });
    const [bonusAmount, setBonusAmount] = useState<number>(50);
    const [loading, setLoading] = useState(true);

    const fetchProgress = async () => {
        if (!address) return;
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/get-daily-progress?wallet=${address.toLowerCase()}`);
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
        fetchProgress();
        // Refresh every 5 minutes to stay updated
        const interval = setInterval(fetchProgress, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [address]);

    if (!address) return null;

    const goal = 3;
    const current = Math.min(progress.completed_count, goal);
    const percent = (current / goal) * 100;
    const isCompleted = progress.completed_count >= goal;

    return (
        <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-3xl p-6 transition-all hover:bg-white/10 group">
            {/* Background Glow */}
            <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[100px] transition-all duration-1000 ${isCompleted ? 'bg-green-500/20' : 'bg-blue-500/10'}`} />

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        <Target className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold tracking-tight">Daily Goal</h3>
                        <p className="text-xs text-white/50">Complete 3 tasks to earn bonus</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                        {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-3">
                <div className="flex justify-between items-end">
                    <span className="text-2xl font-black text-white italic">
                        {current}<span className="text-sm text-white/30 not-italic ml-1">/ {goal} Tasks</span>
                    </span>
                    <span className="text-sm font-bold text-white/60">
                        {Math.round(percent)}%
                    </span>
                </div>
                
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div 
                        className={`h-full transition-all duration-1000 ease-out rounded-full ${isCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-600 to-indigo-500'}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            {/* Milestones */}
            <div className="grid grid-cols-3 gap-2 mt-6">
                {[1, 2, 3].map((step) => (
                    <div key={step} className="flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${progress.completed_count >= step ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-white/5 border-white/10 text-white/20'}`}>
                            {progress.completed_count >= step ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                        </div>
                        <span className="text-[10px] font-bold text-white/30">TASK {step}</span>
                    </div>
                ))}
            </div>

            {/* Bonus Status */}
            <div className={`mt-6 p-3 rounded-2xl flex items-center justify-between border transition-all ${progress.bonus_claimed ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/5'}`}>
                <div className="flex items-center gap-2">
                    <Trophy className={`w-4 h-4 ${progress.bonus_claimed ? 'text-yellow-400' : 'text-white/20'}`} />
                    <span className={`text-xs font-bold ${progress.bonus_claimed ? 'text-white' : 'text-white/30'}`}>
                        {progress.bonus_claimed ? 'Bonus Claimed!' : `Bonus Reward: ${bonusAmount} XP`}
                    </span>
                </div>
                {isCompleted && !progress.bonus_claimed && (
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-blue-400">SYNCING...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
