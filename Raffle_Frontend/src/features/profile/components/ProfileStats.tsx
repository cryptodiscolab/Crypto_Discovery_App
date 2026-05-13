import { ShieldCheck, Award, Crown, Mail, Twitter, Check } from 'lucide-react';
import { ProfileData } from '../types';

interface ProfileStatsProps {
    profileData: ProfileData;
    linkGoogle: () => Promise<{ success?: boolean } | void>;
    linkX: () => Promise<{ success?: boolean } | void>;
    isOAuthLinking: boolean;
    fetchProfile: () => void;
}

/**
 * ProfileStats Component
 * [v3.61.0] Modular Feature-Based Architecture - Hardened Types
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
            <div className="flex flex-col bg-zinc-900/40 backdrop-blur-xl border-y border-white/5 mb-6 divide-y divide-white/5">
                {/* Neynar Score */}
                <div className="flex items-center justify-between px-6 py-5 group hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform duration-500"><ShieldCheck size={20} /></div>
                        <div>
                            <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">NEYNAR SCORE</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">REPUTATION HEALTH</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`text-2xl font-mono font-black italic tracking-tighter ${((profileData.neynarScore ?? profileData.neynar_score ?? 0)) >= 0.9 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {(((profileData.neynarScore ?? profileData.neynar_score ?? 0)) * 100).toFixed(1)}%
                        </span>
                    </div>
                </div>
                
                {/* Total XP */}
                <div className="flex items-center justify-between px-6 py-5 group hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-2xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 group-hover:scale-110 transition-transform duration-500"><Award size={20} /></div>
                        <div>
                            <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">TOTAL XP</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SEASON PROGRESS</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-mono font-black text-white italic tracking-tighter">{Number(profileData.total_xp ?? 0).toLocaleString()}</span>
                    </div>
                </div>

                {/* Rank */}
                <div className="flex items-center justify-between px-6 py-5 group hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform duration-500"><Crown size={20} /></div>
                        <div>
                            <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">CURRENT RANK</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">LEADERBOARD TIER</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent italic tracking-tighter">{(profileData.rankName || profileData.rank_name || 'ROOKIE').toUpperCase()}</span>
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
