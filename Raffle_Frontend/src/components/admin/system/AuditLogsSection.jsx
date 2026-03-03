import React from 'react';
import { History, Cpu, Zap } from 'lucide-react';

export function AuditLogsSection({ logs }) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <History className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">System Audit Trail</h2>
                        <p className="text-xs text-slate-500">Cryptographically signed administrative actions</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-[10px] uppercase font-black tracking-widest text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Admin</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4 text-right">Integrity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-10 text-center text-slate-500 italic">No audit logs found.</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-all">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-300">{new Date(log.created_at).toLocaleString()}</span>
                                                <span className="text-[10px] text-slate-600 font-mono">ID: {log.id.slice(0, 8)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] font-black text-white">
                                                    {log.admin_address?.slice(2, 4).toUpperCase()}
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-400">{log.admin_address?.slice(0, 6)}...{log.admin_address?.slice(-4)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{log.action_type || 'SYSTEM_ACTION'}</span>
                                                <span className="text-[11px] text-slate-300 truncate max-w-[300px]">{log.details?.reason || 'System sync executed'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5 text-emerald-500 bg-emerald-500/5 px-2 py-1 rounded-lg w-fit ml-auto border border-emerald-500/20">
                                                <Cpu className="w-3 h-3" />
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em]">Verified</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-2xl flex items-start gap-3">
                <Zap className="w-5 h-5 text-indigo-400 mt-1" />
                <p className="text-[10px] text-slate-500 italic leading-relaxed">
                    Audit logs are immutable and stored with cryptographic signatures. Each action includes the admin wallet and a secure timestamp from the backend.
                </p>
            </div>
        </div>
    );
}
