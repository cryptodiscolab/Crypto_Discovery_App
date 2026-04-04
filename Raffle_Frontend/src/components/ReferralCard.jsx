import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Share2, Users, Trophy, Zap, Check, ExternalLink, Loader2 } from 'lucide-react';
import { referralUtils } from '../utils/referralUtils';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { useAccount } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';

/**
 * ReferralCard: Premium UI for Viral Growth
 * Features: Copy link, Farcaster/X Intents, Activity Tracking
 */
export const ReferralCard = () => {
    const { address } = useAccount();
    const { ecosystemSettings } = usePoints();
    const [stats, setStats] = useState({ total: 0, active: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const THRESHOLD = ecosystemSettings?.referral_active_threshold || 500;
    const BONUS = ecosystemSettings?.referral_bonus_percent || 10;
    const refLink = referralUtils.generateLink(address);

    const fetchReferralStats = useCallback(async () => {
        if (!address) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            // 1. Fetch total referrals
            const { count, error } = await supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('referred_by', address.toLowerCase());

            if (error) throw error;

            // 2. Fetch active referrals using dynamic threshold
            const { count: activeCount, error: activeError } = await supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('referred_by', address.toLowerCase())
                .gt('total_xp', THRESHOLD);

            if (activeError) throw activeError;

            setStats({ total: count || 0, active: activeCount || 0 });
        } catch (e) {
            console.error('[ReferralStats] Error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [address, THRESHOLD]);

    useEffect(() => {
        fetchReferralStats();
    }, [fetchReferralStats]);

    const handleCopy = () => {
        navigator.clipboard.writeText(refLink);
        setCopied(true);
        toast.success("Referral link copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    const shareFarcaster = () => {
        const text = encodeURIComponent(`Stop being exit liquidity. 🕺💃\n\nJoin the Nexus Economy v3.41.2 at Crypto Disco. Real yield, real game, real XP.\n\nClaim your spot:`);
        window.open(`https://warpcast.com/~/compose?text=${text}&embeds[]=${encodeURIComponent(refLink)}`, '_blank');
    };

    const shareTwitter = () => {
        const text = encodeURIComponent(`Stop being exit liquidity. 🕺💃\n\nJoin the Nexus Economy v3.41.2 at Crypto Disco. Real yield, real game, real XP.\n\nClaim your spot here: ${refLink}\n\n#Base #CryptoDisco #NexusEconomy`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    };

    const shareBaseApp = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Crypto Disco - Nexus Economy',
                    text: 'Join the Nexus Economy v3.41.2. Real yield, real game, real XP.',
                    url: refLink,
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            handleCopy();
        }
    };

    return (
        <div className="glass-card p-6 md:p-8 rounded-[2.5rem] border border-indigo-500/20 bg-indigo-500/5 overflow-hidden relative group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-indigo-500/10 blur-[80px] pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700"></div>

            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10 text-left">
                {/* 1. Promo Section */}
                <div className="flex-1">
                    <h4 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">
                        GROW THE <span className="text-indigo-400">ECOSYSTEM</span>
                    </h4>
                    <p className="text-[11px] font-black text-slate-500 mb-6 leading-relaxed max-w-[320px] uppercase tracking-widest">
                        INVITE FRIENDS. EARN <span className="text-indigo-400 font-extrabold">{BONUS}% XP BONUS</span> FROM THEIR ACTIVITIES FOREVER!
                    </p>

                    {/* How it Works / Flow Explanation */}
                    <div className="space-y-4 mb-6">
                        <h5 className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">How it Works</h5>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { step: "01", text: "COPY & SHARE YOUR LINK", icon: <Share2 className="w-3 h-3" /> },
                                { step: "02", text: "FRIENDS JOIN DISCO APP", icon: <Users className="w-3 h-3" /> },
                                { step: "03", text: `THEY REACH ${THRESHOLD} XP`, icon: <Zap className="w-3 h-3" /> },
                                { step: "04", text: `${BONUS}% PASSIVE BONUS UNLOCKED`, icon: <Trophy className="w-3 h-3 text-yellow-500" /> },
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-black/20 p-2.5 rounded-2xl border border-white/5 group/step hover:border-indigo-500/30 transition-all">
                                    <span className="text-[9px] font-black text-indigo-500/50 group-hover/step:text-indigo-400 transition-colors w-4">{item.step}</span>
                                    <div className="p-1.5 bg-indigo-500/5 rounded-lg border border-white/5 text-indigo-400">
                                        {item.icon}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'COPIED!' : 'COPY LINK'}
                        </button>

                        <button
                            onClick={shareBaseApp}
                            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
                        >
                            <Zap className="w-4 h-4 fill-current" /> BASE APP
                        </button>

                        <button
                            onClick={shareFarcaster}
                            className="flex items-center gap-2 px-5 py-3 bg-[#472a91] hover:bg-[#5c37bd] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg"
                        >
                            <Share2 className="w-3 h-3" /> WARPCAST
                        </button>
                    </div>
                </div>

                {/* 2. Stats Section */}
                <div className="flex flex-col gap-3 w-full md:w-auto">
                    <div className="p-6 bg-black/40 border border-white/5 rounded-[2rem] text-center min-w-[160px] relative overflow-hidden group/card shadow-2xl">
                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
                        <div className="flex justify-center mb-2 text-indigo-400">
                            <Users className="w-6 h-6" />
                        </div>
                        <div className="text-3xl font-black text-white">{isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : stats.total}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Invites</div>
                    </div>
                    
                    <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] text-center min-w-[160px] relative overflow-hidden group/card shadow-2xl">
                        <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
                        <div className="flex justify-center mb-2 text-emerald-400">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div className="text-3xl font-black text-emerald-400">{isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : stats.active}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Active</div>
                    </div>
                </div>
            </div>

            {/* Footnote */}
            <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    <Trophy className="w-3 h-3 text-yellow-500/50" />
                    ACTIVE MEMBER = {THRESHOLD} XP REACHED
                </div>
                <div className="text-[10px] font-black text-indigo-400/50 uppercase tracking-widest flex items-center gap-1 cursor-help hover:text-indigo-400 transition-colors">
                    TERMS & CONDITIONS <ExternalLink className="w-2 h-2" />
                </div>
            </div>
        </div>
    );
};
