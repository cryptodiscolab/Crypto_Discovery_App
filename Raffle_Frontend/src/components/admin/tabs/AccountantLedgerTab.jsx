import React, { useState, useEffect } from 'react';
import { useSBT } from '../../../hooks/useSBT';
import { 
    Landmark, RefreshCw, Calendar, TrendingUp, AlertTriangle, Wallet, ArrowRight, ExternalLink, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseEther, formatEther, formatUnits } from 'viem';
import { useAccount, useBalance } from 'wagmi';
import { 
    MASTER_X_ADDRESS, DAILY_APP_ADDRESS, RAFFLE_ADDRESS, SAFE_MULTISIG, USDC_ADDRESS 
} from '../../../lib/contracts';

export function AccountantLedgerTab() {
    const { address } = useAccount();
    const { withdrawTreasury } = useSBT();
    const [loading, setLoading] = useState(true);
    const [aggregates, setAggregates] = useState({
        daily: { income: { USDC: 0, ETH: 0 }, expense: { USDC: 0, ETH: 0 } },
        weekly: { income: { USDC: 0, ETH: 0 }, expense: { USDC: 0, ETH: 0 } },
        monthly: { income: { USDC: 0, ETH: 0 }, expense: { USDC: 0, ETH: 0 } }
    });
    const [logs, setLogs] = useState([]);
    
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // On-Chain Balances
    const { data: dailyAppEth, refetch: rf1 } = useBalance({ address: DAILY_APP_ADDRESS });
    const { data: dailyAppUsdc, refetch: rf2 } = useBalance({ address: DAILY_APP_ADDRESS, token: USDC_ADDRESS });
    
    const { data: raffleEth, refetch: rf3 } = useBalance({ address: RAFFLE_ADDRESS });
    const { data: raffleUsdc, refetch: rf4 } = useBalance({ address: RAFFLE_ADDRESS, token: USDC_ADDRESS });
    
    const { data: masterXEth, refetch: rf5 } = useBalance({ address: MASTER_X_ADDRESS });
    const { data: masterXUsdc, refetch: rf6 } = useBalance({ address: MASTER_X_ADDRESS, token: USDC_ADDRESS });
    
    const { data: safeEth, refetch: rf7 } = useBalance({ address: SAFE_MULTISIG });
    const { data: safeUsdc, refetch: rf8 } = useBalance({ address: SAFE_MULTISIG, token: USDC_ADDRESS });

    const refetchBalances = () => {
        rf1(); rf2(); rf3(); rf4(); rf5(); rf6(); rf7(); rf8();
    };

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/accountant-ledger`, {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'accountant-ledger' })
            });
            const data = await res.json();
            if (data.success) {
                setAggregates(data.aggregates);
                setLogs(data.logs);
            } else {
                throw new Error(data.error || 'Failed to fetch ledger');
            }
            refetchBalances();
        } catch (error) {
            console.error('[Ledger Fetch]', error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatBal = (data, decimals = 4) => {
        if (!data) return '0.0000';
        return Number(formatUnits(data.value, data.decimals)).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    useEffect(() => {
        fetchLedger();
    }, []);

    const handleWithdraw = async () => {
        if (!withdrawAmount || isNaN(withdrawAmount) || Number(withdrawAmount) <= 0) {
            return toast.error("Enter a valid amount to withdraw");
        }

        setIsWithdrawing(true);
        try {
            await withdrawTreasury(parseEther(withdrawAmount.toString()));
            toast.success("Withdrawal executed successfully!");
            setWithdrawAmount('');
        } catch (error) {
            console.error('[Withdrawal Error]', error);
            toast.error(error.shortMessage || error.message || "Transaction failed");
        } finally {
            setIsWithdrawing(false);
        }
    };

    const MetricCard = ({ title, aggregate, icon: Icon }) => (
        <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                    <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
            </div>
            
            <div className="space-y-4 relative z-10">
                {/* INCOME */}
                <div className="space-y-1">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Gross Income</span>
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-500 uppercase">USDC</span>
                        <span className="text-lg font-black text-emerald-400 font-mono">
                            ${Number(aggregate.income.USDC).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-500 uppercase">ETH</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                            {Number(aggregate.income.ETH).toFixed(4)} ETH
                        </span>
                    </div>
                </div>

                {/* EXPENSE */}
                <div className="space-y-1 pt-3 border-t border-white/5">
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Total Payouts</span>
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-500 uppercase">USDC</span>
                        <span className="text-lg font-black text-red-400 font-mono">
                            ${Number(aggregate.expense.USDC).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-500 uppercase">ETH</span>
                        <span className="text-sm font-bold text-red-400 font-mono">
                            {Number(aggregate.expense.ETH).toFixed(4)} ETH
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <Landmark className="w-8 h-8 text-emerald-500" />
                        Accountant Ledger
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm max-w-xl">
                        Comprehensive financial records detailing UGC fees, SBT mints, Raffle ticket purchases, and Reward Payouts. Use this to audit daily ecosystem revenue and execute treasury withdrawals.
                    </p>
                </div>
                <button
                    onClick={fetchLedger}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all w-full md:w-auto"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Sync Ledger
                </button>
            </div>

            {/* Aggregates Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard title="Last 24 Hours" aggregate={aggregates.daily} icon={TrendingUp} />
                <MetricCard title="Last 7 Days" aggregate={aggregates.weekly} icon={Calendar} />
                <MetricCard title="Last 30 Days" aggregate={aggregates.monthly} icon={Landmark} />
            </div>

            {/* Balancing Report (On-Chain) */}
            <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-6 h-6 text-indigo-400" />
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">Live Balancing Report (On-Chain)</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Safe Treasury */}
                    <div className="bg-[#121214] border border-indigo-500/10 rounded-xl p-4 hover:border-indigo-500/30 transition-colors">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                            Safe Treasury
                            <a href={`https://basescan.org/address/${SAFE_MULTISIG}`} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3 text-slate-600 hover:text-indigo-400" /></a>
                        </div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-xs font-bold text-slate-400">ETH</span>
                            <span className="text-sm font-black text-white font-mono">{formatBal(safeEth)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-400">USDC</span>
                            <span className="text-sm font-black text-emerald-400 font-mono">${formatBal(safeUsdc, 2)}</span>
                        </div>
                    </div>

                    {/* Master X */}
                    <div className="bg-[#121214] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                            Master X (SBT Pool)
                            <a href={`https://basescan.org/address/${MASTER_X_ADDRESS}`} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3 text-slate-600 hover:text-indigo-400" /></a>
                        </div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-xs font-bold text-slate-400">ETH</span>
                            <span className="text-sm font-black text-white font-mono">{formatBal(masterXEth)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-400">USDC</span>
                            <span className="text-sm font-black text-emerald-400 font-mono">${formatBal(masterXUsdc, 2)}</span>
                        </div>
                    </div>

                    {/* DailyApp */}
                    <div className="bg-[#121214] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                            DailyApp Contract
                            <a href={`https://basescan.org/address/${DAILY_APP_ADDRESS}`} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3 text-slate-600 hover:text-indigo-400" /></a>
                        </div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-xs font-bold text-slate-400">ETH</span>
                            <span className="text-sm font-black text-white font-mono">{formatBal(dailyAppEth)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-400">USDC</span>
                            <span className="text-sm font-black text-emerald-400 font-mono">${formatBal(dailyAppUsdc, 2)}</span>
                        </div>
                    </div>

                    {/* Raffle */}
                    <div className="bg-[#121214] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                            Raffle Contract
                            <a href={`https://basescan.org/address/${RAFFLE_ADDRESS}`} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3 text-slate-600 hover:text-indigo-400" /></a>
                        </div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-xs font-bold text-slate-400">ETH</span>
                            <span className="text-sm font-black text-white font-mono">{formatBal(raffleEth)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-400">USDC</span>
                            <span className="text-sm font-black text-emerald-400 font-mono">${formatBal(raffleUsdc, 2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Treasury Execution Section */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Wallet className="w-6 h-6 text-indigo-400" />
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">Treasury Withdrawal (ETH)</h2>
                </div>
                <p className="text-sm text-indigo-200/60 mb-6 max-w-2xl">
                    Execute a manual withdrawal of accumulated ETH (from Raffles and Mints) out of the DailyApp/Raffle smart contracts directly into the central Safe Treasury wallet.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="relative w-full sm:w-64">
                        <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="Amount in ETH"
                            className="w-full bg-black/40 border border-indigo-500/30 rounded-xl px-4 py-3 text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-400">ETH</div>
                    </div>
                    <button
                        onClick={handleWithdraw}
                        disabled={isWithdrawing || !withdrawAmount}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        {isWithdrawing ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Execute Transfer <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Transaction Log Table */}
            <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0d0d0f]">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Recent Transactions</h3>
                    <span className="text-xs font-bold text-slate-500 uppercase">{logs.length} Records</span>
                </div>
                
                <div className="flex-1 overflow-auto">
                    {loading && logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                            <AlertTriangle className="w-8 h-8" />
                            <span className="text-xs font-black uppercase tracking-widest">No transactions found</span>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#121214] sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Date & Time</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Activity / Description</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Wallet</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs.map((log) => {
                                    const isIncome = log.category === 'PURCHASE';
                                    const colorClass = isIncome 
                                        ? (log.value_symbol === 'USDC' ? 'text-emerald-400' : 'text-indigo-400')
                                        : 'text-red-400';
                                    const sign = isIncome ? '+' : '-';

                                    return (
                                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="text-xs font-bold text-slate-300">
                                                    {new Date(log.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-xs font-black text-white uppercase tracking-wider mb-0.5">
                                                    {log.activity_type || log.category}
                                                </div>
                                                <div className="text-[11px] text-slate-400 max-w-sm truncate">
                                                    {log.description}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <a 
                                                    href={`https://basescan.org/address/${log.wallet_address}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 w-fit"
                                                >
                                                    {log.wallet_address?.slice(0, 6)}...{log.wallet_address?.slice(-4)}
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className={`text-sm font-black font-mono ${colorClass}`}>
                                                    {sign}{log.value_symbol === 'USDC' ? '$' : ''}
                                                    {Number(log.value_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                    {log.value_symbol !== 'USDC' ? ` ${log.value_symbol}` : ''}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
