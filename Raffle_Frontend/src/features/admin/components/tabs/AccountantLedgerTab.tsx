import { useState, useEffect } from 'react';
import { useSBT } from '../../../../hooks/useSBT';
import {
    Landmark, RefreshCw, Calendar, TrendingUp, AlertTriangle, ExternalLink, Activity, Database
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { parseEther, formatUnits } from 'viem';
import { useAccount, useBalance, useSignMessage } from 'wagmi';
import {
    MASTER_X_ADDRESS, DAILY_APP_ADDRESS, RAFFLE_ADDRESS, SAFE_MULTISIG, USDC_ADDRESS, WETH_ADDRESS
} from '../../../../lib/contracts';
import { usePriceOracle } from '../../../../hooks/usePriceOracle';
import { ShieldCheck, HardDrive, DatabaseZap, FileJson, Award, Wallet } from 'lucide-react';

interface Aggregate {
    income: Record<string, number>;
    expense: Record<string, number>;
}

interface Aggregates {
    daily: Aggregate;
    weekly: Aggregate;
    monthly: Aggregate;
}

interface LedgerLog {
    id: string;
    created_at: string;
    category: string;
    activity_type: string;
    description: string;
    wallet_address: string;
    value_amount: number;
    value_symbol: string;
}

interface SyncState {
    last_synced_block: number;
    updated_at: string;
}

interface ParitySummary {
    total_users: number;
    xp_drift: number;
    tier_drift: number;
    is_perfect: boolean;
}

export function AccountantLedgerTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const {
        withdrawTreasury,
        syncPointsToContract,
        syncTiersToContract,
        syncMetadataToContract
    } = useSBT();

    const [loading, setLoading] = useState(true);
    const [isHardening, setIsHardening] = useState(false);
    const [parityResults, setParityResults] = useState<ParitySummary | null>(null);
    const [aggregates, setAggregates] = useState<Aggregates>({
        daily: { income: {}, expense: {} },
        weekly: { income: {}, expense: {} },
        monthly: { income: {}, expense: {} }
    });
    const [logs, setLogs] = useState<LedgerLog[]>([]);
    const [syncState, setSyncState] = useState<SyncState | null>(null);
    const [syncLoading, setSyncLoading] = useState(false);

    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // Fetch live prices for WETH (which corresponds to ETH) and USDC
    const { prices } = usePriceOracle(
        ([WETH_ADDRESS, USDC_ADDRESS].filter(Boolean) as string[])
    );
    const ethPrice = prices[WETH_ADDRESS.toLowerCase()] || 0;

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
            const timestamp = new Date().toISOString();
            const message = `Action: Accountant Ledger\nAdmin: ${address?.toLowerCase()}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const res = await fetch(`/api/admin/accountant-ledger`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'accountant-ledger',
                    wallet_address: address,
                    signature,
                    message
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server Error (${res.status}): ${text || res.statusText || 'Unknown'}`);
            }

            const text = await res.text();
            if (!text || text.trim() === '') {
                throw new Error('Server returned an empty response');
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('[Ledger Parse Error] Raw text:', text);
                throw new Error('Failed to parse server response as JSON');
            }

            if (data.success) {
                if (data.aggregates) setAggregates(data.aggregates);
                setLogs(data.logs || []);
                setSyncState(data.syncState || null);
            } else {
                throw new Error(data.error || 'Failed to fetch ledger');
            }
            refetchBalances();
        } catch (error: any) {
            console.error('[Ledger Fetch]', error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const triggerBlockchainSync = async () => {
        if (!address) return toast.error('Wallet not connected');
        try {
            setSyncLoading(true);
            const message = `Trigger Blockchain Sync at ${new Date().toISOString()}`;
            const signature = await signMessageAsync({ message });

            const response = await axios.post(`/api/admin/accountant-sync`, {
                address: address.toLowerCase(),
                signature,
                message,
                action: 'accountant-sync'
            });

            if (response.data.success) {
                toast.success('Blockchain sync triggered!');
                fetchLedger(); // Refresh data after sync
            } else {
                toast.error(response.data.error || 'Sync failed');
            }
        } catch (err: any) {
            console.error('Sync Error:', err);
            toast.error(err.response?.data?.error || err.message);
        } finally {
            setSyncLoading(false);
        }
    };

    const runParityAudit = async () => {
        setIsHardening(true);
        const toastId = toast.loading("Auditing ecosystem parity...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Action: Parity Audit\nAdmin: ${address?.toLowerCase()}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const res = await fetch(`/api/admin/parity-audit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'parity-audit',
                    wallet_address: address,
                    signature,
                    message
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Audit Server Error (${res.status}): ${text || res.statusText || 'Unknown'}`);
            }

            const text = await res.text();
            if (!text || text.trim() === '') {
                throw new Error('Audit server returned an empty response');
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('[Audit Parse Error] Raw text:', text);
                throw new Error('Failed to parse audit response as JSON');
            }

            if (data.success) {
                setParityResults(data.summary);
                toast.success("Parity audit completed", { id: toastId });
            } else {
                throw new Error(data.error || "Audit failed");
            }
        } catch (error: any) {
            toast.error(error.message, { id: toastId });
        } finally {
            setIsHardening(false);
        }
    };

    const handleSyncXP = async () => {
        setIsHardening(true);
        try {
            await syncPointsToContract(signMessageAsync);
            await runParityAudit(); // Re-run audit after sync
        } catch (e) {
            console.error(e);
        } finally {
            setIsHardening(false);
        }
    };

    const handleSyncTiers = async () => {
        setIsHardening(true);
        try {
            await syncTiersToContract(signMessageAsync);
            await runParityAudit();
        } catch (e) {
            console.error(e);
        } finally {
            setIsHardening(false);
        }
    };

    const handleSyncMetadata = async () => {
        setIsHardening(true);
        try {
            await syncMetadataToContract();
        } catch (e) {
            console.error(e);
        } finally {
            setIsHardening(false);
        }
    };

    const formatBal = (data: { value?: bigint; decimals?: number } | unknown, decimals = 4) => {
        if (!data || typeof data !== 'object') return '0.0000';
        const d = data as { value?: bigint; decimals?: number };
        if (!d.value || !d.decimals) return '0.0000';
        return Number(formatUnits(d.value, d.decimals)).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    useEffect(() => {
        fetchLedger();
    }, []);

    const handleWithdraw = async () => {
        if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
            return toast.error("Enter a valid amount to withdraw");
        }

        if (!window.confirm(`Are you sure you want to withdraw ${withdrawAmount} ETH? This is irreversible.`)) {
            return;
        }

        setIsWithdrawing(true);
        try {
            await withdrawTreasury(parseEther(withdrawAmount.toString()));
            toast.success("Withdrawal executed successfully!");
            setWithdrawAmount('');
        } catch (error: any) {
            console.error('[Withdrawal Error]', error);
            toast.error(error.shortMessage || error.message || "Transaction failed");
        } finally {
            setIsWithdrawing(false);
        }
    };

    const MetricCard = ({ title, aggregate, icon: Icon }: { title: string; aggregate?: Aggregate; icon: React.ComponentType<{ className?: string }> }) => {
        const safeAggregate = aggregate || { income: {}, expense: {} };
        
        const getSortedTokens = (map: Record<string, number>) => {
            return Object.keys(map).sort((a, b) => {
                if (a.toUpperCase() === 'USDC') return -1;
                if (b.toUpperCase() === 'USDC') return 1;
                return a.localeCompare(b);
            });
        };

        const incomeTokens = getSortedTokens(safeAggregate.income);
        const expenseTokens = getSortedTokens(safeAggregate.expense);

        return (
            <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-colors" />
                <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                        <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-[11px] font-black text-white uppercase tracking-widest label-native">{title}</h3>
                </div>

                <div className="space-y-4 relative z-10">
                    {/* INCOME */}
                    <div className="space-y-2">
                        <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest label-native">Gross Income</span>
                        {incomeTokens.length === 0 ? (
                            <div className="text-slate-500 text-[13px] font-medium font-mono content-native">0.00</div>
                        ) : (
                            incomeTokens.map(tok => {
                                const val = safeAggregate.income[tok] || 0;
                                const isUsdc = tok.toUpperCase() === 'USDC';
                                const usdEquivalent = !isUsdc && (tok.toUpperCase() === 'ETH' || tok.toUpperCase() === 'WETH') ? val * ethPrice : 0;
                                return (
                                    <div key={tok} className="flex justify-between items-center py-0.5">
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest label-native">{tok}</span>
                                        <div className="text-right">
                                            <div className="text-[13px] font-black text-emerald-400 font-mono content-native">
                                                {isUsdc ? '$' : ''}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: isUsdc ? 2 : 4 })}{!isUsdc ? ` ${tok}` : ''}
                                            </div>
                                            {usdEquivalent > 0 && (
                                                <div className="text-[11px] font-black text-slate-500 font-mono uppercase tracking-widest label-native mt-0.5">
                                                    ≈ ${usdEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* EXPENSE */}
                    <div className="space-y-2 pt-3 border-t border-white/5">
                        <span className="text-[11px] font-black text-red-400 uppercase tracking-widest label-native">Total Payouts</span>
                        {expenseTokens.length === 0 ? (
                            <div className="text-slate-500 text-[13px] font-medium font-mono content-native">0.00</div>
                        ) : (
                            expenseTokens.map(tok => {
                                const val = safeAggregate.expense[tok] || 0;
                                const isUsdc = tok.toUpperCase() === 'USDC';
                                const usdEquivalent = !isUsdc && (tok.toUpperCase() === 'ETH' || tok.toUpperCase() === 'WETH') ? val * ethPrice : 0;
                                return (
                                    <div key={tok} className="flex justify-between items-center py-0.5">
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest label-native">{tok}</span>
                                        <div className="text-right">
                                            <div className="text-[13px] font-black text-red-400 font-mono content-native">
                                                {isUsdc ? '$' : ''}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: isUsdc ? 2 : 4 })}{!isUsdc ? ` ${tok}` : ''}
                                            </div>
                                            {usdEquivalent > 0 && (
                                                <div className="text-[11px] font-black text-slate-500 font-mono uppercase tracking-widest label-native mt-0.5">
                                                    ≈ ${usdEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        );
    };

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
                    Refresh Data
                </button>

                <button
                    onClick={triggerBlockchainSync}
                    disabled={syncLoading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-sm font-bold text-blue-400 transition-all w-full md:w-auto"
                >
                    <ShieldCheck className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                    Trigger Blockchain Sync
                </button>
            </div>

            {/* Sync Status Bar */}
            {syncState && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                        <div>
                            <p className="text-xs text-white/40 uppercase tracking-wider font-bold">Last Synced Block</p>
                            <p className="text-xl font-mono text-white mt-1">{syncState.last_synced_block}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/40 uppercase tracking-wider font-bold">Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-sm text-green-400 font-bold">Live</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                        <div>
                            <p className="text-xs text-white/40 uppercase tracking-wider font-bold">Sync Freshness</p>
                            <p className="text-sm text-white/80 mt-1">
                                {new Date(syncState.updated_at).toLocaleString()}
                            </p>
                        </div>
                        <div className="text-blue-400">
                            <Database className="w-6 h-6 opacity-40" />
                        </div>
                    </div>
                </div>
            )}

            {/* Aggregates Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard title="Last 24 Hours" aggregate={aggregates?.daily} icon={TrendingUp} />
                <MetricCard title="Last 7 Days" aggregate={aggregates?.weekly} icon={Calendar} />
                <MetricCard title="Last 30 Days" aggregate={aggregates?.monthly} icon={Landmark} />
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

            {/* Ecosystem Hardening Center */}
            <div className="bg-[#0a0a0c] border border-emerald-500/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">Ecosystem Hardening Center</h2>
                        </div>
                        <p className="text-slate-400 text-sm max-w-xl">
                            Ensure 1:1 parity between the Accountant Ledger (Supabase) and the On-Chain Smart Contracts.
                            Use these tools to fix drift and sync metadata URIs.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={runParityAudit}
                            disabled={isHardening}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all"
                        >
                            <HardDrive className={`w-3.5 h-3.5 ${isHardening ? 'animate-pulse' : ''}`} />
                            Run Parity Audit
                        </button>
                        <button
                            onClick={handleSyncXP}
                            disabled={isHardening}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-400 transition-all"
                        >
                            <DatabaseZap className="w-3.5 h-3.5" />
                            Sync XP to Contract
                        </button>
                        <button
                            onClick={handleSyncTiers}
                            disabled={isHardening}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-xs font-bold text-purple-400 transition-all"
                        >
                            <Award className="w-3.5 h-3.5" />
                            Sync Tiers to Contract
                        </button>
                        <button
                            onClick={handleSyncMetadata}
                            disabled={isHardening}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-400 transition-all"
                        >
                            <FileJson className="w-3.5 h-3.5" />
                            Sync NFT URIs
                        </button>
                    </div>
                </div>

                {parityResults && (
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in relative z-10">
                        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Audited</div>
                            <div className="text-xl font-black text-white font-mono">{parityResults.total_users} Users</div>
                        </div>
                        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">XP Inconsistencies</div>
                            <div className={`text-xl font-black font-mono ${parityResults.xp_drift > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {parityResults.xp_drift} {parityResults.xp_drift > 0 ? '⚠️' : '✅'}
                            </div>
                        </div>
                        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tier Inconsistencies</div>
                            <div className={`text-xl font-black font-mono ${parityResults.tier_drift > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {parityResults.tier_drift} {parityResults.tier_drift > 0 ? '⚠️' : '✅'}
                            </div>
                        </div>
                        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Last Sync Status</div>
                            <div className="text-xs font-bold text-slate-400 mt-1">
                                {parityResults.is_perfect ? "✨ PERFECT PARITY" : "Drift Detected"}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Treasury Withdrawal (Owner Only) */}
            <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                    <Wallet className="w-6 h-6 text-emerald-400" />
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">Treasury Withdrawal (Owner Only)</h2>
                </div>
                <div className="flex flex-col md:flex-row items-end gap-4">
                    <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Withdraw Amount (ETH)</label>
                        <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-emerald-500/50 transition-all"
                        />
                    </div>
                    <button
                        onClick={handleWithdraw}
                        disabled={isWithdrawing || !withdrawAmount}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl text-sm font-black text-white uppercase tracking-widest transition-all"
                    >
                        {isWithdrawing ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Execute Withdrawal"}
                    </button>
                </div>
            </div>

            {/* Transaction Log Table */}
            <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0d0d0f]">
                    <h3 className="text-[11px] font-black text-white uppercase tracking-widest label-native">Recent Transactions</h3>
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest label-native">{logs.length} Records</span>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading && logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                            <AlertTriangle className="w-8 h-8" />
                            <span className="text-[11px] font-black uppercase tracking-widest label-native">No transactions found</span>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#121214] sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 label-native">Date & Time</th>
                                    <th className="p-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 label-native">Activity / Description</th>
                                    <th className="p-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 label-native">Wallet</th>
                                    <th className="p-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 text-right label-native">Amount</th>
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
                                                <div className="text-[13px] font-medium leading-relaxed text-slate-300 content-native">
                                                    {new Date(log.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-[11px] font-mono text-slate-500 mt-0.5 label-native">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-[11px] font-black text-white uppercase tracking-widest mb-0.5 label-native">
                                                    {log.activity_type || log.category}
                                                </div>
                                                <div className="text-[13px] font-medium leading-relaxed text-slate-400 max-w-sm truncate content-native">
                                                    {log.description}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <a
                                                    href={`https://basescan.org/address/${log.wallet_address}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[13px] font-medium leading-relaxed text-indigo-400 hover:text-indigo-300 flex items-center gap-1 w-fit font-mono content-native"
                                                >
                                                    {log.wallet_address?.slice(0, 6)}...{log.wallet_address?.slice(-4)}
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className={`text-[13px] font-black font-mono ${colorClass} content-native`}>
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
