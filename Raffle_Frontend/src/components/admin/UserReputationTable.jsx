import React, { useState, useEffect, useMemo, memo } from 'react';
// Fix: Use relative path instead of @ alias for Vercel compatibility
import { supabase } from '../../lib/supabaseClient';
import {
    Users,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Calculator,
    TrendingUp,
    Shuffle,
    RefreshCw,
    ExternalLink,
    DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * UserRow: Optimized Table Cell with memoization.
 * Hardware-Target: Lenovo Low-spec.
 */
const UserRow = memo(({ user, sybilDetected }) => {
    return (
        <tr className={`group hover:bg-white/[0.03] transition-all ${sybilDetected ? 'bg-red-500/5' : ''}`}>
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="avatar h-8 w-8 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20 overflow-hidden">
                        {user.pfp_url ? (
                            <img src={user.pfp_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-indigo-400 font-black text-[10px]">FC</span>
                        )}
                    </div>
                    <div>
                        <p className="font-bold text-white text-xs">@{user.username || 'anon'}</p>
                        <p className="text-[9px] text-slate-500 font-mono">FID: {user.fid}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-col gap-1 w-full max-w-[80px]">
                    <div className="flex justify-between items-center text-[9px] font-black">
                        <span className="text-indigo-400">{user.internal_trust_score || 0}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full">
                        <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${Math.min(user.internal_trust_score || 0, 100)}%` }}
                        />
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <span className="text-[10px] text-slate-400 font-mono">{user.fid}</span>
            </td>
            <td className="px-6 py-4">
                {sybilDetected ? (
                    <div className="flex items-center gap-1.5 text-red-400 text-[8px] font-black uppercase tracking-tighter bg-red-500/10 px-2 py-0.5 rounded-full w-fit">
                        <AlertTriangle className="w-3 h-3" /> Sybil Warning
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[8px] font-black uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit">
                        <TrendingUp className="w-3 h-3" /> Trusted
                    </div>
                )}
            </td>
            <td className="px-6 py-4 text-right">
                <a
                    href={`https://warpcast.com/${user.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </a>
            </td>
        </tr>
    );
});

UserRow.displayName = 'UserRow';

/**
 * UserReputationTable: Lead Admin Center.
 * Fixes: Limit 10, AST consistency, forked dependencies.
 */
export default function UserReputationTable() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [revenue, setRevenue] = useState(2500);
    const limit = 10;

    const fetchReputationMetrics = async () => {
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
        } catch (e) {
            console.error('[Build QA] Supabase Failure:', e.message);
            toast.error("Build Logic Error: Gagal fetch data profiles.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReputationMetrics();
    }, [page]);

    // Revenue Simulator Core (30%)
    const payoutPool = useMemo(() => revenue * 0.3, [revenue]);

    return (
        <div className="space-y-4">
            {/* Revenue Share Component */}
            <div className="bg-indigo-600/5 border border-indigo-500/20 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Calculator className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-black text-white uppercase tracking-tighter">Revenue Share Audit (30%)</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                        <DollarSign className="w-3 h-3 text-slate-500" />
                        <input
                            type="number"
                            value={revenue}
                            onChange={(e) => setRevenue(Number(e.target.value))}
                            className="bg-transparent border-none outline-none text-white font-bold text-xs w-16"
                        />
                    </div>
                    <div className="text-[10px] font-black uppercase text-indigo-400">
                        Share: ${payoutPool.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Principal Reputation Table */}
            <div className="bg-black/30 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto overflow-y-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/[0.02] text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4">Username / Identity</th>
                                <th className="px-6 py-4">Trust Score</th>
                                <th className="px-6 py-4">FID</th>
                                <th className="px-6 py-4">Sybil Status</th>
                                <th className="px-6 py-4 text-right pr-8">Link</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-6 bg-white/[0.01] h-12"></td>
                                    </tr>
                                ))
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-mono text-[10px] italic">
                                        No profile data found in Supabase origin.
                                    </td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <UserRow
                                        key={user.id}
                                        user={user}
                                        sybilDetected={(user.verified_addresses?.length || 0) > 1}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Intelligent Navigation */}
                <div className="px-6 py-3 bg-white/5 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        Page {page + 1} of {Math.ceil(totalCount / limit)}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0 || loading}
                            onClick={() => setPage(p => p - 1)}
                            className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-20 transition-all border border-white/5"
                        >
                            <ChevronLeft className="w-3.5 h-3.5 text-white" />
                        </button>
                        <button
                            disabled={(page + 1) * limit >= totalCount || loading}
                            onClick={() => setPage(p => p + 1)}
                            className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-20 transition-all border border-white/5"
                        >
                            <ChevronRight className="w-3.5 h-3.5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center pt-2">
                <button
                    onClick={fetchReputationMetrics}
                    disabled={loading}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-indigo-400 uppercase tracking-widest transition-all"
                >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Sync Data Pipeline
                </button>
            </div>
        </div>
    );
}
