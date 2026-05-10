import { ShieldCheck, Award, Crown, Mail, Twitter, Check } from 'lucide-react';

interface ProfileData {
    neynarScore?: number;
    total_xp?: number;
    rankName?: string;
    google_id?: string | null;
    twitter_id?: string | null;
    fid?: string | number | null;
}

interface ProfileStatsProps {
    profileData: ProfileData;
    linkGoogle: () => Promise<{ success?: boolean } | void>;
    linkX: () => Promise<{ success?: boolean } | void>;
    isOAuthLinking: boolean;
    fetchProfile: () => void;
}

/**
 * ProfileStats Component
 * [v3.60.0] Modular Feature-Based Architecture
 */
export const ProfileStats = ({
    profileData,
    linkGoogle,
    linkX,
    isOAuthLinking,
    fetchProfile
}: ProfileStatsProps) => {
    return (
        <div className="max-w-screen-md mx-auto">
            {/* STATS LIST */}
            <div className="flex flex-col bg-[#080808] border-y border-white/5 mb-6">
                {/* Neynar Score */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20"><ShieldCheck size={20} /></div>
                        <div>
                            <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">NEYNER SCORE</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">REPUTATION HEALTH</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`text-xl font-mono font-black ${(profileData.neynarScore ?? 0) >= 0.9 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {((profileData.neynarScore ?? 0) * 100).toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Total XP */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><Award size={20} /></div>
                        <div>
                            <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">TOTAL XP</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SEASON PROGRESS</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xl font-mono font-black text-white">{Number(profileData.total_xp ?? 0).toLocaleString()}</span>
                    </div>
                </div>

                {/* Rank */}
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20"><Crown size={20} /></div>
                        <div>
                            <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">CURRENT RANK</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">LEADERBOARD TIER</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xl font-black text-blue-400 italic">{profileData.rankName?.toUpperCase() || 'ROOKIE'}</span>
                    </div>
                </div>
            </div>

            {/* SOCIAL IDENTITY BADGES */}
            <div className="px-4 mb-6">
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={async () => {
                            if (profileData.google_id) return;
                            const res = await linkGoogle();
                            if (res && 'success' in res && res.success) fetchProfile();
                        }}
                        disabled={isOAuthLinking || !!profileData.google_id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${profileData.google_id ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-default' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 active:scale-95'}`}
                    >
                        <Mail size={14} />
                        <span className="label-native">{profileData.google_id ? 'GOOGLE LINKED' : 'LINK GOOGLE'}</span>
                        {profileData.google_id && <Check size={10} className="text-blue-400" />}
                    </button>

                    <button
                        onClick={async () => {
                            if (profileData.twitter_id) return;
                            const res = await linkX();
                            if (res && 'success' in res && res.success) fetchProfile();
                        }}
                        disabled={isOAuthLinking || !!profileData.twitter_id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${profileData.twitter_id ? 'bg-white/10 border-white/20 text-white cursor-default' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 active:scale-95'}`}
                    >
                        <Twitter size={14} />
                        <span className="label-native">{profileData.twitter_id ? 'X LINKED' : 'LINK X (TWITTER)'}</span>
                        {profileData.twitter_id && <Check size={10} className="text-white" />}
                    </button>

                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${profileData.fid && profileData.fid !== 'N/A' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-zinc-900 border-white/5 text-zinc-600'}`}>
                        <span className="label-native">FARCASTER {profileData.fid && profileData.fid !== 'N/A' ? 'LINKED' : 'NOT LINKED'}</span>
                        {profileData.fid && profileData.fid !== 'N/A' && <Check size={10} className="text-indigo-400" />}
                    </div>
                </div>
            </div>
        </div>
    );
};
