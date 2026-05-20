import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Filter, Clock, Server, User, Hash } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';

interface ErrorLog {
    id: number;
    severity: string;
    surface: string;
    bundle: string | null;
    action: string | null;
    wallet_address: string | null;
    tx_hash: string | null;
    request_id: string | null;
    error_code: string | null;
    message_sanitized: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
    critical: 'text-red-500 bg-red-500/10 border-red-500/20',
    error: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    warn: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

export function SystemErrorLogsTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [logs, setLogs] = useState<ErrorLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [bundleFilter, setBundleFilter] = useState<string>('');

    const fetchLogs = async () => {
        if (!address) return;
        setLoading(true);
        try {
            const timestamp = new Date().toISOString();
            const message = `Admin: Fetch Error Logs\nWallet: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const res = await fetch('/api/admin-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'GET_ERROR_LOGS',
                    wallet: address,
                    signature,
                    message,
                    payload: {
                        limit: 100,
                        severity: severityFilter || null,
                        bundle: bundleFilter || null
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs || []);
            } else {
                toast.error(data.error || 'Failed to fetch error logs');
            }
        } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error.message || 'Failed to fetch');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (address) fetchLogs();
    }, [address]);

    const formatDate = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        System Error Logs
                    </h2>
                    <p className="admin-label !mb-0 !text-[11px] mt-1">Persistent backend error/incident history</p>
                </div>
                <button onClick={fetchLogs} disabled={loading} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <select
                    value={severityFilter}
                    onChange={e => setSeverityFilter(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white"
                >
                    <option value="">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                </select>
                <select
                    value={bundleFilter}
                    onChange={e => setBundleFilter(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white"
                >
                    <option value="">All Bundles</option>
                    <option value="user-bundle">user-bundle</option>
                    <option value="admin-bundle">admin-bundle</option>
                    <option value="tasks-bundle">tasks-bundle</option>
                    <option value="raffle-bundle">raffle-bundle</option>
                    <option value="audit-bundle">audit-bundle</option>
                    <option value="sync-xp-onchain">sync-xp-onchain</option>
                    <option value="lurah-cron">lurah-cron</option>
                </select>
                <button
                    onClick={fetchLogs}
                    className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-400 hover:text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                    <Filter className="w-3 h-3" /> Apply
                </button>
            </div>

            {/* Logs List */}
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                    <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mb-4" />
                    <p className="admin-label !text-[11px]">Loading error logs...</p>
                </div>
            ) : logs.length === 0 ? (
                <div className="py-20 text-center bg-white/2 rounded-3xl border border-dashed border-white/5">
                    <AlertTriangle className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                    <p className="text-xs text-slate-600 font-bold uppercase">No error logs found</p>
                    <p className="text-[10px] text-slate-700 mt-1">System is running clean or table not yet created</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {logs.map(log => (
                        <div key={log.id} className="bg-[#121214] p-5 rounded-2xl border border-white/5 hover:border-orange-500/20 transition-all">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.error}`}>
                                        {log.severity}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase bg-white/5 px-2 py-0.5 rounded-lg">
                                        {log.surface}
                                    </span>
                                    {log.bundle && (
                                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                            <Server className="w-2.5 h-2.5" /> {log.bundle}
                                        </span>
                                    )}
                                    {log.action && (
                                        <span className="text-[10px] font-mono text-slate-400">
                                            → {log.action}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1 shrink-0">
                                    <Clock className="w-2.5 h-2.5" /> {formatDate(log.created_at)}
                                </span>
                            </div>

                            <p className="text-sm text-white/80 font-mono leading-relaxed mb-3">{log.message_sanitized}</p>

                            <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 font-mono">
                                {log.wallet_address && (
                                    <span className="flex items-center gap-1">
                                        <User className="w-2.5 h-2.5" /> {log.wallet_address.slice(0, 8)}...{log.wallet_address.slice(-4)}
                                    </span>
                                )}
                                {log.tx_hash && (
                                    <span className="flex items-center gap-1">
                                        <Hash className="w-2.5 h-2.5" /> {log.tx_hash.slice(0, 10)}...
                                    </span>
                                )}
                                {log.error_code && (
                                    <span className="text-orange-400">code: {log.error_code}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
