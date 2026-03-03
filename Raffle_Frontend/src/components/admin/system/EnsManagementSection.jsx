import React from 'react';
import { UserCheck, CheckCircle, Search, RefreshCw, Trash2, Globe } from 'lucide-react';

export function EnsManagementSection({ eligibleUsers, issuedSubnames, onIssue, saving }) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><UserCheck className="w-5 h-5 text-indigo-400" /> Eligible Candidates</h2>
                <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-4 max-h-[500px] overflow-y-auto space-y-3 custom-scrollbar">
                    {eligibleUsers.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-10">No eligible candidates found.</p>
                    ) : (
                        eligibleUsers.map((user) => (
                            <div key={user.fid} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex flex-col gap-3 group hover:border-indigo-500/30 transition-all">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-indigo-400 py-1 px-2 bg-indigo-500/10 rounded-lg">FID: {user.fid}</span>
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-black uppercase tracking-tighter">XP: {user.total_xp?.toString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        id={`label-${user.fid}`}
                                        type="text"
                                        placeholder="label"
                                        className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none font-bold"
                                    />
                                    <span className="text-slate-500 text-xs font-black">.cryptodiscovery.eth</span>
                                </div>
                                <button
                                    onClick={() => onIssue(user, document.getElementById(`label-${user.fid}`).value)}
                                    disabled={saving}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" /> Issue Subname Identity
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-400" /> Issued Identities</h2>
                <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-[10px] uppercase font-black tracking-widest text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Label</th>
                                    <th className="px-4 py-3">Wallet</th>
                                    <th className="px-4 py-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {issuedSubnames.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/[0.02]">
                                        <td className="px-4 py-4">
                                            <p className="text-xs font-bold text-white">{item.full_name}</p>
                                            <p className="text-[9px] text-slate-500 font-mono">FID: {item.fid}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="text-[10px] text-slate-400 font-mono">{item.wallet_address?.slice(0, 6)}...{item.wallet_address?.slice(-4)}</p>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center justify-end gap-1">
                                                <CheckCircle className="w-3 h-3" /> Live
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
