import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RefreshCw, Clock, User, ClipboardList, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TaskClaimLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 10;

    const fetchLogs = useCallback(async (isInitial = false) => {
        setLoading(true);
        try {
            const currentPage = isInitial ? 0 : page;
            const rangeStart = currentPage * limit;

            const { data, count, error } = await supabase
                .from('user_task_claims')
                .select(`
                    id,
                    claimed_at,
                    wallet_address,
                    task:daily_tasks(id, title, xp_reward)
                `, { count: 'exact' })
                .order('claimed_at', { ascending: false })
                .range(rangeStart, rangeStart + limit - 1);

            if (error) throw error;

            if (isInitial) {
                setLogs(data || []);
                setPage(1);
            } else {
                setLogs(prev => [...prev, ...(data || [])]);
                setPage(prev => prev + 1);
            }
            setTotalCount(count || 0);
        } catch (e) {
            console.error('[Task Logs] Fetch failure:', e.message);
            toast.error("Gagal sinkron log tugas.");
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchLogs(true);
    }, []);

    const hasMore = logs.length < totalCount;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold text-white uppercase tracking-tighter">Riwayat Klaim Misi</h2>
                </div>
                <button
                    onClick={() => fetchLogs(true)}
                    disabled={loading}
                    className="p-2 hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-white"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-[#0a0a0c] rounded-2xl border border-white/5 overflow-hidden">
                {logs.length === 0 && !loading ? (
                    <div className="p-10 text-center text-slate-700 text-[10px] font-black uppercase tracking-widest">
                        Belum ada riwayat klaim.
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <div key={log.id} className="p-4 bg-[#0d0d0f] flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black text-white uppercase truncate">
                                            {log.task?.title || 'Unknown Task'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex items-center gap-1">
                                                <User className="w-2.5 h-2.5 text-slate-500" />
                                                <span className="text-[9px] font-mono text-slate-500">
                                                    {log.wallet_address.slice(0, 6)}...{log.wallet_address.slice(-4)}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-black text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                                +{log.task?.xp_reward || 0} XP
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <div className="flex items-center gap-1 text-[8px] font-black text-slate-700 uppercase">
                                            <Clock className="w-2.5 h-2.5" />
                                            {new Date(log.claimed_at).toLocaleDateString()} {new Date(log.claimed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <a
                                            href={`https://basescan.org/address/${log.wallet_address}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {hasMore && (
                    <button
                        disabled={loading}
                        onClick={() => fetchLogs()}
                        className="w-full py-4 bg-[#121214] text-[9px] font-black text-slate-700 uppercase tracking-widest hover:text-indigo-500 transition-colors"
                    >
                        {loading ? 'Memuat...' : 'Lihat Lebih Banyak'}
                    </button>
                )}
            </div>
        </div>
    );
}
