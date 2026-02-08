import React, { useState, useEffect, useMemo, memo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
    Users,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Calculator,
    TrendingUp,
    ShieldCheck,
    RefreshCw,
    ExternalLink,
    DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

// Optimized Table Row to prevent unnecessary re-renders (IDX Optimization)
const UserRow = memo(({ user, isSybil }) => (
    <tr className={`group hover:bg-white/[0.02] transition-colors ${isSybil ? 'bg-red-500/5' : ''}`}>
        <td className="px-6 py-4">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30 overflow-hidden">
                    {user.pfp_url ? (
                        <img src={user.pfp_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-indigo-400 font-bold text-[10px]">FID</span>
                    )}
                </div>
                <div>
                    <p className="font-black text-white text-xs">@{user.username || 'unknown'}</p>
                    <p className="text-[9px] text-slate-500 font-mono">FID: {user.fid}</p>
                </div>
            </div>
        </td>
        <td className="px-6 py-4">
            <div className="flex flex-col gap-1 w-full max-w-[100px]">
                <div className="flex justify-between items-center text-[9px] font-black">
                    <span className="text-indigo-400">{user.internal_trust_score || 0}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${Math.min(user.internal_trust_score || 0, 100)}%` }}
                    ></div>
                </div>
            </div>
        </td>
        <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
            {user.fid}
        </td>
        <td className="px-6 py-4">
            {isSybil ? (
                <div className="flex items-center gap-1.5 text-red-500 text-[9px] font-black uppercase">
                    <AlertTriangle className="w-3 h-3" />
                    Sybil Alert
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-emerald-500 text-[9px] font-black uppercase">
                    <ShieldCheck className="w-3 h-3" />
                    Clear
                </div>
            )}
        </td>
        <td className="px-6 py-4 text-right">
            <a href={`https://warpcast.com/${user.username}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 hover:text-white transition-colors" />
            </a>
        </td>
    </tr>
));

export default function UserReputationTable() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 10; // Forced discipline (Constraint 3)

    // Revenue Share State
    const [revenue, setRevenue] = useState(1000);

    const fetchReputationData = async () => {
        setLoading(true);
        try {
            const start = page * pageSize;
            const { data, count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact' })
                .order('internal_trust_score', { ascending: false })
                .range(start, start + pageSize - 1);

            if (error) throw error;
            setUsers(data || []);
            setTotalCount(count || 0);
        } catch (e) {
            toast.error("Query Failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReputationData();
    }, [page]);

    const revSharePool = useMemo(() => revenue * 0.3, [revenue]);

    return (
        <div className="space-y-6">
            {/* Revenue Tool */}
            <div className="bg-indigo-600/10 border border-indigo-500/20 p-5 rounded-3xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calculator className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-sm font-black text-white uppercase tracking-tighter">Analyze Revenue Share (30%)</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <input
                            type="number"
                            value={revenue}
                            onChange={(e) => setRevenue(Number(e.target.value))}
                            className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-white font-bold text-xs"
                        />
                    </div>
                </div>
                <div className="mt-4 flex gap-4 text-[10px] font-black uppercase">
                    <div className="text-slate-400">Pool: <span className="text-indigo-400">${revSharePool.toLocaleString()}</span></div>
                    <div className="text-slate-400">Top 10 Reward: <span className="text-emerald-400">${(revSharePool / 10).toLocaleString()}</span></div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-black/20 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">Trust Score</th>
                                <th className="px-6 py-4">Fid</th>
                                <th className="px-6 py-4">Sybil Status</th>
                                <th className="px-6 py-4 text-right">Link</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-500 animate-pulse font-mono text-xs">Accessing Supabase API...</td></tr>
                            ) : users.map(user => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    isSybil={user.verified_addresses?.length > 1}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 bg-white/5 flex items-center justify-between border-t border-white/5">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page {page + 1} / {Math.ceil(totalCount / pageSize)}</span>
                    <div className="flex gap-2">
                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 bg-white/5 rounded-lg disabled:opacity-20"><ChevronLeft className="w-4 h-4 text-white" /></button>
                        <button disabled={(page + 1) * pageSize >= totalCount} onClick={() => setPage(p => p + 1)} className="p-1.5 bg-white/5 rounded-lg disabled:opacity-20"><ChevronRight className="w-4 h-4 text-white" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
