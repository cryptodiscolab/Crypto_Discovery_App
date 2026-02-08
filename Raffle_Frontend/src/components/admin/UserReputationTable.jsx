import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
    Users,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Calculator,
    TrendingUp,
    ShieldCheck,
    Search,
    RefreshCw,
    ExternalLink,
    DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * UserReputationTable: Lead Admin Dashboard for Reputation & Sybil Detection.
 * Optimized for Project IDX (low-spec hardware) via pagination and pure CSS bars.
 */
export default function UserReputationTable() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize] = useState(15);

    // Revenue Calculator State
    const [totalRevenue, setTotalRevenue] = useState(1000);
    const [topXUsers, setTopXUsers] = useState(10);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const start = page * pageSize;
            const end = start + pageSize - 1;

            const { data, count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact' })
                .order('internal_trust_score', { ascending: false })
                .range(start, end);

            if (error) throw error;

            setUsers(data || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Error fetching reputation data:', error);
            toast.error('Failed to load reputation data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [page]);

    // Simple Revenue Share Calculator Logic (30% share)
    const revShareData = useMemo(() => {
        const sharePool = totalRevenue * 0.3;
        const rewardPerUser = topXUsers > 0 ? sharePool / topXUsers : 0;
        return {
            sharePool,
            rewardPerUser
        };
    }, [totalRevenue, topXUsers]);

    const isSybil = (user) => {
        // Sybil Detection: Multiple verified addresses in one FID
        return Array.isArray(user.verified_addresses) && user.verified_addresses.length > 1;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-slate-400 text-xs font-black uppercase tracking-wider">Total Users</h3>
                    </div>
                    <p className="text-3xl font-black text-white">{totalCount.toLocaleString()}</p>
                </div>

                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-slate-400 text-xs font-black uppercase tracking-wider">Avg Trust Score</h3>
                    </div>
                    <p className="text-3xl font-black text-white">
                        {users.length > 0 ? (users.reduce((acc, u) => acc + (u.internal_trust_score || 0), 0) / users.length).toFixed(1) : '0'}
                    </p>
                </div>

                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm border-red-500/20">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <h3 className="text-slate-400 text-xs font-black uppercase tracking-wider">Potential Sybils</h3>
                    </div>
                    <p className="text-3xl font-black text-white">
                        {users.filter(isSybil).length} <span className="text-xs text-slate-500 font-medium">on this page</span>
                    </p>
                </div>
            </div>

            {/* Revenue share Calculator */}
            <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-3xl shadow-xl">
                <div className="flex items-center gap-2 mb-6 text-indigo-400">
                    <Calculator className="w-6 h-6" />
                    <h2 className="text-xl font-black uppercase tracking-tighter">Revenue Share Calculator (30%)</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Total Project Revenue ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="number"
                                    value={totalRevenue}
                                    onChange={(e) => setTotalRevenue(Number(e.target.value))}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-white font-bold outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Target Top Users (X)</label>
                            <input
                                type="number"
                                value={topXUsers}
                                onChange={(e) => setTopXUsers(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-white font-bold outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="bg-black/40 p-6 rounded-2xl border border-white/5 flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-slate-400 text-xs font-bold uppercase">Share Pool (30%)</span>
                            <span className="text-indigo-400 font-black text-lg">${revShareData.sharePool.toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-white/5 w-full mb-4"></div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs font-bold uppercase">Reward Per Top User</span>
                            <span className="text-emerald-400 font-black text-2xl">${revShareData.rewardPerUser.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reputation Table */}
            <div className="bg-black/20 border border-white/5 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Fid / Profile</th>
                                <th className="px-6 py-4">Internal Trust Score</th>
                                <th className="px-6 py-4">Verified Addrs</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-8 h-16 bg-white/[0.01]"></td>
                                    </tr>
                                ))
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-mono italic">No reputation data found.</td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr
                                        key={user.id}
                                        className={`group hover:bg-white/[0.02] transition-colors ${isSybil(user) ? 'bg-red-500/5' : ''}`}
                                    >
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30 overflow-hidden">
                                                    {user.pfp_url ? (
                                                        <img src={user.pfp_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-indigo-400 font-bold text-xs">FID</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-black text-white text-sm">@{user.username || 'unknown'}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono">FID: {user.fid}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col gap-2 w-full max-w-[120px]">
                                                <div className="flex justify-between items-center text-[10px] font-black">
                                                    <span className="text-indigo-400">{user.internal_trust_score || 0}</span>
                                                    <span className="text-slate-600">/ 100</span>
                                                </div>
                                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                                                        style={{ width: `${Math.min(user.internal_trust_score || 0, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${isSybil(user) ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-400'}`}>
                                                    {user.verified_addresses?.length || 0} WALLETS
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 font-bold">
                                            {isSybil(user) ? (
                                                <div className="flex items-center gap-1.5 text-red-500 text-[10px] animate-pulse">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    SYBIL ALERT
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-emerald-500 text-[10px]">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    VERIFIED
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <a
                                                href={`https://warpcast.com/${user.username}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 bg-white/5 border border-white/10 rounded-xl inline-flex hover:bg-white/10 transition-all"
                                            >
                                                <ExternalLink className="w-4 h-4 text-slate-400" />
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Showing {users.length > 0 ? (page * pageSize) + 1 : 0} to {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} users
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0 || loading}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft className="w-4 h-4 text-white" />
                        </button>
                        <button
                            disabled={(page + 1) * pageSize >= totalCount || loading}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 disabled:opacity-30 transition-all"
                        >
                            <ChevronRight className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <button
                    onClick={fetchUsers}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-400 text-xs font-black uppercase transition-all"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Core Database
                </button>
            </div>
        </div>
    );
}
