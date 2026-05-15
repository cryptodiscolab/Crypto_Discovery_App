import { useState } from 'react';
import { History, Zap, ShoppingCart, Award, Clock, ArrowRight, ExternalLink, Gem, Ticket, Users, Fingerprint, RefreshCw, Calendar } from 'lucide-react';
import { useActivityLogs } from '../hooks/useProfileQueries';
import { ActivityLog } from '../types';

interface ActivityLogSectionProps {
    walletAddress?: string;
}

/**
 * ActivityLogSection Component
 * [v3.64.0] Responsive, non-overlapping activity history with proper mobile stacking
 */
export const ActivityLogSection = ({ walletAddress }: ActivityLogSectionProps) => {
    const [category, setCategory] = useState('ALL');
    const { data: logsData, isLoading, refetch } = useActivityLogs(walletAddress, category);
    const logs: ActivityLog[] = logsData?.logs || [];

    const categories = [
        { id: 'ALL', label: 'ALL', icon: History },
        { id: 'XP', label: 'XP', icon: Zap },
        { id: 'DAILY', label: 'DAILY', icon: Calendar },
        { id: 'PURCHASE', label: 'PURCHASES', icon: ShoppingCart },
        { id: 'REWARD', label: 'REWARDS', icon: Award },
        { id: 'RAFFLE', label: 'RAFFLE', icon: Ticket },
        { id: 'SBT', label: 'SBT', icon: Gem },
        { id: 'UGC', label: 'UGC', icon: Users },
        { id: 'IDENTITY', label: 'IDENTITY', icon: Fingerprint },
        { id: 'SYNC', label: 'SYNC', icon: RefreshCw }
    ];

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getCategoryStyle = (cat: string) => {
        switch (cat) {
            case 'XP': return 'bg-purple-500/20 text-purple-400';
            case 'PURCHASE': case 'SWAP': case 'EXPENSE': return 'bg-blue-500/20 text-blue-400';
            case 'SBT': return 'bg-indigo-500/20 text-indigo-400';
            case 'DAILY': return 'bg-green-500/20 text-green-400';
            case 'RAFFLE': return 'bg-pink-500/20 text-pink-400';
            case 'UGC': return 'bg-cyan-500/20 text-cyan-400';
            case 'IDENTITY': return 'bg-teal-500/20 text-teal-400';
            case 'SYNC': return 'bg-slate-500/20 text-slate-400';
            case 'REWARD': case 'PAYOUT': return 'bg-amber-500/20 text-amber-400';
            case 'ERROR': return 'bg-red-500/20 text-red-400';
            default: return 'bg-amber-500/20 text-amber-400';
        }
    };

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'XP': return Zap;
            case 'PURCHASE': case 'SWAP': case 'EXPENSE': return ShoppingCart;
            case 'SBT': return Gem;
            case 'DAILY': return Calendar;
            case 'RAFFLE': return Ticket;
            case 'UGC': return Users;
            case 'IDENTITY': return Fingerprint;
            case 'SYNC': return RefreshCw;
            case 'REWARD': case 'PAYOUT': return Award;
            default: return Award;
        }
    };

    return (
        <div className="bg-[#0f0f0f]/80 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden mt-8 shadow-2xl">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <History className="w-4 h-4 text-purple-400" />
                        ACTIVITY HISTORY
                    </h3>
                    <button
                        onClick={() => refetch()}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Filter Tabs — horizontal scroll on mobile, wraps on desktop */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none no-scrollbar">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 ${
                                category === cat.id
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-500/20'
                                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/5'
                            }`}
                        >
                            <cat.icon className="w-3 h-3" />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-8 h-8 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">SYNCING FEED...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                        <History className="w-10 h-10 text-white/10" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/25">NO ACTIVITY FOUND</p>
                        <p className="text-[9px] text-white/15 uppercase tracking-widest">Complete tasks to see your history here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {logs.map((log) => {
                            const IconComponent = getCategoryIcon(log.category);
                            return (
                                <div
                                    key={log.id}
                                    className="px-4 py-3 sm:px-6 sm:py-4 hover:bg-white/[0.03] transition-colors"
                                >
                                    {/* Mobile: stacked layout. Desktop: row layout */}
                                    <div className="flex items-start gap-3">
                                        {/* Icon */}
                                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${getCategoryStyle(log.category)}`}>
                                            <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>

                                        {/* Content — takes remaining space */}
                                        <div className="flex-1 min-w-0">
                                            {/* Top row: type + amount */}
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-[11px] font-black text-white uppercase tracking-wider leading-tight line-clamp-1">
                                                    {log.activity_type}
                                                </span>
                                                <span className={`text-[11px] font-black shrink-0 ${
                                                    log.value_amount > 0 ? 'text-emerald-400' :
                                                    log.value_amount < 0 ? 'text-red-400' : 'text-white/50'
                                                }`}>
                                                    {log.value_amount > 0 ? '+' : ''}{log.value_amount} {log.value_symbol}
                                                </span>
                                            </div>

                                            {/* Description */}
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5 line-clamp-2 leading-relaxed">
                                                {log.description}
                                            </p>

                                            {/* Bottom row: date + tx link */}
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[9px] text-white/25 font-bold uppercase tracking-widest flex items-center gap-1">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {formatDate(log.created_at)}
                                                </span>
                                                {log.tx_hash && (
                                                    <a
                                                        href={`https://sepolia.basescan.org/tx/${log.tx_hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[9px] text-purple-400/60 hover:text-purple-400 font-bold uppercase tracking-widest flex items-center gap-0.5 transition-colors"
                                                    >
                                                        TX <ExternalLink className="w-2 h-2" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            {logs.length > 0 && (
                <div className="px-4 py-3 bg-white/[0.02] border-t border-white/5 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">
                        {logs.length} {logs.length === 1 ? 'ENTRY' : 'ENTRIES'} SHOWN
                    </span>
                </div>
            )}
        </div>
    );
};
