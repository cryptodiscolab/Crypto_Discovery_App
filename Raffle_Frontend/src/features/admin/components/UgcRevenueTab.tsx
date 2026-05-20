import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';
import { CONTRACTS } from '../../../lib/contracts';
import { AlertTriangle, Copy, DollarSign, Landmark, RefreshCw } from 'lucide-react';

interface RevenueItem {
    id: string | number;
    title: string;
    listing_fee?: string | number;
    listing_fee_usdc: string | number;
    reward_symbol?: string;
    sbt_share_amount: string | number;
    is_revenue_allocated: boolean;
}

export function UgcRevenueTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [revenueData, setRevenueData] = useState<RevenueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<{ totals: Record<string, number>; count: number }>({ totals: {}, count: 0 });
    const [filterTab, setFilterTab] = useState('PENDING');

    const fetchRevenue = async () => {
        setLoading(true);
        try {
            const timestamp = new Date().toISOString();
            const message = `Action: Fetch UGC Revenue\nAdmin: ${address?.toLowerCase()}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'GET_UGC_REVENUE',
                    wallet_address: address,
                    signature,
                    message
                })
            });
            const result = await response.json();
            if (result.success) {
                const data = result.data || [];
                setRevenueData(data);

                const pending = data.filter((r: { is_revenue_allocated?: boolean }) => !r.is_revenue_allocated);
                const totals: Record<string, number> = {};
                pending.forEach((r: { reward_symbol?: string; sbt_share_amount?: number | string }) => {
                    const symbol = r.reward_symbol || 'USDC';
                    totals[symbol] = (totals[symbol] || 0) + parseFloat(String(r.sbt_share_amount || 0));
                });
                setStats({ totals, count: pending.length });
            }
        } catch (error: unknown) {
            console.error('Fetch revenue failed:', error);
            const errMsg = error instanceof Error ? error.message : String(error);
            toast.error(errMsg || "Failed to load revenue tracking");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (address) fetchRevenue();
    }, [address]);

    const handleMarkAllocated = async (id: string | number) => {
        const tid = toast.loading("Updating revenue status...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Action: Mark Revenue Allocated\nID: ${id}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'MARK_REVENUE_ALLOCATED',
                    payload: { mission_id: id },
                    wallet_address: address,
                    signature,
                    message
                })
            });
            const result = await response.json();
            if (result.success) {
                toast.success("Revenue marked as allocated!", { id: tid });
                fetchRevenue();
            } else {
                throw new Error(result.error || "Failed to update status");
            }
        } catch (error: unknown) {
            console.error('Allocation marking failed:', error);
            const errMsg = error instanceof Error ? error.message : String(error);
            toast.error(errMsg || "Failed to mark as allocated", { id: tid });
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    return (
        <div className="space-y-6 max-w-[100vw] overflow-x-hidden">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-indigo-400" />
                        Revenue Management
                    </h2>
                    <p className="label-native text-slate-500 mt-2">SBT Pool Funding & Reconciliation</p>
                </div>
                <button onClick={fetchRevenue} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Quick Stats & Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-3xl relative overflow-hidden">
                    <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500/10 rotate-12" />
                    <p className="label-native text-indigo-400 mb-1">Pending SBT Funding</p>
                    <div className="space-y-1">
                        {Object.entries(stats.totals).length === 0 ? (
                            <h3 className="text-2xl font-black text-white">0.00 <span className="label-native text-slate-500">USDC</span></h3>
                        ) : (
                            Object.entries(stats.totals).map(([symbol, amount]) => (
                                <h3 key={symbol} className="text-2xl font-black text-white">
                                    {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                    <span className="label-native text-slate-500 ml-1">{symbol}</span>
                                </h3>
                            ))
                        )}
                    </div>
                    <p className="label-native text-slate-500 mt-2">From {stats.count} Missions</p>
                </div>

                <div className="md:col-span-2 bg-[#121214] border border-white/5 p-6 rounded-3xl">
                    <h4 className="label-native text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Manual Allocation
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <p className="label-native text-slate-400 mb-1">1. Destination (MasterX)</p>
                            <button
                                onClick={() => copyToClipboard((CONTRACTS.MASTER_X as string) || '', 'MasterX Address')}
                                className="w-full flex items-center justify-between px-3 py-2 bg-black/40 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all group"
                            >
                                <span className="label-native text-slate-300 font-mono truncate">{CONTRACTS.MASTER_X}</span>
                                <Copy className="w-3 h-3 text-slate-500 group-hover:text-indigo-400" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            <p className="label-native text-slate-400 mb-1">2. Batch Amount</p>
                            <div className="space-y-1">
                                {Object.entries(stats.totals).map(([symbol, amount]) => (
                                    <button
                                        key={symbol}
                                        onClick={() => copyToClipboard(amount.toString(), `Amount (${symbol})`)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-black/40 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all group"
                                    >
                                        <span className="label-native text-slate-300">{amount.toFixed(symbol === 'USDC' ? 2 : 6)} {symbol}</span>
                                        <Copy className="w-3 h-3 text-slate-500 group-hover:text-indigo-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Filters */}
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={() => setFilterTab('PENDING')}
                    className={`px-4 py-1.5 rounded-full label-native transition-all ${filterTab === 'PENDING' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-lg' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                >
                    Pending
                </button>
                <button
                    onClick={() => setFilterTab('FUNDED')}
                    className={`px-4 py-1.5 rounded-full label-native transition-all ${filterTab === 'FUNDED' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-lg' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                >
                    History
                </button>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <p className="label-native text-slate-500">Calculating Revenue...</p>
                </div>
            ) : (
                <div className="bg-[#121214] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/2">
                                    <th className="px-6 py-4 label-native text-slate-500">Mission</th>
                                    <th className="px-6 py-4 label-native text-slate-500">Listing Fee</th>
                                    <th className="px-6 py-4 label-native text-slate-500">SBT Share (USDC)</th>
                                    <th className="px-6 py-4 label-native text-slate-500">Status</th>
                                    <th className="px-6 py-4 label-native text-slate-500 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {revenueData.filter(m => filterTab === 'PENDING' ? !m.is_revenue_allocated : m.is_revenue_allocated).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center label-native text-slate-500">No records found for this view</td>
                                    </tr>
                                ) : (
                                    revenueData
                                        .filter(m => filterTab === 'PENDING' ? !m.is_revenue_allocated : m.is_revenue_allocated)
                                        .map(mission => (
                                        <tr key={mission.id} className="hover:bg-white/[0.02] transition-all group">
                                            <td className="px-6 py-4">
                                                <p className="value-native text-white">{mission.title}</p>
                                                <p className="label-native text-slate-500 mt-1">{mission.id}</p>
                                            </td>
                                            <td className="px-6 py-4 value-native font-mono text-slate-300">
                                                {mission.listing_fee ? (
                                                    <span className="flex items-center gap-1">
                                                        {parseFloat(String(mission.listing_fee)).toFixed(4)}
                                                        <span className="label-native text-slate-500">{mission.reward_symbol || 'ETH'}</span>
                                                    </span>
                                                ) : (
                                                    <span>{parseFloat(String(mission.listing_fee_usdc || 0)).toFixed(2)} USDC</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 value-native text-indigo-400 font-mono">
                                                {parseFloat(String(mission.sbt_share_amount || 0)).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 label-native text-slate-400">
                                                {mission.is_revenue_allocated ? 'Funded' : 'Pending'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {!mission.is_revenue_allocated && (
                                                    <button
                                                        onClick={() => handleMarkAllocated(mission.id)}
                                                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-xl label-native transition-all active:scale-[0.98]"
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
                </div>
            )}
        </div>
    );
}
