import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { GridCard } from './GridCard';

export function TaskCard() {
    const tasks = [
        { icon: "🐦", title: "Follow on X", reward: "+100 PTS", active: true },
        { icon: "🦄", title: "Join Farcaster", reward: "+200 PTS", active: false },
    ];

    return (
        <GridCard delay={0.1} className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-blue-500/20 rounded-2xl">
                    <span className="text-2xl">⚡</span>
                </div>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/20">
                    DAILY RESET
                </span>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">Daily Power-Up</h3>
            <p className="text-slate-400 text-sm mb-6">Complete simple social tasks to earn raw points for raffle tickets.</p>

            <div className="space-y-3 mb-6 flex-grow">
                {tasks.map((task, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{task.icon}</span>
                            <span className={`text-sm font-medium ${task.active ? 'text-white' : 'text-slate-500'}`}>
                                {task.title}
                            </span>
                        </div>
                        <span className="text-xs font-bold text-blue-400">{task.reward}</span>
                    </div>
                ))}
            </div>

            <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 group">
                Go to Tasks
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
        </GridCard>
    );
}
