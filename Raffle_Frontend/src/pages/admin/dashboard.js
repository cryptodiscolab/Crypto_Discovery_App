import React from 'react';
import UserReputationTable from '../../components/admin/UserReputationTable';
import { LayoutDashboard, ShieldCheck, RefreshCw } from 'lucide-react';

/**
 * Admin Dashboard: Central monitoring for Crypto Disco App.
 * Optimized for low-spec hardware.
 */
export default function AdminDashboard() {
    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                        <ShieldCheck className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Admin <span className="text-indigo-500">Reputation</span></h1>
                        <p className="text-slate-500 text-[10px] font-mono">Architecture: Principal Level (IDX Optimized)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <RefreshCw className="w-3 h-3 text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Real-time Node: Active</span>
                </div>
            </div>

            <UserReputationTable />

            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <p className="text-[9px] text-slate-600 leading-relaxed uppercase font-bold tracking-wide">
                    Confidential: Internal trust score data is derived from OpenRank verifications.
                    Any data leakage is a security violation.
                </p>
            </div>
        </div>
    );
}
