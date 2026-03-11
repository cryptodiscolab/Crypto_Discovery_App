import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Activity, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { useAccount, useSignMessage, useReadContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../../lib/contracts';
import toast from 'react-hot-toast';

export function EconomyMetrics() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check Verifier Role in Contract
    const VERIFIER_ADDRESS = "0x52260c30697674a7C837FEB2af21bBf3606795C8"; // Standard Verifier
    const { data: hasVerifierRole } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasRole',
        args: ["0x3d0613dc01850387e388c60f1ad9250000000000000000000000000000000000", VERIFIER_ADDRESS] // VERIFIER_ROLE hash
    });

    const fetchStats = async () => {
        if (!address) return;
        setLoading(true);
        try {
            const timestamp = new Date().toISOString();
            const message = `Fetch Economy Stats\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const res = await fetch('/api/admin/economy-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, signature, message })
            });
            const data = await res.json();
            if (data.success) {
                setStats(data.metrics);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // We no longer auto-fetch on mount to prevent annoying MetaMask popups
        // when navigating between admin tabs.
        // fetchStats(); 
    }, [address]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 1. Revenue Card */}
            <div className="glass-card p-6 bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-full">Revenue</span>
                </div>
                <h4 className="text-3xl font-black text-white mb-1">
                    {!stats ? '----' : `$${stats?.totalRevenueUSDC || '0.00'}`}
                </h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Gross Listing Revenue (USDC)</p>
            </div>

            {/* 2. Profit Margin Card */}
            <div className="glass-card p-6 bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded-full">P&L</span>
                </div>
                <h4 className="text-3xl font-black text-white mb-1">
                    {!stats ? '----' : `$${stats?.netProfit || '0.00'}`}
                </h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Estimated Net Profit (70% Margin)</p>
            </div>

            {/* 3. XP Liability / Community Engagement */}
            <div className="glass-card p-6 bg-purple-500/5 border border-purple-500/10 hover:border-purple-500/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 group-hover:scale-110 transition-transform">
                        <Activity className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest bg-purple-500/10 px-2 py-1 rounded-full">Engagement</span>
                </div>
                <h4 className="text-3xl font-black text-white mb-1">
                    {!stats ? '----' : (stats?.communityXp / 1000).toFixed(1) + 'k'}
                </h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Total XP Distributed to Users</p>
            </div>

            {/* 4. System Health / Verifier Status */}
            <div className={`glass-card p-6 border transition-all group ${hasVerifierRole ? 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/30' : 'bg-red-500/5 border-red-500/20 shadow-red-500/10 shadow-lg'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl group-hover:scale-110 transition-transform ${hasVerifierRole ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                        {hasVerifierRole ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6 animate-pulse" />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${hasVerifierRole ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
                        System Health
                    </span>
                </div>
                <h4 className={`text-xl font-black mb-1 ${hasVerifierRole ? 'text-white' : 'text-red-400'}`}>
                    {hasVerifierRole ? 'Verifier Optimal' : 'Verifier Unauthorized'}
                </h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                    {hasVerifierRole ? 'Security protocols active' : 'CRITICAL: Authorize verifier in Hub'}
                </p>
            </div>

            <button
                onClick={fetchStats}
                className={`md:col-span-3 lg:col-span-4 py-3 border rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 transition-all mt-2 ${!stats
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/30'
                    : 'bg-slate-900/50 hover:bg-slate-900/80 border-white/5 text-slate-500'
                    }`}
            >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                {!stats ? 'UNLOCK COMMAND CENTER (REQUIRES SIGNATURE)' : 'REFRESH METRICS'}
            </button>
        </div>
    );
}
