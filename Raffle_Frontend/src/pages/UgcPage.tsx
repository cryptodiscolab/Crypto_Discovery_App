import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { CreateRafflePage } from './CreateRafflePage';
import { CreateMissionPage } from './CreateMissionPage';
import {
    TrendingUp, BarChart3,
    CheckCircle2, DollarSign, Sparkles,
    Shield, HelpCircle
} from 'lucide-react';

interface CampaignItem {
    id: string;
    title: string;
    category: string;
    budget: string;
    participants: string;
    status: 'Active' | 'Completed' | 'Pending';
    yield: string;
    type: 'Raffle' | 'Mission';
}

export function UgcPage() {
    const { isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'raffle' | 'mission'>('dashboard');

    const campaigns = useMemo<CampaignItem[]>(() => [
        {
            id: 'c1',
            title: 'Base Ecosystem NFT Gacha Drop',
            category: 'NFT',
            budget: '0.50 ETH',
            participants: '152 / 200',
            status: 'Active',
            yield: '+12.4% APY',
            type: 'Raffle'
        },
        {
            id: 'c2',
            title: 'DeFi Yield Protocol Social Quest',
            category: 'DeFi',
            budget: '250.00 USDC',
            participants: '500 / 500',
            status: 'Completed',
            yield: '+18.2% APY',
            type: 'Mission'
        },
        {
            id: 'c3',
            title: 'Midnight Cyber Community Raffle',
            category: 'Gaming',
            budget: '0.20 ETH',
            participants: '0 / 100',
            status: 'Pending',
            yield: '--',
            type: 'Raffle'
        }
    ], []);

    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-[#050505] selection:bg-indigo-500/30">
                <div className="text-center glass-card p-12 max-w-md w-full border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Shield className="w-20 h-20 text-indigo-500 mx-auto mb-6 opacity-40 animate-pulse" />
                    <h2 className="text-[12px] font-black text-white uppercase tracking-[0.3em] mb-3">IDENTITY REQUIRED</h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        AUTHENTICATE YOUR WALLET TO ACCESS SPONSORSHIP PORTAL.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[100vw] overflow-x-hidden pb-safe md:pb-8 pt-24 min-h-screen bg-[#050505] relative selection:bg-indigo-500/30">
            <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/3 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-screen-xl mx-auto px-4 relative z-10">
                {/* Top Section */}
                <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="badge-cyber badge-cyber-blue">UGC CORE</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">SPONSOR ENGINE v3.60</span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter leading-none">
                            SPONSORSHIP <span className="text-indigo-500">PORTAL</span>
                        </h1>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">
                            DEPLOY ON-CHAIN CAMPAIGNS, TRACK ANALYTICS, AND DEPOSIT REWARD POOLS.
                        </p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 w-full lg:w-auto overflow-x-auto whitespace-nowrap">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === 'dashboard'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            DASHBOARD
                        </button>
                        <button
                            onClick={() => setActiveTab('raffle')}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === 'raffle'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            SPONSOR RAFFLE
                        </button>
                        <button
                            onClick={() => setActiveTab('mission')}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === 'mission'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            LAUNCH MISSION
                        </button>
                    </div>
                </div>

                {/* Dashboard Tab Content */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        {/* Stats Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                {
                                    label: 'DEPLOYED SPONSOR BUDGET',
                                    value: '0.70 ETH / 250 USDC',
                                    usd: '$2,610 USD Equivalent',
                                    icon: <DollarSign className="w-5 h-5 text-indigo-400" />
                                },
                                {
                                    label: 'ACTIVE CAMPAIGNS',
                                    value: '2 Campaigns',
                                    usd: '1 Pending Approval',
                                    icon: <BarChart3 className="w-5 h-5 text-emerald-400" />
                                },
                                {
                                    label: 'ESTIMATED LISTING YIELD',
                                    value: '15.3% APY',
                                    usd: 'Re-invested automatically',
                                    icon: <TrendingUp className="w-5 h-5 text-cyan-400" />
                                },
                                {
                                    label: 'EARNED XP DIVIDEND',
                                    value: '4,250 XP',
                                    usd: '10% lifetime referrer bonus active',
                                    icon: <Sparkles className="w-5 h-5 text-amber-400" />
                                }
                            ].map((stat, idx) => (
                                <div key={idx} className="glass-card p-6 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[1.5rem] relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-white/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="label-native text-slate-500">{stat.label}</span>
                                        <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                                            {stat.icon}
                                        </div>
                                    </div>
                                    <div className="text-xl font-black text-white uppercase tracking-tight mb-1">
                                        {stat.value}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        {stat.usd}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Middle Section: Active Campaigns & Yield Telemetry */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Campaigns Table */}
                            <div className="lg:col-span-2 glass-card p-8 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[2rem]">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-white text-sm font-black tracking-widest uppercase">My Campaigns</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-1">Live status of your sponsored pools</p>
                                    </div>
                                    <span className="label-native text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 size={12} />
                                        <span>SYSTEM ONLINE</span>
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-white/5">
                                                <th className="label-native py-3">Campaign</th>
                                                <th className="label-native py-3">Type</th>
                                                <th className="label-native py-3">Budget</th>
                                                <th className="label-native py-3">Participants</th>
                                                <th className="label-native py-3">Status</th>
                                                <th className="label-native py-3 text-right">Yield</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {campaigns.map((c) => (
                                                <tr key={c.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                                                    <td className="value-native py-4 font-black text-white">{c.title}</td>
                                                    <td className="content-native py-4">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                                            c.type === 'Raffle' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-cyan-500/10 text-cyan-400'
                                                        }`}>
                                                            {c.type}
                                                        </span>
                                                    </td>
                                                    <td className="value-native py-4 text-slate-400 font-mono">{c.budget}</td>
                                                    <td className="content-native py-4 text-slate-400">{c.participants}</td>
                                                    <td className="content-native py-4">
                                                        <span className={`badge-cyber ${
                                                            c.status === 'Active' ? 'badge-cyber-green' :
                                                            c.status === 'Completed' ? 'badge-cyber-blue' : 'badge-cyber-orange'
                                                        }`}>
                                                            {c.status}
                                                        </span>
                                                    </td>
                                                    <td className={`value-native py-4 text-right font-black ${
                                                        c.status === 'Active' ? 'text-emerald-400' : 'text-slate-500'
                                                    }`}>
                                                        {c.yield}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* UGC Info & Guidelines */}
                            <div className="glass-card p-8 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[2rem] flex flex-col gap-6">
                                <div>
                                    <h3 className="text-white text-sm font-black tracking-widest uppercase">UGC Sponsorship Rules</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-1">Key parameters & conditions</p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        {
                                            title: "Dynamic Rake Mechanics",
                                            desc: "A fixed 20% commission on ticket revenues is routed to treasury to support developer pools."
                                        },
                                        {
                                            title: "Anti-Sybil Verification",
                                            desc: "Enable 'Identity Guard' to enforce Basename resolution and filter out automated bots."
                                        },
                                        {
                                            title: "Vesting Referrals",
                                            desc: "Earn 10% lifetime dividends when users you invited interact with the ecosystem."
                                        }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                                            <div className="space-y-1">
                                                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{item.title}</h4>
                                                <p className="text-[11px] font-medium text-slate-400 leading-relaxed">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="h-px bg-white/5 mt-auto" />

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                        <HelpCircle className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Need Assistance?</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Open discord developer support ticket</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sponsor Raffle Tab Content */}
                {activeTab === 'raffle' && (
                    <div className="animate-in fade-in duration-300">
                        <CreateRafflePage isEmbed={true} />
                    </div>
                )}

                {/* Launch Mission Tab Content */}
                {activeTab === 'mission' && (
                    <div className="animate-in fade-in duration-300">
                        <CreateMissionPage isEmbed={true} />
                    </div>
                )}
            </div>
        </div>
    );
}
