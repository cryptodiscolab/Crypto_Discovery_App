import React, { useState, useEffect } from 'react';
import { Users, Zap, Activity, Globe, Loader2 } from 'lucide-react';

/**
 * NexusPulseStrip: Real-time Ecosystem Analytics
 * (v3.42.0 Identity & Growth Release)
 */
export const NexusPulseStrip = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_VERIFY_SERVER_URL}/api/verify/ecosystem-stats`);
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('[NexusPulse] Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 60000); // 60s Refresh
        return () => clearInterval(interval);
    }, []);

    if (loading && !stats) {
        return (
            <div className="w-full py-3 flex items-center justify-center gap-3 bg-black/40 border-b border-white/5 backdrop-blur-md">
                <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Synchronizing Ecosystem Pulse...</span>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#0B0E14]/80 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50 overflow-hidden">
            <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-12 overflow-x-auto no-scrollbar">
                
                {/* Live Indicator */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </div>
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Nexus Pulse</span>
                </div>

                {/* Metrics Row */}
                <div className="flex items-center gap-8 md:gap-12 flex-grow justify-end">
                    
                    {/* DAU */}
                    <div className="flex items-center gap-2 group cursor-help transition-all hover:scale-105">
                        <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/20" />
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white uppercase tabular-nums">
                                {stats?.dau || 0} <span className="text-slate-500 font-bold ml-1">DAU</span>
                            </span>
                        </div>
                    </div>

                    {/* Total Members */}
                    <div className="flex items-center gap-2 group cursor-help transition-all hover:scale-105">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white uppercase tabular-nums">
                                {stats?.totalMembers || 0} <span className="text-slate-500 font-bold ml-1">MEMBERS</span>
                            </span>
                        </div>
                    </div>

                    {/* Online / CCU */}
                    <div className="flex items-center gap-2 group cursor-help transition-all hover:scale-105">
                        <div className="relative">
                           <Globe className="w-3.5 h-3.5 text-green-500" />
                           <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse border border-black" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white uppercase tabular-nums">
                                {stats?.online || 0} <span className="text-slate-500 font-bold ml-1">ONLINE</span>
                            </span>
                        </div>
                    </div>

                    {/* Volume / Total Tx */}
                    <div className="flex items-center gap-2 group cursor-help transition-all hover:scale-105">
                        <Activity className="w-3.5 h-3.5 text-red-500" />
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white uppercase tabular-nums">
                                {stats?.totalTx || 0} <span className="text-slate-500 font-bold ml-1">ACTIVITY</span>
                            </span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Scanning Line Effect */}
            <div className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent w-full animate-shimmer" />
        </div>
    );
};
