import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Award, Landmark, Settings, Users, Database,
    CheckCircle, AlertTriangle, ExternalLink, RefreshCw,
    Edit3, Save, Eye, EyeOff, UserCog, Newspaper,
    Trophy, Zap, Timer as TimerIcon, LayoutList, ClipboardList, Sliders, Megaphone
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useSBT } from '../hooks/useSBT';
import { useCMS } from '../hooks/useCMS';
import toast from 'react-hot-toast';
import { cleanWallet } from '../utils/cleanWallet';

// Lazy Load Admin Tabs
const RoleManagementTab = React.lazy(() => import('../components/admin/RoleManagementTab').then(m => ({ default: m.RoleManagementTab })));
const WhitelistManagerTab = React.lazy(() => import('../components/admin/WhitelistManagerTab').then(m => ({ default: m.WhitelistManagerTab })));
const RaffleManagerTab = React.lazy(() => import('../components/admin/RaffleManagerTab').then(m => ({ default: m.RaffleManagerTab })));
const TaskManagerTab = React.lazy(() => import('../components/admin/TaskManagerTab').then(m => ({ default: m.TaskManagerTab })));
const UserReputationTable = React.lazy(() => import('../components/admin/UserReputationTable'));
const TaskClaimLogs = React.lazy(() => import('../components/admin/TaskClaimLogs'));
const SBTRewardsDashboard = React.lazy(() => import('../components/SBTRewardsDashboard').then(module => ({ default: module.SBTRewardsDashboard })));
const AdminSystemSettings = React.lazy(() => import('../components/admin/AdminSystemSettings'));
const AdminCMSContent = React.lazy(() => import('../components/admin/AdminCMSContent'));
const TaskManager = React.lazy(() => import('../components/admin/TaskManager').then(m => ({ default: m.TaskManager })));
const AdminCampaignTab = React.lazy(() => import('../components/admin/AdminCampaignTab'));

// Newly Extracted Tabs
const AnnouncementTab = React.lazy(() => import('../components/admin/tabs/AnnouncementTab').then(m => ({ default: m.AnnouncementTab })));
const NewsTab = React.lazy(() => import('../components/admin/tabs/NewsTab').then(m => ({ default: m.NewsTab })));
const PoolTab = React.lazy(() => import('../components/admin/tabs/PoolTab').then(m => ({ default: m.PoolTab })));
const SystemSettingsTab = React.lazy(() => import('../components/admin/tabs/SystemSettingsTab').then(m => ({ default: m.SystemSettingsTab })));
const ContentTab = React.lazy(() => import('../components/admin/tabs/ContentTab').then(m => ({ default: m.ContentTab })));
const SyncLogTab = React.lazy(() => import('../components/admin/tabs/SyncLogTab').then(m => ({ default: m.SyncLogTab })));
const TierTab = React.lazy(() => import('../components/admin/tabs/TierTab').then(m => ({ default: m.TierTab })));
const TreasuryTab = React.lazy(() => import('../components/admin/tabs/TreasuryTab').then(m => ({ default: m.TreasuryTab })));

export function AdminPage({ initialTab = 'pool' }) {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { totalPoolBalance, contractOwner, distributeRevenue, updateTier, withdrawTreasury, refetchAll } = useSBT();
    const {
        isAdmin: isCMSAdmin,
        isOperator,
        canEdit: canEditCMS,
        isLoading: loadingCMS,
        poolSettings,
        ethPrice,
        updatePoolSettings
    } = useCMS();

    const [activeTab, setActiveTab] = useState(initialTab);
    const [taskSubTab, setTaskSubTab] = useState('batch');
    const [hasManagerAccess, setHasManagerAccess] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        const checkAccess = async () => {
            if (!isConnected) {
                setLoading(false);
                return;
            }

            try {
                const fids = import.meta.env.VITE_ADMIN_FIDS || '';
                const wallets = import.meta.env.VITE_ADMIN_WALLETS || '';
                const fallback = import.meta.env.VITE_ADMIN_ADDRESS || '';

                const adminFids = fids.split(',').map(f => f.trim()).filter(f => f !== '').map(f => parseInt(f)).filter(f => !isNaN(f));
                const adminWallets = `${wallets},${fallback}`.split(',').map(w => cleanWallet(w)).filter(w => w !== null);

                let userFid = null;
                const currentWallet = cleanWallet(address);
                const isSBTAccountOwner = contractOwner && currentWallet && currentWallet === cleanWallet(contractOwner);
                const isEnvAdmin = currentWallet && adminWallets.includes(currentWallet);
                const isFidAdmin = userFid && adminFids.includes(userFid);

                const finalAccess = isSBTAccountOwner || isCMSAdmin || isOperator || isEnvAdmin || isFidAdmin || canEditCMS;

                if (address) {
                    setHasManagerAccess(finalAccess);
                    if (finalAccess || !loadingCMS) {
                        setLoading(false);
                        if (!finalAccess && !loadingCMS) {
                            toast.error("Unauthorized: Redirecting...");
                            setTimeout(() => navigate('/'), 3000);
                        }
                    }
                }
            } catch (error) {
                console.error('[Security] Error checking auth:', error);
                setLoading(false);
            }
        };

        checkAccess();
    }, [address, contractOwner, isConnected, isCMSAdmin, isOperator, canEditCMS, navigate, loadingCMS]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Shield className="w-12 h-12 text-indigo-500 animate-pulse" />
            </div>
        );
    }

    if (!hasManagerAccess) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-slate-400">Restricted to administrators only.</p>
                <button onClick={() => navigate('/')} className="mt-6 text-blue-400 hover:underline">Return Home</button>
            </div>
        );
    }

    const tabs = [
        { id: 'reputation', label: 'Reputation', icon: LayoutList, color: 'indigo' },
        { id: 'sbt', label: 'SBT Rewards', icon: Award, color: 'indigo' },
        { id: 'pool', label: 'SBT Master', icon: Database, color: 'indigo' },
        { id: 'system', label: 'System Settings', icon: Sliders, color: 'blue' },
        { id: 'masterx', label: 'MasterX Controls', icon: Settings, color: 'blue' },
        { id: 'raffles', label: 'Raffles On-Chain', icon: Trophy, color: 'blue' },
        { id: 'tasks', label: 'Task Master', icon: Zap, color: 'purple' },
        { id: 'logs', label: 'Activity Logs', icon: ClipboardList, color: 'slate' },
        { id: 'tiers', label: 'Tier Control', icon: Award, color: 'yellow' },
        { id: 'treasury', label: 'Treasury Safe', icon: Landmark, color: 'emerald' },
        { id: 'roles', label: 'Role Management', icon: UserCog, color: 'yellow' },
        { id: 'whitelist', label: 'Sponsored Access', icon: Shield, color: 'purple' },
        { id: 'announcement', label: 'Announcement', icon: Edit3, color: 'blue' },
        { id: 'campaigns', label: 'Campaigns', icon: Megaphone, color: 'indigo' },
        { id: 'news', label: 'News & Updates', icon: Newspaper, color: 'green' },
        { id: 'content', label: 'Feature Cards (CMS)', icon: Database, color: 'indigo' },
        { id: 'sync-logs', label: 'Sync Logs (Debug)', icon: ClipboardList, color: 'emerald' },
    ];

    return (
        <div className="z-[9999] pointer-events-auto relative min-h-screen bg-[#050505] flex flex-col md:flex-row">
            <aside className="w-full md:w-64 bg-slate-900/40 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-white/5 flex-shrink-0 z-[100]">
                <div className="p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-3 mb-10 px-2">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                            <Shield className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-black text-white tracking-tight">Admin Hub</h2>
                            <p className="text-[10px] text-indigo-500/70 font-bold uppercase tracking-widest">Protocol V2.1</p>
                        </div>
                    </div>

                    <nav className="flex-1 space-y-1">
                        <p className="px-3 mb-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-left">Management</p>
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all group ${isActive
                                        ? 'bg-indigo-600 text-white shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)]'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'group-hover:text-indigo-400'}`} />
                                    <span className="text-sm tracking-tight">{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="mt-10 pt-6 border-t border-white/5 space-y-3">
                        <div className="px-3 py-4 bg-white/5 rounded-2xl border border-white/5 mb-4 text-left">
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Signed As</p>
                            <p className="text-xs font-mono text-indigo-400 truncate">
                                {address?.slice(0, 12)}...{address?.slice(-8)}
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-950/50 hover:bg-slate-900 border border-white/5 rounded-xl text-xs font-bold text-slate-400 transition-all"
                        >
                            <ExternalLink className="w-3 h-3" /> Exit to Homepage
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 min-w-0 h-screen overflow-y-auto custom-scrollbar flex flex-col relative z-10">
                <header className="sticky top-0 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between z-50">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-white capitalize">
                            {tabs.find(t => t.id === activeTab)?.label || activeTab.replace('-', ' ')}
                        </h2>
                        <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live System</span>
                        </div>
                    </div>

                    <button
                        onClick={() => refetchAll()}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all text-xs font-bold"
                    >
                        <RefreshCw className="w-3 h-3" /> Sync Protocol
                    </button>
                </header>

                <div className="p-4 md:p-8 lg:p-12 w-full flex-1">
                    <React.Suspense fallback={
                        <div className="h-[60vh] flex flex-col items-center justify-center animate-pulse">
                            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4 opacity-50" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Initialising Module...</p>
                        </div>
                    }>
                        <div key={activeTab} className="animate-fade-in pb-20">
                            {activeTab === 'reputation' && <UserReputationTable />}
                            {activeTab === 'sbt' && <SBTRewardsDashboard />}
                            {activeTab === 'pool' && (
                                <PoolTab
                                    balance={totalPoolBalance}
                                    onDistribute={distributeRevenue}
                                    ethPrice={ethPrice}
                                    settings={poolSettings}
                                    onUpdateSettings={updatePoolSettings}
                                />
                            )}
                            {activeTab === 'system' && <AdminSystemSettings />}
                            {activeTab === 'masterx' && <SystemSettingsTab />}
                            {activeTab === 'raffles' && <RaffleManagerTab />}
                            {activeTab === 'tasks' && (
                                <div className="space-y-6">
                                    <div className="flex gap-4 border-b border-white/5 pb-4 mb-8">
                                        <button
                                            onClick={() => setTaskSubTab('batch')}
                                            className={`text-xs font-black uppercase tracking-widest pb-2 transition-all ${taskSubTab === 'batch' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500'}`}
                                        >
                                            Smart Batch Creator
                                        </button>
                                        <button
                                            onClick={() => setTaskSubTab('quick')}
                                            className={`text-xs font-black uppercase tracking-widest pb-2 transition-all ${taskSubTab === 'quick' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500'}`}
                                        >
                                            Quick Task Manager
                                        </button>
                                    </div>
                                    {taskSubTab === 'batch' ? <TaskManagerTab /> : <TaskManager />}
                                </div>
                            )}
                            {activeTab === 'logs' && <TaskClaimLogs />}
                            {activeTab === 'tiers' && <TierTab onUpdate={updateTier} />}
                            {activeTab === 'treasury' && <TreasuryTab onWithdraw={withdrawTreasury} />}
                            {activeTab === 'roles' && <RoleManagementTab />}
                            {activeTab === 'whitelist' && <WhitelistManagerTab />}
                            {activeTab === 'announcement' && <AnnouncementTab />}
                            {activeTab === 'campaigns' && <AdminCampaignTab />}
                            {activeTab === 'news' && <NewsTab />}
                            {activeTab === 'content' && <AdminCMSContent />}
                            {activeTab === 'sync-logs' && <SyncLogTab />}
                        </div>
                    </React.Suspense>
                </div>
            </main>
        </div>
    );
}
