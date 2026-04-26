import { ArrowRight, CheckCircle2, Zap, Coins, Gift } from 'lucide-react';
import { GridCard } from './GridCard';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export function TaskCard() {
    const [tasks, setTasks] = useState([]);
    const [totalActive, setTotalActive] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const now = new Date().toISOString();
                const { data, error } = await supabase
                    .from('daily_tasks')
                    .select('*')
                    .eq('is_active', true)
                    .gt('expires_at', now)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setTasks(data.slice(0, 2));
                setTotalActive(data.length);
            } catch (err) {
                console.error('[TaskCard] Error fetching tasks:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTasks();
    }, []);

    return (
        <GridCard delay={0.1} className="h-full flex flex-col relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[100px] pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-700" />
            
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
                    <Zap size={20} className="text-blue-400 animate-pulse" />
                </div>
                <div className="flex flex-col items-end">
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-green-500/20 mb-1">
                        SYSTEM ACTIVE
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 tracking-tighter italic">
                        {totalActive} MISSIONS ONLINE
                    </span>
                </div>
            </div>

            <div className="relative z-10">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-white mb-1">NEXUS MISSION HUB</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6 leading-relaxed">
                    EXECUTE PROTOCOLS TO ACCUMULATE <span className="text-blue-400">XP</span> & <span className="text-emerald-400">LIQUID ASSETS</span>.
                </p>
            </div>

            <div className="space-y-2.5 mb-8 flex-grow relative z-10">
                {isLoading ? (
                    [1, 2].map(i => (
                        <div key={i} className="h-14 bg-white/5 rounded-xl border border-white/5 animate-pulse" />
                    ))
                ) : tasks.length > 0 ? (
                    tasks.map((task, i) => (
                        <div key={task.id} className="group/item flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/40 border border-white/5 hover:border-blue-500/30 hover:bg-zinc-900/60 transition-all duration-300">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-lg group-hover/item:scale-110 transition-transform">
                                    {task.platform === 'twitter' ? '🐦' : task.platform === 'farcaster' ? '🦄' : '⚡'}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none mb-1">
                                        {task.title.length > 18 ? task.title.slice(0, 18) + '...' : task.title}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1">
                                            <Coins size={8} className="text-yellow-500/70" />
                                            <span className="text-[8px] font-bold text-slate-500">+{task.xp_reward}</span>
                                        </div>
                                        {task.token_reward_amount > 0 && (
                                            <div className="flex items-center gap-1">
                                                <Gift size={8} className="text-emerald-500/70" />
                                                <span className="text-[8px] font-bold text-slate-500">${task.token_reward_amount}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <CheckCircle2 size={14} className="text-slate-800 group-hover/item:text-blue-500/50 transition-colors" />
                        </div>
                    ))
                ) : (
                    <div className="py-6 text-center border border-dashed border-white/10 rounded-xl">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">NO ACTIVE MISSIONS</p>
                    </div>
                )}
            </div>

            <Link to="/tasks" className="relative z-10 w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 group/btn active:scale-95">
                ACCESS MISSION CONTROL
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
        </GridCard>
    );
}
