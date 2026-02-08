import React from 'react';
import UserReputationTable from '../components/admin/UserReputationTable';
import { Database, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * AdminReputationPage: High-level dashboard for Lead Admin & Security Architect.
 */
export function AdminReputationPage() {
    const navigate = useNavigate();

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-8">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/admin-sbt')}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-400" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-500/20 rounded-3xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                            <ShieldCheck className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Reputation <span className="text-indigo-500">Dashboard</span></h1>
                            <p className="text-slate-400 text-xs font-bold font-mono">Lead Admin Architecture v2.4 (Security Enabled)</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">System Health: Optimal</span>
                </div>
            </div>

            {/* Main Table Segment */}
            <UserReputationTable />

            {/* Footer Disclaimer */}
            <div className="flex items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-3xl">
                <Database className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-black uppercase tracking-wide">
                    Internal Trust Score is calculated via OpenRank + Farcaster Follower Weight + Power Badge multiplier.
                    Sybil Alert is triggered by multiple verified addresses per Farcaster ID.
                    No PII or Sensitive Keys are exposed in this view.
                </p>
            </div>
        </div>
    );
}
