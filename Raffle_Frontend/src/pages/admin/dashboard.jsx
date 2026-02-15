import React, { Suspense, lazy } from 'react';
import { ShieldCheck, Database, RefreshCw, LayoutList, Trophy, Zap, Settings, ClipboardList } from 'lucide-react';

import AdminGuard from '../../components/admin/AdminGuard';
import { ErrorBoundary } from '../../components/ErrorBoundary';

/**
 * Performance Strategy:
 * 1. Flat UI: No blurs/translucency in #0a0a0c.
 * 2. GPU Trigger: will-change + translateZ(0).
 * 3. Lazy: Avoid mounting heavy logic during boot.
 */
const UserReputationTable = lazy(() => import('../../components/admin/UserReputationTable'));
const SBTRewardsDashboard = lazy(() => import('../../components/SBTRewardsDashboard').then(module => ({ default: module.SBTRewardsDashboard })));
const TaskManager = lazy(() => import('../../components/admin/TaskManager').then(module => ({ default: module.TaskManager })));
const TaskClaimLogs = lazy(() => import('../../components/admin/TaskClaimLogs'));
const AdminSystemSettings = lazy(() => import('../../components/admin/AdminSystemSettings'));


const AdminDashboard = () => {
    const [activeTab, setActiveTab] = React.useState('reputation'); // 'reputation' | 'sbt' | 'tasks' | 'logs' | 'system'


    return (
        <AdminGuard>
            <div
                className="max-w-xl mx-auto px-4 py-4 min-h-screen bg-[#0a0a0c]"
                style={{
                    willChange: 'transform',
                    transform: 'translateZ(0)',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {/* Flat Header - High Contrast / Zero Blur */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#121214] border border-white/5 rounded-xl">
                            <ShieldCheck className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="leading-tight">
                            <h1 className="text-lg font-black text-white uppercase tracking-tighter italic">
                                Admin <span className="text-indigo-500">Hub</span>
                            </h1>
                            <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">
                                Extreme Mobile Node v3.0
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#121214] px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
                        <Database className="w-3 h-3 text-indigo-600" />
                        <span className="text-[8px] font-black text-white uppercase tracking-tighter">Auth: Active</span>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-[#121214] p-1 rounded-xl border border-white/5 mb-6">
                    <button
                        onClick={() => setActiveTab('reputation')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'reputation'
                            ? 'bg-[#0a0a0c] text-white shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <LayoutList className="w-3.5 h-3.5" />
                        Reputation
                    </button>
                    <button
                        onClick={() => setActiveTab('sbt')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sbt'
                            ? 'bg-[#0a0a0c] text-indigo-400 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Trophy className="w-3.5 h-3.5" />
                        SBT
                    </button>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'tasks'
                            ? 'bg-[#0a0a0c] text-yellow-500 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Tasks
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'logs'
                            ? 'bg-[#0a0a0c] text-blue-400 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Logs
                    </button>

                    <button
                        onClick={() => setActiveTab('system')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'system'
                            ? 'bg-[#0a0a0c] text-emerald-500 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        System
                    </button>
                </div>

                {/* Suspense Boundary with Minimalist Placeholder */}
                <Suspense fallback={
                    <div className="py-20 flex flex-col items-center gap-4">
                        <RefreshCw className="w-6 h-6 text-slate-800 animate-spin" />
                        <p className="text-[8px] font-black text-slate-800 uppercase tracking-widest">Loading Module...</p>
                    </div>
                }>
                    <ErrorBoundary>
                        {activeTab === 'reputation' ? (
                            <UserReputationTable />
                        ) : activeTab === 'sbt' ? (
                            <SBTRewardsDashboard />
                        ) : activeTab === 'tasks' ? (
                            <TaskManager />
                        ) : activeTab === 'logs' ? (
                            <TaskClaimLogs />
                        ) : (
                            <AdminSystemSettings />
                        )}

                    </ErrorBoundary>
                </Suspense>

                {/* Flat Disclosure */}
                <div className="mt-8 pt-6 border-t border-white/5">
                    <div className="flex items-start gap-4 opacity-30">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1 flex-shrink-0" />
                        <p className="text-[8px] text-white leading-relaxed font-black uppercase tracking-tighter">
                            Restricted Protocol: 0x0845...204B. All telemetry data is confidential.
                            Built for high-efficiency mobile WebViews.
                        </p>
                    </div>
                </div>
            </div>
        </AdminGuard>
    );
};

export default AdminDashboard;
