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

    const hypeMessages = [
        "is hunting for XP! 🔥",
        "just claimed a Daily Bonus! 💎",
        "is climbing the Leaderboard! 📈",
        "just verified a Task! ✅",
        "is eyeing the Diamond Tier! 👑"
    ];

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
            // Fetch recent task claims
            const { data, error } = await supabase
                .from('v_user_full_profile') // Use view for better data
                .select('wallet_address, display_name, username, pfp_url, total_xp')
                .gt('total_xp', 0)
                .order('total_xp', { ascending: false }) // Just pick some active users for the "vibe"
                .limit(10);

            if (error) throw error;

            // Transform into feed items
            const feed = (data || []).map(user => ({
                id: user.wallet_address,
                name: user.display_name || user.username || `${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-4)}`,
                avatar: user.pfp_url,
                message: hypeMessages[Math.floor(Math.random() * hypeMessages.length)],
                type: 'activity'
            }));

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
