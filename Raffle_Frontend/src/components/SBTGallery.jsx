import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Award, Shield, Star, Crown, Zap, Clock } from 'lucide-react';
import { useAccount } from 'wagmi';

export function SBTGallery({ walletAddress }) {
    const { address: currentAddress } = useAccount();
    const targetAddress = walletAddress || currentAddress;
    const [history, setHistory] = useState([]);
    const [weights, setWeights] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const levels = ["None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];
    const tierIcons = [
        null,
        <Shield key="tier-1" className="w-8 h-8 text-orange-400" />,
        <Shield key="tier-2" className="w-8 h-8 text-slate-300" />,
        <Star key="tier-3" className="w-8 h-8 text-yellow-400" />,
        <Crown key="tier-4" className="w-8 h-8 text-indigo-300" />,
        <Crown key="tier-5" className="w-8 h-8 text-blue-400" />
    ];

    useEffect(() => {
        if (targetAddress) {
            fetchHistory();
            fetchWeights();
        }
    }, [targetAddress]);

    const fetchWeights = async () => {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'tier_pool_weights')
            .single();
        if (data?.value) setWeights(data.value);
    };

    const fetchHistory = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('user_season_history')
            .select(`
                *,
                seasons (
                    name,
                    started_at,
                    ended_at
                )
            `)
            .eq('wallet_address', targetAddress.toLowerCase())
            .order('season_id', { ascending: false });

        if (!error && data) setHistory(data);
        setIsLoading(false);
    };

    const getTierWeightLabel = (tierId) => {
        const tierNames = ["none", "bronze", "silver", "gold", "platinum", "diamond"];
        const name = tierNames[tierId];
        const val = weights[name];
        if (!val) return "---";
        // If BP, convert to % if appropriate, or just show raw weight
        // Contract usually uses raw weights for distribution
        return `${val} weight`;
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-slate-800/50 rounded-2xl border border-white/5" />
                ))}
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="p-8 text-center bg-slate-900/40 rounded-3xl border border-white/5">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="text-slate-500 w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-400">No Season History</h4>
                <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest font-black">Your journey begins this season.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                <Award className="w-3 h-3" /> Soulbound Achievement Gallery
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {history.map((h) => (
                    <div key={h.id} className="glass-card group relative p-5 bg-gradient-to-br from-slate-900 to-black border border-white/5 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all duration-500">
                        {/* Status Label */}
                        <div className="absolute top-3 right-3">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 group-hover:text-indigo-400 transition-colors">
                                S{h.season_id}
                            </span>
                        </div>

                        {/* Icon Container */}
                        <div className="mb-4 relative">
                            <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full scale-50 group-hover:scale-100 transition-transform" />
                            <div className="relative z-10 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:rotate-6 transition-transform">
                                {tierIcons[h.final_tier] || <Shield className="w-8 h-8 text-slate-600" />}
                            </div>
                        </div>

                        {/* Text */}
                        <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                            {levels[h.final_tier]} Peak
                        </h4>
                        <p className="text-[9px] text-slate-500 font-bold uppercase truncate">
                            {h.seasons?.name || `Season ${h.season_id}`}
                        </p>

                        {/* Hover Overlay info */}
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[8px] text-slate-600 font-black uppercase">
                                <Zap className="w-2 h-2" /> {h.xp_at_reset?.toLocaleString() || 0} XP
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] font-black text-indigo-400/60 uppercase">
                                    {getTierWeightLabel(h.final_tier)}
                                </span>
                                <div className="w-2 h-2 rounded-full bg-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
