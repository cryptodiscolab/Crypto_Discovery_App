import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Zap, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

/**
 * HypeFeed: 24/7 AI-Driven Movement Feed
 * Standard: Showcases growth, tier ups, and big wins to create FOMO and social proof.
 */
export const HypeFeed = () => {
    const [activities, setActivities] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        fetchRecentActivity();
        const fetchInterval = setInterval(fetchRecentActivity, 30000); // 30s
        return () => clearInterval(fetchInterval);
    }, []);

    useEffect(() => {
        if (activities.length === 0) return;
        const rotateInterval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % activities.length);
        }, 5000); // 5s rotate
        return () => clearInterval(rotateInterval);
    }, [activities]);

    const fetchRecentActivity = async () => {
        try {
            // 1. Fetch real activities
            const { data: logs, error: logError } = await supabase
                .from('user_activity_logs')
                .select('id, description, activity_type, created_at, wallet_address')
                .order('created_at', { ascending: false })
                .limit(10);

            if (logError) throw logError;
            if (!logs || logs.length === 0) {
                setActivities([]);
                return;
            }

            // 2. Fetch identities from the Master View (Mandate Alignment)
            const wallets = [...new Set(logs.map(l => l.wallet_address.toLowerCase()))];
            const { data: profiles, error: profileError } = await supabase
                .from('v_user_full_profile')
                .select('wallet_address, display_name, username, pfp_url')
                .in('wallet_address', wallets);

            if (profileError) {
                console.warn('[HypeFeed] View fetch failed, using fallback:', profileError);
            }

            // 3. Transform into feed items with joined data
            const profileMap = (profiles || []).reduce((acc, p) => {
                acc[p.wallet_address.toLowerCase()] = p;
                return acc;
            }, {});

            const feed = logs.map(log => {
                const user = profileMap[log.wallet_address.toLowerCase()];
                return {
                    id: log.id,
                    name: user?.display_name || user?.username || `${log.wallet_address.slice(0, 4)}...${log.wallet_address.slice(-4)}`,
                    avatar: user?.pfp_url,
                    message: log.description || "is active in the Nexus",
                    type: 'activity'
                };
            });

            setActivities(feed);
        } catch (e) {
            console.error('[HypeFeed] Error:', e);
        }
    };


    if (activities.length === 0) return null;

    const current = activities[currentIndex];

    return (
        <div className="w-full bg-indigo-600/10 border-y border-indigo-500/10 py-2 overflow-hidden relative">
            <div className="max-w-screen-md mx-auto px-4 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 h-6">
                <div className="flex items-center gap-2">
                    {current.avatar ? (
                        <img src={current.avatar} alt="" className="w-4 h-4 rounded-full border border-indigo-500/20" />
                    ) : (
                        <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
                            <Users size={8} className="text-indigo-400" />
                        </div>
                    )}
                    <span className="text-[10px] font-black text-white italic uppercase tracking-tighter">
                        {current.name}
                    </span>
                </div>
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest leading-none">
                    {current.message}
                </span>
                <div className="flex items-center gap-1 ml-1">
                    <Zap size={10} className="text-yellow-500 animate-pulse" />
                    <span className="text-[8px] font-black text-indigo-400/50 uppercase tracking-[0.2em]">LIVE</span>
                </div>
            </div>

            {/* Subtle light streak */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}} />
        </div>
    );
};
