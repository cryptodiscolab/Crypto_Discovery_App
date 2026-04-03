import React, { useState, useEffect } from 'react';
import { Landmark, CheckCircle, Copy, RefreshCw, AlertTriangle, ExternalLink, DollarSign, Wallet } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';
import { CONTRACTS } from '../../lib/contracts';

export function UgcRevenueTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [revenueData, setRevenueData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalPending: 0, count: 0 });
    const [filterTab, setFilterTab] = useState('PENDING');

    const fetchRevenue = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GET_UGC_REVENUE', 
                    wallet_address: address 
                })
            });
            const result = await response.json();
            if (result.success) {
                const data = result.data || [];
                setRevenueData(data);
                
                const pending = data.filter(r => !r.is_revenue_allocated);
                const total = pending.reduce((sum, r) => sum + parseFloat(r.sbt_share_amount || 0), 0);
                setStats({ totalPending: total, count: pending.length });
            }
        } catch (error) {
            console.error('Fetch revenue failed:', error);
            toast.error("Failed to load revenue tracking");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (address) fetchRevenue();
    }, [address]);

    const handleMarkAllocated = async (missionId) => {
        const tid = toast.loading("Updating revenue status...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Allocate UGC Revenue\nMission: ${missionId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'MARK_REVENUE_ALLOCATED',
                    wallet_address: address,
                    signature,
                    message,
                    payload: { mission_id: missionId }
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success("Revenue marked as allocated!", { id: tid });
                fetchRevenue();
            } else {
                throw new Error(result.error || "Update failed");
            }
        } catch (error) {
            toast.error(error.message, { id: tid });
        }
    };

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-indigo-400" />
                        Revenue Management
                    </h2>
                    <p className="admin-label !mb-0 !text-[11px] mt-1">SBT Pool Funding & Reconciliation</p>
                </div>
                <button onClick={fetchRevenue} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Quick Stats & Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-3xl relative overflow-hidden">
                    <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500/10 rotate-12" />
                    <p className="admin-label !text-indigo-400 !mb-1 !text-[11px]">Pending SBT Funding</p>
                    <h3 className="text-3xl font-black text-white">{stats.totalPending.toFixed(2)} <span className="text-sm font-bold text-slate-500">USDC</span></h3>
                    <p className="text-[11px] text-slate-500 font-bold mt-2 uppercase tracking-tighter">From {stats.count} Missions</p>
                </div>

                <div className="md:col-span-2 bg-[#121214] border border-white/5 p-6 rounded-3xl">
                    <h4 className="admin-label !mb-4 !text-white flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Manual Allocation
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <p className="admin-label !mb-0 !text-[11px]">1. Destination (MasterX)</p>
                            <button 
                                onClick={() => copyToClipboard(CONTRACTS.MASTER_X, 'MasterX Address')}
                                className="w-full flex items-center justify-between px-3 py-2 bg-black/40 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all group"
                            >
                                <span className="text-[11px] font-mono text-slate-300 truncate">{CONTRACTS.MASTER_X}</span>
                                <Copy className="w-3 h-3 text-slate-500 group-hover:text-indigo-400" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            <p className="admin-label !mb-0 !text-[11px]">2. Batch Amount (USDC)</p>
                            <button 
                                onClick={() => copyToClipboard(stats.totalPending.toString(), 'Amount')}
                                className="w-full flex items-center justify-between px-3 py-2 bg-black/40 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all group"
                            >
                                <span className="text-[11px] font-mono text-slate-300">{stats.totalPending.toFixed(2)} USDC</span>
                                <Copy className="w-3 h-3 text-slate-500 group-hover:text-indigo-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Filters */}
            <div className="flex items-center gap-2 mb-4">
                <button 
                    onClick={() => setFilterTab('PENDING')}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${filterTab === 'PENDING' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                >
                    Pending
                </button>
                <button 
                    onClick={() => setFilterTab('FUNDED')}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${filterTab === 'FUNDED' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                >
                    History
                </button>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Calculating Revenue...</p>
                </div>
            ) : (
                <div className="bg-[#121214] rounded-3xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/2">
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Mission</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Fee (USDC)</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">SBT Share</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {revenueData.filter(m => filterTab === 'PENDING' ? !m.is_revenue_allocated : m.is_revenue_allocated).length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-[10px] text-slate-600 font-bold uppercase">No records found for this view</td>
                                </tr>
                            ) : (
                                revenueData
                                    .filter(m => filterTab === 'PENDING' ? !m.is_revenue_allocated : m.is_revenue_allocated)
                                    .map(mission => (
                                    <tr key={mission.id} className="hover:bg-white/[0.02] transition-all group">
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-bold text-white">{mission.title}</p>
                                            <p className="text-[8px] text-slate-500 font-mono mt-0.5">{mission.id}</p>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-300">
                                            {parseFloat(mission.listing_fee_usdc || 0).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-indigo-400 font-mono">
                                            {parseFloat(mission.sbt_share_amount || 0).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {mission.is_revenue_allocated ? (
                                                <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">Funded</span>
                                            ) : (
                                                <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!mission.is_revenue_allocated && (
                                                <button 
                                                    onClick={() => handleMarkAllocated(mission.id)}
                                                    className="btn-native bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white !py-1.5 !px-3 !text-[11px]"
                                                >
                                                    Mark Funded
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
