import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
    Cpu, Brain, Shield, Zap,
    Activity, Clock, CheckCircle2,
    AlertCircle, Terminal, RefreshCw,
    Send, Sparkles
} from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';

export const NexusMonitorTab = () => {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDispatching, setIsDispatching] = useState(false);
    const [stats, setStats] = useState({
        claw: 'idle',
        qwen: 'idle',
        deepseek: 'idle'
    });

    // Form States
    const [taskName, setTaskName] = useState('');
    const [taskDesc, setTaskDesc] = useState('');
    const [targetAgent, setTargetAgent] = useState('qwen');

    useEffect(() => {
        fetchTasks();

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

    const handleDispatch = async (e) => {
        e.preventDefault();
        if (!isConnected) return toast.error("Connect Wallet First");
        if (!taskName || !taskDesc) return toast.error("Fill all fields");

        setIsDispatching(true);
        const tid = toast.loading(`Dispatching to ${targetAgent.toUpperCase()}...`);

        try {
            const timestamp = new Date().toISOString();
            const message = `Agent Nexus Dispatch\nAgent: ${targetAgent}\nTask: ${taskName}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/agents-nexus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    task_name: taskName,
                    task_description: taskDesc,
                    target_agent: targetAgent
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success("Task Synchronized to Nexus!", { id: tid });
                setTaskName('');
                setTaskDesc('');
            } else {
                throw new Error(result.error || "Dispatch failed");
            }
        } catch (err) {
            toast.error(err.message, { id: tid });
        } finally {
            setIsDispatching(false);
        }
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

            {/* Quick Dispatch Form */}
            <div className="bg-[#080808]/60 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Sparkles className="w-24 h-24 text-indigo-500" />
                </div>

                <div className="relative">
                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3 mb-1">
                        <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400/20" />
                        QUICK DISPATCH
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mb-8">Deploy Autonomous Task to Nexus</p>

                    <form onSubmit={handleDispatch} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <input
                                type="text"
                                placeholder="TASK NAME (e.g. Audit Pool Security)"
                                value={taskName}
                                onChange={(e) => setTaskName(e.target.value.toUpperCase())}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-white placeholder:text-slate-600 focus:border-indigo-500/50 outline-none transition-all"
                            />
                            <textarea
                                placeholder="TASK DESCRIPTION & CONTEXT..."
                                value={taskDesc}
                                onChange={(e) => setTaskDesc(e.target.value)}
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-medium text-slate-300 placeholder:text-slate-600 focus:border-indigo-500/50 outline-none transition-all resize-none"
                            />
                        </div>
                        <div className="space-y-4">
                            <select
                                value={targetAgent}
                                onChange={(e) => setTargetAgent(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-white outline-none cursor-pointer appearance-none hover:bg-white/10 transition-all"
                            >
                                <option value="qwen" className="bg-[#080808]">TARGET: QWEN-CODER (Local)</option>
                                <option value="claw" className="bg-[#080808]">TARGET: OPENCLAW (Security)</option>
                                <option value="deepseek" className="bg-[#080808]">TARGET: DEEPSEEK (Logic)</option>
                            </select>
                            <button
                                type="submit"
                                disabled={isDispatching}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl py-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                            >
                                {isDispatching
                                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                                    : <><Send className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Execute Dispatch</span></>
                                }
                            </button>
                        </div>
                    </form>
                </div>
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
                                                    <div className="opacity-80 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                                                        {task.output_data?.result
                                                            ? (typeof task.output_data.result === 'string' ? task.output_data.result : JSON.stringify(task.output_data.result, null, 2))
                                                            : (typeof task.output_data === 'string' ? task.output_data : JSON.stringify(task.output_data, null, 2))
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
