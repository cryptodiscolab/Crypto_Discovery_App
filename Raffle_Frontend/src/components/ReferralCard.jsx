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
        const text = encodeURIComponent(`Join me on Crypto Disco! 🕺💃\n\nPlay Gacha, Claim XP, and share revenue directly. No Riba, just honest fun.\n\nJoin here:`);
        window.open(`https://warpcast.com/~/compose?text=${text}&embeds[]=${encodeURIComponent(refLink)}`, '_blank');
    };

    return (
        <div className="glass-card p-6 rounded-[2.5rem] border border-indigo-500/20 bg-indigo-500/5 overflow-hidden relative group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-indigo-500/10 blur-[80px] pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700"></div>

            <div className="flex flex-col md:flex-row gap-6 items-center relative z-10 text-left">
                {/* Stats Section */}
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="flex-1 md:flex-none p-4 bg-black/40 border border-white/5 rounded-3xl text-center min-w-[100px]">
                        <div className="flex justify-center mb-1 text-indigo-400">
                            <Users className="w-4 h-4" />
                        </div>
                        <div className="text-xl font-black text-white">{isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : stats.total}</div>
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Invites</div>
                    </div>
                    <div className="flex-1 md:flex-none p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl text-center min-w-[100px]">
                        <div className="flex justify-center mb-1 text-emerald-400">
                            <Zap className="w-4 h-4" />
                        </div>
                        <div className="text-xl font-black text-emerald-400">{isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : stats.active}</div>
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Members</div>
                    </div>
                </div>

                {/* Info & Action Section */}
                <div className="flex-1 text-center md:text-left">
                    <h4 className="text-sm font-black text-white italic uppercase tracking-tighter mb-1">
                        Grow the <span className="text-indigo-400">Ecosystem</span>
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 mb-4 leading-relaxed max-w-[280px]">
                        Invite friends. Earn <span className="text-indigo-400 font-extrabold">{BONUS}% XP bonus</span> from their activities forever!
                    </p>

                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied!' : 'Copy Link'}
                        </button>

                        <button
                            onClick={shareFarcaster}
                            className="flex items-center gap-2 px-4 py-2 bg-[#472a91] hover:bg-[#5c37bd] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-900/20"
                        >
                            <Share2 className="w-3 h-3" /> Warpcast
                        </button>
                    </div>
                </div>
            </div>

            {/* Footnote */}
            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex items-center gap-2 text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                    <Trophy className="w-3 h-3 text-yellow-500/50" />
                    Active member = XP {'>'} {THRESHOLD}
                </div>
                <div className="text-[8px] font-black text-indigo-400/50 uppercase tracking-widest flex items-center gap-1 cursor-help hover:text-indigo-400 transition-colors">
                    T&C Applied <ExternalLink className="w-2 h-2" />
                </div>
            </div>
        </div>
    );
};
