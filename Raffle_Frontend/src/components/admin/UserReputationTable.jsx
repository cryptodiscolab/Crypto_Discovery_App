import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Calculator,
    TrendingUp,
    RefreshCw,
    ExternalLink,
    DollarSign,
    Database
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * MobileUserCard: Replaces <tr> for ultra-low spec Android WebView.
 * Hardware-Target: Mobile In-App Browser (Base App).
 */
const MobileUserCard = memo(({ user, sybilDetected }) => {
    return (
        <div className={`p-4 border-b border-white/5 bg-[#121720] flex items-center justify-between gap-3`} style={{ transform: 'translateZ(0)' }}>
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-slate-800 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {user.pfp_url ? (
                        <img src={user.pfp_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-indigo-400 font-black text-[10px]">FC</span>
                    )}
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-white text-xs truncate">@{user.username || 'anon'}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-500 font-mono">FID: {user.fid}</span>
                        {sybilDetected && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-md">
                    <span className="text-[9px] font-black text-indigo-400">{user.internal_trust_score || 0}</span>
                </div>
                <a
                    href={`https://warpcast.com/${user.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 hover:bg-white/5 rounded"
                >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </a>
            </div>
        </div>
    );
});

MobileUserCard.displayName = 'MobileUserCard';

/**
 * UserReputationTable: MOBILE PERFORMANCE EDITION.
 * Fixes: Pure Divs, Solid Colors, Limit 5, Sync-on-demand.
 */
export default function UserReputationTable() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [revenue, setRevenue] = useState(2500);
    const limit = 5; // Reduced for Mobile WebView

    const fetchReputationMetrics = useCallback(async (isManual = false) => {
        if (!isManual && !hasLoaded) return;

        setLoading(true);
        try {
            const rangeStart = page * limit;
            const { data, count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact' })
                .order('internal_trust_score', { ascending: false })
                .range(rangeStart, rangeStart + limit - 1);

            if (error) throw error;
            setUsers(data || []);
            setTotalCount(count || 0);
            setHasLoaded(true);
        } catch (e) {
            console.error('[Base App Optimization] Failure:', e.message);
            toast.error("Failed to sync rep data.");
        } finally {
            setLoading(false);
        }
    }, [page, hasLoaded, limit]);

    useEffect(() => {
        if (hasLoaded) {
            fetchReputationMetrics();
        }
    }, [page]);

    const payoutPool = useMemo(() => revenue * 0.3, [revenue]);

    return (
        <div className="space-y-4" style={{ transform: 'translateZ(0)' }}>
            {/* Minimalist Revenue Block */}
            <div className="bg-slate-900 border-l-2 border-indigo-500 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-indigo-400" />
                        <span className="text-[10px] font-black text-white uppercase italic">Profit Audit (30%)</span>
                    </div>
                    <div className="bg-black px-2 py-1 rounded border border-white/5">
                        <input
                            type="number"
                            value={revenue}
                            onChange={(e) => setRevenue(Number(e.target.value))}
                            className="bg-transparent border-none outline-none text-white font-bold text-[10px] w-12"
                        />
                    </div>
                </div>
                <p className="text-[10px] font-medium text-slate-400 uppercase">
                    Payout Pool: <span className="text-emerald-400 font-black">${payoutPool.toLocaleString()}</span>
                </p>
            </div>

            {/* Sync Trigger */}
            {!hasLoaded && (
                <div className="p-8 text-center bg-slate-900 rounded-2xl border border-white/5">
                    <Database className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-slate-500 mb-4 font-medium uppercase tracking-widest">Connect to Data Source?</p>
                    <button
                        onClick={() => fetchReputationMetrics(true)}
                        className="w-full bg-indigo-600 py-3 rounded-xl text-white text-[10px] font-black uppercase tracking-tighter active:scale-95 transition-all"
                    >
                        Load Rep Data
                    </button>
                </div>
            )}

            {/* Data Feed */}
            {hasLoaded && (
                <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-10 text-center text-[10px] font-black text-slate-600 uppercase animate-pulse">
                            Syncing via Supabase...
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {users.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 text-[10px] uppercase">No Profile Node Found</div>
                            ) : (
                                users.map(user => (
                                    <MobileUserCard
                                        key={user.id}
                                        user={user}
                                        sybilDetected={(user.verified_addresses?.length || 0) > 1}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* Simple Pagination */}
                    <div className="p-4 bg-black/20 flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500">P-{page + 1}</span>
                        <div className="flex gap-4">
                            <button
                                disabled={page === 0 || loading}
                                onClick={() => setPage(p => p - 1)}
                                className="text-slate-400 disabled:opacity-10"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                disabled={(page + 1) * limit >= totalCount || loading}
                                onClick={() => setPage(p => p + 1)}
                                className="text-indigo-500 disabled:opacity-10"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {hasLoaded && (
                <div className="text-center pt-2">
                    <button
                        onClick={() => fetchReputationMetrics(true)}
                        className="text-[9px] font-black text-slate-700 uppercase tracking-widest"
                    >
                        Force Pipeline Sync
                    </button>
                </div>
            )}
        </div>
    );
}
