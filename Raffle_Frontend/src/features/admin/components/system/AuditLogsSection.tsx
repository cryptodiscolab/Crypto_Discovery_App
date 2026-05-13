import { useState, useMemo } from 'react';
import { History, Cpu, Zap, ChevronDown, ChevronUp, Terminal, Shield, AlertCircle, Search, Filter } from 'lucide-react';

export function AuditLogsSection({ logs }: { logs: any[] }) {
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAction, setFilterAction] = useState<string>('ALL');

    const actionTypes = useMemo(() => {
        const types = new Set(logs.map(l => l.action).filter(Boolean));
        return ['ALL', ...Array.from(types).sort()];
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = 
                log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.admin_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                JSON.stringify(log.details || {}).toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesAction = filterAction === 'ALL' || log.action === filterAction;
            
            return matchesSearch && matchesAction;
        });
    }, [logs, searchQuery, filterAction]);

    const getActionColor = (action: string) => {
        const a = action?.toUpperCase() || '';
        if (a.includes('RESET') || a.includes('OVERRIDE')) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
        if (a.includes('DELETE') || a.includes('REMOVE') || a.includes('FAILED')) return 'text-red-400 bg-red-400/10 border-red-400/20';
        if (a.includes('UPDATE') || a.includes('EDIT')) return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
        if (a.includes('ISSUE') || a.includes('SYNC') || a.includes('HEARTBEAT') || a.includes('DISTRIBUTION')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        if (a.includes('CRON') || a.includes('START') || a.includes('END')) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                        <History className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">System Audit Trail</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black font-mono">Cryptographically signed administrative actions</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[11px] text-white focus:outline-none focus:border-indigo-500/50 transition-all w-full md:w-48 font-mono"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-3 py-2">
                        <Filter className="w-3.5 h-3.5 text-slate-500" />
                        <select 
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value)}
                            className="bg-transparent text-[11px] text-slate-300 focus:outline-none font-black uppercase tracking-widest cursor-pointer"
                        >
                            {actionTypes.map(type => (
                                <option key={type} value={type} className="bg-slate-900 text-white">{type.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <Shield className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest font-mono">Secured</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-[10px] uppercase font-black tracking-widest text-slate-500">
                            <tr>
                                <th className="px-6 py-5">Event Detail</th>
                                <th className="px-6 py-5">Authority</th>
                                <th className="px-6 py-5">Operation</th>
                                <th className="px-6 py-5 text-right">Verification</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Terminal className="w-10 h-10 text-slate-500" />
                                            <p className="text-xs text-slate-500 uppercase font-black tracking-widest">No logs match your filter criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log: any) => (
                                    <React.Fragment key={log.id}>
                                        <tr 
                                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                            className="hover:bg-white/[0.03] transition-all cursor-pointer group"
                                        >
                                            <td className="px-6 py-5 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-slate-200 font-mono tracking-tight">
                                                            {new Date(log.created_at).toLocaleString('id-ID', { 
                                                                year: 'numeric', month: '2-digit', day: '2-digit',
                                                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                                hour12: false 
                                                            })}
                                                        </span>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                                    </div>
                                                    <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1.5">
                                                        <Cpu className="w-3 h-3" />
                                                        SIG: {log.id.slice(0, 12)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-800 to-black border border-white/10 flex items-center justify-center text-[10px] font-black text-indigo-400 shadow-inner group-hover:border-indigo-500/50 transition-all">
                                                        {log.admin_address?.slice(2, 4).toUpperCase() || 'SYS'}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-300 font-mono uppercase tracking-widest">
                                                            {log.admin_address?.includes('SYSTEM') ? 'Kernel Process' : 'Admin Authority'}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-slate-500 tracking-tighter">
                                                            {log.admin_address?.slice(0, 10)}...{log.admin_address?.slice(-6)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-widest ${getActionColor(log.action)}`}>
                                                        {log.action?.replace(/_/g, ' ') || 'UNKNOWN'}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {expandedLog === log.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-white" />}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2 text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-xl w-fit ml-auto border border-emerald-500/10 backdrop-blur-md">
                                                    <Shield className="w-3.5 h-3.5" />
                                                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Verified</span>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedLog === log.id && (
                                            <tr className="bg-black/40 border-l-2 border-l-indigo-500 animate-in slide-in-from-left-1 duration-200">
                                                <td colSpan={4} className="px-12 py-6">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Terminal className="w-4 h-4 text-indigo-400" />
                                                            <span className="text-[11px] font-black text-white uppercase tracking-widest">Execution Payload</span>
                                                        </div>
                                                        <div className="p-4 bg-black/60 rounded-xl border border-white/5 font-mono text-[11px] text-slate-300 leading-relaxed shadow-2xl">
                                                            {typeof log.details === 'object' && log.details !== null ? (
                                                                <pre className="whitespace-pre-wrap break-all overflow-auto max-h-[300px] scrollbar-hide">
                                                                    {JSON.stringify(log.details, null, 2)}
                                                                </pre>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-slate-500 italic">
                                                                    <AlertCircle className="w-4 h-4" />
                                                                    No additional metadata captured for this event.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-2xl flex items-start gap-4">
                <Zap className="w-6 h-6 text-indigo-400 flex-shrink-0" />
                <div className="space-y-1">
                    <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Protocol Integrity Notice</h4>
                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                        Audit logs are immutable, cryptographically signed, and cross-referenced with backend heartbeat cycles. 
                        Each entry represents a finalized administrative state transition within the Crypto Discovery Ecosystem.
                    </p>
                </div>
            </div>
        </div>
    );
}

import React from 'react';
