import { useState } from 'react';
import { ShieldCheck, Award, Crown, Check, Loader2 } from 'lucide-react';
import { ProfileData } from '../types';
import toast from 'react-hot-toast';

interface ProfileStatsProps {
    profileData: ProfileData;
    linkGoogle: () => Promise<{ success?: boolean } | void>;
    linkX: () => Promise<{ success?: boolean } | void>;
    isOAuthLinking: boolean;
    fetchProfile: () => void;
    syncFarcaster: (address: string, force?: boolean) => Promise<any>;
    syncBaseSocial: (address: string) => Promise<any>;
}

// Custom Official Logos SVGs (Premium Branding)
const GoogleIcon = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
    </svg>
);

const XIcon = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const FarcasterIcon = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 1000 1000" fill="currentColor">
        <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z" />
        <path d="M377.778 844.445H622.222V528.889H377.778V844.445Z" />
    </svg>
);

const BaseIcon = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm3.5-7c0 1.93-1.57 3.5-3.5 3.5S8.5 13.93 8.5 12s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5z" />
    </svg>
);

/**
 * ProfileStats Component
 * [v3.65.0] Modular Feature-Based Architecture - Interactive Verification Badges with Official Logos
 */
export const ProfileStats = ({
    profileData,
    linkGoogle,
    linkX,
    isOAuthLinking,
    fetchProfile,
    syncFarcaster,
    syncBaseSocial
}: ProfileStatsProps) => {
    const [isFarcasterSyncing, setIsFarcasterSyncing] = useState(false);
    const [isBaseSyncing, setIsBaseSyncing] = useState(false);

    const userWalletAddress = profileData.wallet_address || profileData.wallet_address;

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
                <h3 className="text-[9px] font-black tracking-widest text-slate-500 uppercase mb-3 px-1">IDENTITY VERIFICATION</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Google */}
                    <button
                        onClick={async () => {
                            if (profileData.google_id) return;
                            const res = await linkGoogle();
                            if (res && 'success' in res && res.success) fetchProfile();
                        }}
                        disabled={isOAuthLinking || !!profileData.google_id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                            profileData.google_id
                                ? 'bg-blue-500/5 border-blue-500/20 text-blue-400 cursor-default'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]'
                        }`}
                    >
                        <GoogleIcon />
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-tight">GOOGLE</p>
                            <p className="text-[9px] font-bold text-slate-500 truncate uppercase mt-0.5">
                                {profileData.google_id ? 'CONNECTED' : 'NOT LINKED'}
                            </p>
                        </div>
                        {profileData.google_id && <Check size={12} className="text-blue-400 shrink-0" />}
                    </button>

                    {/* Twitter / X */}
                    <button
                        onClick={async () => {
                            if (profileData.twitter_id) return;
                            const res = await linkX();
                            if (res && 'success' in res && res.success) fetchProfile();
                        }}
                        disabled={isOAuthLinking || !!profileData.twitter_id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                            profileData.twitter_id
                                ? 'bg-white/5 border-white/20 text-white cursor-default'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]'
                        }`}
                    >
                        <XIcon className="w-3.5 h-3.5 text-white" />
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-tight">X (TWITTER)</p>
                            <p className="text-[9px] font-bold text-slate-500 truncate uppercase mt-0.5">
                                {profileData.twitter_id ? 'CONNECTED' : 'NOT LINKED'}
                            </p>
                        </div>
                        {profileData.twitter_id && <Check size={12} className="text-white shrink-0" />}
                    </button>

                    {/* Farcaster */}
                    <button
                        onClick={async () => {
                            const isLinked = profileData.fid && profileData.fid !== 'N/A';
                            if (isLinked) return;
                            if (!userWalletAddress) return toast.error("Connect wallet first!");
                            setIsFarcasterSyncing(true);
                            const toastId = toast.loading("Syncing Farcaster Identity...");
                            try {
                                const res = await syncFarcaster(userWalletAddress, true);
                                if (res?.fid) {
                                    toast.success("Farcaster linked successfully! 🎉", { id: toastId });
                                    fetchProfile();
                                } else {
                                    toast.error("No Farcaster profile matches this wallet.", { id: toastId });
                                }
                            } catch (e: any) {
                                toast.error("Farcaster sync failed: " + (e.message || "Unknown error"), { id: toastId });
                            } finally {
                                setIsFarcasterSyncing(false);
                            }
                        }}
                        disabled={isFarcasterSyncing || (!!profileData.fid && profileData.fid !== 'N/A')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                            profileData.fid && profileData.fid !== 'N/A'
                                ? 'bg-[#8a63d2]/5 border-[#8a63d2]/20 text-[#8a63d2] cursor-default'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]'
                        }`}
                    >
                        {isFarcasterSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8a63d2]" /> : <FarcasterIcon className="w-3.5 h-3.5 text-[#8a63d2]" />}
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-tight">FARCASTER</p>
                            <p className="text-[9px] font-bold text-slate-500 truncate uppercase mt-0.5">
                                {profileData.fid && profileData.fid !== 'N/A' ? `FID: ${profileData.fid}` : 'NOT LINKED'}
                            </p>
                        </div>
                        {profileData.fid && profileData.fid !== 'N/A' && <Check size={12} className="text-[#8a63d2] shrink-0" />}
                    </button>

                    {/* Base Social / Basename */}
                    <button
                        onClick={async () => {
                            if (profileData.is_base_social_verified) return;
                            if (!userWalletAddress) return toast.error("Connect wallet first!");
                            setIsBaseSyncing(true);
                            const toastId = toast.loading("Checking Basename registry...");
                            try {
                                const res = await syncBaseSocial(userWalletAddress);
                                if (res?.success) {
                                    toast.success(`Basename linked: ${res.basename} 🔵`, { id: toastId });
                                    fetchProfile();
                                } else {
                                    toast.error("No Basename registered to this address.", { id: toastId });
                                }
                            } catch (e: any) {
                                toast.error(e.message || "Basename lookup failed.", { id: toastId });
                            } finally {
                                setIsBaseSyncing(false);
                            }
                        }}
                        disabled={isBaseSyncing || !!profileData.is_base_social_verified}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                            profileData.is_base_social_verified
                                ? 'bg-[#0052ff]/5 border-[#0052ff]/20 text-[#0052ff] cursor-default'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]'
                        }`}
                    >
                        {isBaseSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0052ff]" /> : <BaseIcon className="w-3.5 h-3.5 text-[#0052ff]" />}
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-tight">BASE SOCIAL</p>
                            <p className="text-[9px] font-bold text-slate-500 truncate uppercase mt-0.5">
                                {profileData.is_base_social_verified ? (profileData.base_username || 'VERIFIED') : 'NOT LINKED'}
                            </p>
                        </div>
                        {profileData.is_base_social_verified && <Check size={12} className="text-[#0052ff] shrink-0" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
