import React, { Suspense, lazy } from 'react';
import { ShieldCheck, Database, RefreshCw, LayoutList, Trophy, Zap, Settings, ClipboardList, Landmark, Edit3, Newspaper } from 'lucide-react';


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
const AdminCMSContent = lazy(() => import('../../components/admin/AdminCMSContent'));
const WhitelistManagerTab = lazy(() => import('../../components/admin/WhitelistManagerTab').then(m => ({ default: m.WhitelistManagerTab })));
const RaffleManagerTab = lazy(() => import('../../components/admin/RaffleManagerTab').then(m => ({ default: m.RaffleManagerTab })));

// Unified Legacy Components (to be moved/merged properly later)
import { AdminPage } from '../AdminPage'; // Using internal tab sub-components if exported
// Note: For now, we will wrap the legacy components if they are not exported as standalone


const AdminDashboard = () => {
    const [activeTab, setActiveTab] = React.useState('reputation'); // 'reputation' | 'sbt' | 'tasks' | 'logs' | 'system' | 'pool' | 'raffles' | 'announcement' | 'news'



    return (
        <AdminGuard>
            <div
                className="w-full px-4 py-4 min-h-screen bg-[#0a0a0c]"
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

                {/* Tab Navigation - Scrollable on Mobile */}
                <div className="flex overflow-x-auto scrollbar-hide bg-[#121214] p-1 rounded-xl border border-white/5 mb-6 gap-1 no-scrollbar">
                    <button
                        onClick={() => setActiveTab('reputation')}
                        className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'reputation'
                            ? 'bg-[#0a0a0c] text-white shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <LayoutList className="w-3.5 h-3.5" />
                        Reputation
                    </button>
                    <button
                        onClick={() => setActiveTab('sbt')}
                        className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sbt'
                            ? 'bg-[#0a0a0c] text-indigo-400 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Trophy className="w-3.5 h-3.5" />
                        SBT
                    </button>
                    <button
                        onClick={() => setActiveTab('pool')}
                        className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pool'
                            ? 'bg-[#0a0a0c] text-indigo-400 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Landmark className="w-3.5 h-3.5" />
                        Pool
                    </button>
                    <button
                        onClick={() => setActiveTab('raffles')}
                        className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'raffles'
                            ? 'bg-[#0a0a0c] text-blue-400 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Trophy className="w-3.5 h-3.5" />
                        Raffles
                    </button>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'tasks'
                            ? 'bg-[#0a0a0c] text-yellow-500 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Tasks
                    </button>
                    <button
                        onClick={() => setActiveTab('announcement')}
                        className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'announcement'
                            ? 'bg-[#0a0a0c] text-blue-500 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        Announce
                    </button>
                    <button
                        onClick={() => setActiveTab('news')}
                        className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'news'
                            ? 'bg-[#0a0a0c] text-green-500 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Newspaper className="w-3.5 h-3.5" />
                        News
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'system'
                            ? 'bg-[#0a0a0c] text-red-500 shadow-lg border border-white/5'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Control
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
                        ) : activeTab === 'cms' ? (
                            <AdminCMSContent />
                        ) : activeTab === 'raffles' ? (
                            <RaffleManagerTab />
                        ) : activeTab === 'pool' ? (
                            <WhitelistManagerTab />
                        ) : activeTab === 'system' ? (
                            <AdminSystemSettings />
                        ) : activeTab === 'announcement' || activeTab === 'news' ? (
                            <AdminCMSContent />
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
