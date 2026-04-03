import React, { useState, useEffect } from 'react';
import { History, Zap, ShoppingCart, Award, Clock, ArrowRight, ExternalLink } from 'lucide-react';

const ActivityLogSection = ({ walletAddress }) => {
    const [logs, setLogs] = useState([]);
    const [category, setCategory] = useState('ALL');
    const [loading, setLoading] = useState(true);

    const categories = [
        { id: 'ALL', label: 'ALL ACTIVITY', icon: History },
        { id: 'XP', label: 'XP GAINS', icon: Zap },
        { id: 'PURCHASE', label: 'PURCHASES', icon: ShoppingCart },
        { id: 'REWARD', label: 'REWARDS', icon: Award }
    ];

    useEffect(() => {
        if (walletAddress) {
            fetchLogs();
        }
    }, [walletAddress, category]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/user-bundle?action=get-activity-logs&wallet=${walletAddress}&category=${category}`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-[#0f0f0f]/80 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden mt-8 shadow-2xl">
            {/* Header & Tabs */}
            <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 mb-4 text-white">
                    <History className="w-5 h-5 text-purple-400" />
                    ACTIVITY HISTORY
                </h3>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${category === cat.id
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'
                                }`}
                        >
                            <cat.icon className="w-3.5 h-3.5" />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[500px] overflow-y-auto no-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <p className="text-white/40 text-[11px] uppercase font-black tracking-widest">SYNCING FEED...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-white/30 text-[11px] font-black uppercase tracking-widest italic">NO ACTIVITY FOUND</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className="group flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.08] hover:border-white/10 transition-all duration-300"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${log.category === 'XP' ? 'bg-purple-500/20 text-purple-400' :
                                            log.category === 'PURCHASE' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-amber-500/20 text-amber-400'
                                        }`}>
                                        {log.category === 'XP' ? <Zap className="w-5 h-5" /> :
                                            log.category === 'PURCHASE' ? <ShoppingCart className="w-5 h-5" /> :
                                                <Award className="w-5 h-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-black text-white group-hover:text-purple-300 transition-colors uppercase text-[11px] tracking-widest mb-0.5">
                                            {log.activity_type.toUpperCase()}
                                        </div>
                                        <div className="text-white/60 text-[11px] uppercase tracking-widest font-black truncate max-w-[150px] sm:max-w-none opacity-70">{log.description.toUpperCase()}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Clock className="w-3 h-3 text-white/20" />
                                            <span className="text-[11px] text-white/40 font-black uppercase tracking-widest">{formatDate(log.created_at).toUpperCase()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 text-right ml-4">
                                    <div className={`font-black text-[11px] uppercase tracking-widest flex items-center gap-1 ${log.value_amount > 0 ? 'text-green-400' :
                                            log.value_amount < 0 ? 'text-red-400' : 'text-white'
                                        }`}>
                                        {log.value_amount > 0 ? '+' : ''}{log.value_amount} <span className="opacity-60">{log.value_symbol}</span>
                                    </div>
                                    {log.tx_hash && (
                                        <a
                                            href={`https://sepolia.basescan.org/tx/${log.tx_hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-black text-white/40 hover:text-purple-400 flex items-center gap-1 uppercase tracking-widest transition-colors"
                                        >
                                            BLOCKCHAIN <ExternalLink className="w-2 h-2" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 bg-white/[0.02] text-center border-t border-white/5">
                <button
                    onClick={fetchLogs}
                    className="text-[11px] font-black text-white/30 hover:text-white uppercase tracking-widest flex items-center gap-2 mx-auto transition-all group"
                >
                    REFRESH LOGS <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default ActivityLogSection;
