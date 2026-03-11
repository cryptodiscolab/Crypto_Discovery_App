import React from 'react';
import { Zap } from 'lucide-react';
import { usePoints } from '../../../shared/context/PointsContext';

export function SyncLogTab() {
    const { syncLogs, clearLogs } = usePoints();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h3 className="text-xl font-bold text-white">Synchronization Monitoring</h3>
                    <p className="text-xs text-slate-500">Real-time comparison between Visual (Optimistic) and Database (Real) XP.</p>
                </div>
                <button
                    onClick={clearLogs}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold rounded-lg transition-all"
                >
                    Clear History
                </button>
            </div>

            <div className="glass-card overflow-hidden border border-white/10 rounded-2xl bg-slate-900/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">DB XP</th>
                                <th className="px-6 py-4">Visual XP</th>
                                <th className="px-6 py-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {syncLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-700 text-[10px] font-black uppercase tracking-widest">
                                        No activity recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                syncLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-white font-mono font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                <span className="text-[8px] text-slate-600 font-black uppercase">{new Date(log.timestamp).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${log.type === 'refetch' ? 'bg-blue-500/10 text-blue-400' : log.type === 'manual_optimistic' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {log.type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-xs text-slate-400">
                                            <div className="flex flex-col">
                                                <span>{log.dbXp} XP</span>
                                                {log.prevVisualXp !== null && log.prevVisualXp !== log.dbXp && (
                                                    <span className="text-[8px] text-amber-500 italic">Was: {log.prevVisualXp}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-xs text-white">
                                            {log.visualXp} XP
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {Math.abs(log.diff) === 0 ? (
                                                <div className="flex items-center justify-end gap-1.5 text-emerald-500">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Balanced</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1.5 text-amber-500">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Diff ({log.diff > 0 ? '+' : ''}{log.diff})</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Zap size={14} /> System Insight
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed text-left">
                    <strong>Manual Optimistic</strong> logs represent points added instantly to the UI before database confirmation.
                    &lt;strong&gt;Refetch&lt;/strong&gt; logs indicate when the system has successfully pulled the &quot;Source of Truth&quot; back from Supabase.
                    A healthy cycle shows an <em>Optimistic</em> log followed by a <em>Balanced Refetch</em> within seconds.
                </p>
            </div>
        </div>
    );
}
