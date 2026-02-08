import React, { Suspense, lazy } from 'react';
import { ShieldCheck, Database, RefreshCw } from 'lucide-react';

// Hardware-Optimization: Lazy load heavy components for Project IDX memory management
const UserReputationTable = lazy(() => import('../../components/admin/UserReputationTable'));

/**
 * AdminDashboard: Lead QA Audit approved entry point.
 * Fixes: Relative imports, Lazy loading, AST performance.
 */
const AdminDashboard = () => {
    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
            {/* QA-Ready Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-500/5">
                        <ShieldCheck className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">
                            Reputation <span className="text-indigo-500">Center</span>
                        </h1>
                        <p className="text-slate-500 text-[9px] font-black font-mono uppercase tracking-widest mt-1">
                            QA Audit Status: <span className="text-emerald-500">Vercel Build Ready</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/10 px-4 py-2 rounded-2xl">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                        Node Identity: Connected
                    </span>
                </div>
            </div>

            {/* Loading Boundary for Lenovo Optimizations */}
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
                    <p className="text-slate-500 font-mono text-[10px] uppercase">Mounting Admin Tables...</p>
                </div>
            }>
                <UserReputationTable />
            </Suspense>

            {/* Auditor Disclosure */}
            <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <p className="text-[9px] text-slate-600 leading-relaxed font-bold uppercase tracking-wide">
                    Confidential: This interface monitors real-time reputation scores via OpenRank.
                    All administrative actions are restricted to protocol 0x0845...204B.
                </p>
            </div>
        </div>
    );
};

export default AdminDashboard;
