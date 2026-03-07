import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
    Cpu, Brain, Shield, Zap,
    Activity, Clock, CheckCircle2,
    AlertCircle, Terminal, RefreshCw
} from 'lucide-react';

export const NexusMonitorTab = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        claw: 'idle',
        qwen: 'idle',
        deepseek: 'idle'
    });

    useEffect(() => {
        fetchTasks();

        // Real-time subscription to agents_vault
        const channel = supabase
            .channel('nexus-live')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'agents_vault'
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setTasks(prev => [payload.new, ...prev].slice(0, 50));
                } else if (payload.eventType === 'UPDATE') {
                    setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        // Update agent status based on active tasks
        const activeTasks = tasks.filter(t => t.status === 'processing' || t.status === 'pending');
        const newStats = { claw: 'idle', qwen: 'idle', deepseek: 'idle' };

        activeTasks.forEach(t => {
            if (newStats[t.target_agent]) newStats[t.target_agent] = 'active';
        });

        setStats(newStats);
    }, [tasks]);

    const fetchTasks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('agents_vault')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setTasks(data);
        setLoading(false);
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
            case 'failed': return <AlertCircle className="w-4 h-4 text-red-400" />;
            case 'processing': return <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />;
            case 'pending': return <Clock className="w-4 h-4 text-slate-400 animate-pulse" />;
            default: return <Activity className="w-4 h-4 text-slate-500" />;
        }
    };

    const AgentCard = ({ id, name, icon: Icon, color, status }) => (
        <div className={`p-6 rounded-3xl border transition-all duration-500 bg-[#080808]/40 ${status === 'active'
                ? `border-${color}-500/30 bg-${color}-500/5`
                : 'border-white/5 opacity-60'
            }`}>
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl bg-${color}-500/10 border border-${color}-500/20`}>
                    <Icon className={`w-6 h-6 text-${color}-400 ${status === 'active' ? 'animate-pulse' : ''}`} />
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'active' ? `bg-${color}-400 animate-ping` : 'bg-slate-700'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {status}
                    </span>
                </div>
            </div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">{name}</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Ready for Tasks</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AgentCard id="claw" name="OpenClaw" icon={Shield} color="indigo" status={stats.claw} />
                <AgentCard id="qwen" name="Qwen-Coder" icon={Cpu} color="emerald" status={stats.qwen} />
                <AgentCard id="deepseek" name="DeepSeek" icon={Brain} color="purple" status={stats.deepseek} />
            </div>

            {/* Task Feed */}
            <div className="bg-[#080808]/60 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-xl">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-3">
                            <Terminal className="w-5 h-5 text-indigo-400" />
                            NEXUS LIVE FEED
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Real-time Multi-Agent Activity</p>
                    </div>
                    <button
                        onClick={fetchTasks}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-400 group-hover:text-white ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {tasks.length === 0 ? (
                        <div className="p-20 text-center opacity-30">
                            <Zap className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No Recent Activity Detected</p>
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <div key={task.id} className="p-6 hover:bg-white/[0.02] transition-colors group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="mt-1">
                                            {getStatusIcon(task.status)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${task.target_agent === 'claw' ? 'bg-indigo-500/10 text-indigo-400' :
                                                        task.target_agent === 'qwen' ? 'bg-emerald-500/10 text-emerald-400' :
                                                            'bg-purple-500/10 text-purple-400'
                                                    }`}>
                                                    {task.target_agent}
                                                </span>
                                                <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition-colors uppercase tracking-wider">
                                                    {task.task_name}
                                                </h4>
                                            </div>
                                            <p className="text-[11px] text-slate-400 font-medium line-clamp-2 leading-relaxed">
                                                {task.task_description}
                                            </p>

                                            {task.output_data && (typeof task.output_data === 'object' ? Object.keys(task.output_data).length > 0 : task.output_data) && (
                                                <div className="mt-4 p-4 bg-black/40 rounded-2xl border border-white/5 font-mono text-[10px] text-slate-300 overflow-hidden">
                                                    <div className="flex items-center gap-2 mb-2 text-slate-500 uppercase tracking-widest font-black">
                                                        <Activity className="w-3 h-3" /> Output Log
                                                    </div>
                                                    <div className="opacity-80 leading-relaxed overflow-x-auto">
                                                        {task.output_data?.result
                                                            ? (typeof task.output_data.result === 'string' ? task.output_data.result : JSON.stringify(task.output_data.result, null, 2))
                                                            : JSON.stringify(task.output_data, null, 2)
                                                        }
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                                            {new Date(task.created_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
