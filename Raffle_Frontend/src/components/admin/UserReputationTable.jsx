import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    AlertTriangle,
    ChevronDown,
    Calculator,
    RefreshCw,
    ExternalLink,
    DollarSign,
    Database,
    CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * StaticSkeletonCard: No-animation placeholder for ultra-stable rendering.
 */
const StaticSkeletonCard = () => (
    <div className="p-4 border-b border-white/5 bg-[#0a0a0c] flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-white/5 rounded-lg" />
            <div className="space-y-1">
                <div className="h-2 w-16 bg-white/5 rounded" />
                <div className="h-2 w-10 bg-white/5 rounded" />
            </div>
        </div>
        <div className="h-6 w-10 bg-white/5 rounded-md" />
    </div>
);

/**
 * MobileUserCard: Specialized Flexbox Card for WebViews.
 * Optimized for: A-series (iOS) & Snapdragon (Android).
 */
const MobileUserCard = memo(({ user, sybilDetected }) => {
    // Calculate Trust Score Percentage (Assuming 100 is max for visual)
    const trustPercent = Math.min(user.internal_trust_score || 0, 100);

    return (
        <div
            className="p-4 border-b border-white/5 bg-[#0a0a0c] flex flex-col gap-3"
            style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 bg-[#161618] rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5">
                        {user.pfp_url ? (
                            <img src={user.pfp_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                            <span className="text-indigo-500 font-black text-[10px]">FC</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-black text-white text-[13px] truncate uppercase tracking-tight">@{user.username || 'anon'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            {sybilDetected ? (
                                <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[9px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Sybil
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle className="w-2.5 h-2.5" /> Verified
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <a
                        href={`https://warpcast.com/${user.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-[#161618] rounded-lg border border-white/5 active:scale-95 transition-transform"
                    >
                        <ExternalLink className="w-4 h-4 text-indigo-500" />
                    </a>
                </div>
            </div>

            {/* Trust Score Progress Bar */}
            <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span className="text-slate-500">Trust Score</span>
                    <span className="text-white">{user.internal_trust_score || 0}</span>
                </div>
                <div className="h-1.5 w-full bg-[#161618] rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full ${sybilDetected ? 'bg-red-500' : 'bg-indigo-500'}`}
                        style={{ width: `${trustPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
});

MobileUserCard.displayName = 'MobileUserCard';

/**
 * UserReputationTable: CROSS-PLATFORM EXTREME EDITION.
 * Fixes: Incremental Loading, Flat Design, Zero Blur, Static Skeletons.
 */
export default function UserReputationTable() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [revenue, setRevenue] = useState(2500);
    const limit = 5; // Incremental Fetch Size

    const fetchReputationMetrics = useCallback(async (isInitial = false) => {
        setLoading(true);
        try {
            const currentPage = isInitial ? 0 : page;
            const rangeStart = currentPage * limit;
            const { data, count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact' })
                .order('internal_trust_score', { ascending: false })
                .range(rangeStart, rangeStart + limit - 1);

            if (error) throw error;

            if (isInitial) {
                setUsers(data || []);
                setPage(1);
            } else {
                setUsers(prev => [...prev, ...(data || [])]);
                setPage(prev => prev + 1);
            }
            setTotalCount(count || 0);
        } catch (e) {
            console.error('[Extreme Mobile Audit] Failure:', e.message);
            toast.error("Pipeline sync failed.");
        } finally {
            setLoading(false);
        }
    }, [page, limit]);

    // Initial Load
    useEffect(() => {
        fetchReputationMetrics(true);
    }, []);

    const payoutPool = useMemo(() => revenue * 0.3, [revenue]);
    const hasMore = users.length < totalCount;

    return (
        <div className="space-y-4" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>

            {/* Flat Revenue Component */}
            <div className="bg-[#121214] p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter">Profit Audit (30%)</span>
                    </div>
                    <div className="bg-black px-2 py-1 rounded border border-white/10">
                        <input
                            type="number"
                            value={revenue}
                            onChange={(e) => setRevenue(Number(e.target.value))}
                            className="bg-transparent border-none outline-none text-white font-black text-[10px] w-14"
                        />
                    </div>
                </div>
                <div className="h-px bg-white/5 w-full mb-2" />
                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="text-slate-600 tracking-widest">Share Pool</span>
                    <span className="text-emerald-500">${payoutPool.toLocaleString()}</span>
                </div>
            </div>

            {/* List Container - iOS Native Scrolling */}
            <div
                className="bg-[#0a0a0c] rounded-2xl border border-white/5 overflow-hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {users.length === 0 && loading ? (
                    Array.from({ length: 5 }).map((_, i) => <StaticSkeletonCard key={i} />)
                ) : (
                    <>
                        {users.map(user => (
                            <MobileUserCard
                                key={user.id}
                                user={user}
                                sybilDetected={(user.verified_addresses?.length || 0) > 1}
                            />
                        ))}
                    </>
                )}

                {/* Incremental Trigger */}
                {hasMore && (
                    <button
                        disabled={loading}
                        onClick={() => fetchReputationMetrics()}
                        className="w-full py-5 bg-[#121214] flex flex-col items-center justify-center gap-1 active:bg-white/5 transition-colors"
                    >
                        {loading ? (
                            <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                        ) : (
                            <>
                                <ChevronDown className="w-5 h-5 text-slate-700" />
                                <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest leading-none">Load More</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Footer Metrics */}
            <div className="flex items-center justify-between px-2 opacity-40">
                <div className="flex items-center gap-1">
                    <Database className="w-2.5 h-2.5 text-indigo-500" />
                    <span className="text-[8px] font-black text-white uppercase tracking-tighter">Nodes: {totalCount}</span>
                </div>
                <button
                    onClick={() => fetchReputationMetrics(true)}
                    className="flex items-center gap-1 text-[8px] font-black text-white uppercase tracking-tighter"
                >
                    <RefreshCw className="w-2.5 h-2.5" /> Force Sync
                </button>
            </div>
        </div>
    );
}
