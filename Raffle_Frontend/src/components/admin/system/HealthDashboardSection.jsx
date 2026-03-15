import React, { useState, useEffect } from 'react';
import { 
    Activity, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    RefreshCw,
    ShieldAlert,
    ExternalLink
} from 'lucide-react';

export function HealthDashboardSection() {
    const [healthData, setHealthData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchHealth = async () => {
        setRefreshing(true);
        try {
            const res = await fetch('/api/user-bundle?action=get-health');
            const data = await res.json();
            if (data.ok) setHealthData(data.health);
        } catch (e) {
            console.error('Fetch Health Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000); // Auto-refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const handleReset = async (serviceKey) => {
        if (!confirm(`Reset health for ${serviceKey}?`)) return;
        try {
            const res = await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset-health', service_key: serviceKey })
            });
            const data = await res.json();
            if (data.ok) fetchHealth();
            else alert(data.error || 'Reset failed');
        } catch (e) {
            alert('Reset error');
        }
    };

    const getStatusColor = (status, lastHeartbeat) => {
        if (status === 'failed') return 'text-red-500 bg-red-500/10 border-red-500/20';
        if (status === 'recovering') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        
        // Stale check
        const lastHb = new Date(lastHeartbeat).getTime();
        if (Date.now() - lastHb > 2 * 60 * 60 * 1000) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    };

    const getStatusIcon = (status, lastHeartbeat) => {
        if (status === 'failed') return <AlertCircle className="w-4 h-4" />;
        if (status === 'recovering') return <RefreshCw className="w-4 h-4 animate-spin-slow" />;
        const lastHb = new Date(lastHeartbeat).getTime();
        if (Date.now() - lastHb > 2 * 60 * 60 * 1000) return <Clock className="w-4 h-4" />;
        return <CheckCircle2 className="w-4 h-4" />;
    };

    const formatLastSync = (ts) => {
        const date = new Date(ts);
        return date.toLocaleString();
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Nexus Health Monitor</h2>
                        <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Active Telegram Alerts Enabled</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={fetchHealth}
                    disabled={refreshing}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-all text-slate-400 hover:text-white disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {healthData.map((svc) => (
                    <div key={svc.service_key} className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter font-mono">
                                {svc.service_key.replace('-', ' ')}
                            </span>
                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${getStatusColor(svc.status, svc.last_heartbeat)}`}>
                                {getStatusIcon(svc.status, svc.last_heartbeat)}
                                {svc.status === 'recovering' ? `Healing ${svc.metadata?.consecutive_success || 0}/3` : 
                                 (svc.status === 'healthy' && (Date.now() - new Date(svc.last_heartbeat).getTime() > 2 * 60 * 60 * 1000) ? 'STALE' : svc.status)}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px] font-mono">{formatLastSync(svc.last_heartbeat)}</span>
                            </div>
                            {svc.last_error && (
                                <div className="mt-2 p-2 bg-red-500/5 border border-red-500/10 rounded-lg flex gap-2">
                                    <ShieldAlert className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-[9px] text-red-400 font-mono break-all line-clamp-2">{svc.last_error}</p>
                                </div>
                            )}
                            
                            {(svc.status === 'failed' || svc.status === 'recovering' || (Date.now() - new Date(svc.last_heartbeat).getTime() > 2 * 60 * 60 * 1000)) && (
                                <button
                                    onClick={() => handleReset(svc.service_key)}
                                    className="mt-3 w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black text-white uppercase transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Manual Reset Health
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-4">
                <div className="p-2 bg-indigo-500/20 rounded-xl">
                    <ShieldAlert className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wide">Circuit Breaker Policy</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                        Services marked as <strong>FAILED</strong> will automatically trigger the Circuit Breaker in the API layer. 
                        Connections to external providers (Neynar, X) will be suspended for 5 minutes after a failure to prevent account banning 
                        and system overload. Manual intervention may be required if errors persist.
                    </p>
                </div>
            </div>
        </div>
    );
}
