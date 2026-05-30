import { useState, useEffect } from 'react';
import { Users, Zap } from 'lucide-react';

/**
 * HypeFeed: 24/7 AI-Driven Movement Feed
 * Standard: Showcases growth, tier ups, and big wins to create FOMO and social proof.
 */
interface FeedItem {
    id: string | number;
    name: string;
    avatar?: string;
    message: string;
    type: 'activity';
}

export const HypeFeed = () => {
    const [activities, setActivities] = useState<FeedItem[]>([]);
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
            const res = await fetch('/api/user-bundle?action=get-public-activity-feed&limit=10');
            if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
            const json = await res.json();
            const feed = Array.isArray(json?.activities) ? (json.activities as FeedItem[]) : [];

            setActivities(feed);
        } catch (e: unknown) {
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
                    <span className="text-[11px] font-black text-white italic uppercase tracking-widest shrink-0">
                        {current.name.toUpperCase()}
                    </span>
                </div>
                <span className="text-[11px] font-black text-indigo-300 uppercase tracking-widest leading-none truncate overflow-hidden">
                    {current.message.toUpperCase()}
                </span>
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <Zap size={10} className="text-yellow-500 animate-pulse" />
                    <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">LIVE</span>
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
