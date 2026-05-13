import { Star, Loader2, Users, ShieldCheck, Sparkles, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProfileData, OnChainUserData } from '../types';

interface ProfileHeaderProps {
    profileData: ProfileData;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    isSaving: boolean;
    handleSaveProfile: () => void;
    syncUser: (address: string, force?: boolean) => Promise<any>;
    isFarcasterLoading: boolean;
    address?: string;
    onChainUserData?: OnChainUserData;
    potentialTier?: number;
    setActiveModal: (modal: string | null) => void;
    setProfileData: (data: ProfileData) => void;
}

/**
 * ProfileHeader Component
 * [v3.61.0] Modular Feature-Based Architecture - Hardened Types
 */
export const ProfileHeader = ({
    profileData,
    isEditing,
    setIsEditing,
    isSaving,
    handleSaveProfile,
    syncUser,
    isFarcasterLoading,
    address,
    onChainUserData,
    setActiveModal,
    setProfileData
}: ProfileHeaderProps) => {
    return (
        <div className="max-w-screen-md mx-auto">
            <div className="px-4 pt-6 pb-4">
                <div className="flex justify-between items-start mb-4">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-[#050505] overflow-hidden border-2 border-white/10 shadow-xl">
                            {(profileData.avatarUrl || profileData.pfp_url) ? (
                                <img src={profileData.avatarUrl || profileData.pfp_url} alt="Avatar" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-900">
                                    <Users size={32} />
                                </div>
                            )}
                        </div>
                        {profileData.powerBadge && (
                            <div className="absolute -bottom-1 -right-1 bg-[#0B0E14] rounded-full p-1">
                                <Star size={16} className="text-yellow-400 fill-current" />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2 items-center">
                        {!isEditing ? (
                            <>
                                <button
                                    onClick={async () => {
                                        if (!address) return toast.error("Please connect your wallet!");
                                        const toastId = toast.loading("Syncing Identity...");
                                        try {
                                            const synced = await syncUser(address, true);
                                            if (synced?.fid) {
                                                toast.success("Identity synced! 🎉", { id: toastId });
                                            } else {
                                                toast.error("Farcaster account not found.", { id: toastId });
                                            }
                                        } catch (e: any) {
                                            toast.error("Sync failed: " + (e.message || "Unknown error"), { id: toastId });
                                        }
                                    }}
                                    disabled={isFarcasterLoading}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${!profileData.fid ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95' : 'bg-zinc-800/50 text-zinc-300 border border-white/5 hover:bg-zinc-700'}`}
                                >
                                    {isFarcasterLoading ? <Loader2 className="animate-spin w-4 h-4" /> : (
                                        <>
                                            {!profileData.fid ? "SYNC IDENTITY" : <RefreshCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />}
                                            {!profileData.fid ? "" : "REFRESH"}
                                        </>
                                    )}
                                </button>
                                <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 rounded-full border border-white/20 label-native hover:bg-white/10 active:scale-95 transition-transform">
                                    EDIT
                                </button>
                                <a href="https://farcaster.xyz/~/code/CJ393F" target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 active:scale-90 transition-all">
                                    <Sparkles size={18} />
                                </a>
                            </>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditing(false)} className="px-4 py-1.5 rounded-full border border-red-500/50 text-red-400 label-native active:scale-95 transition-transform">CANCEL</button>
                                <button onClick={handleSaveProfile} disabled={isSaving} className="px-4 py-1.5 rounded-full bg-white text-black label-native active:scale-95 transition-transform">
                                    {isSaving ? "SAVING..." : "SAVE"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {isEditing ? (
                        <div className="space-y-1">
                            <p className="text-[11px] font-black text-white uppercase tracking-widest opacity-60">Avatar URL</p>
                            <input
                                type="url"
                                value={profileData.avatarUrl || ''}
                                onChange={(e) => setProfileData({ ...profileData, avatarUrl: e.target.value })}
                                className="input-native"
                                placeholder="https://example.com/my-avatar.gif"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-white uppercase tracking-tighter italic leading-none">{profileData.displayName || profileData.display_name || 'ANONYMOUS DISCO'}</h2>
                            {profileData.is_base_social_verified && (
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600">
                                    <ShieldCheck size={12} className="text-white" />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-black uppercase tracking-widest">
                        <span className="label-native text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            TIER {onChainUserData?.currentTier?.toString() || '0'} RESIDENT
                        </span>
                        <span className="label-native text-slate-400 whitespace-nowrap">@{profileData.username || 'USERNAME'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
