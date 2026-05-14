import { useState, useEffect } from 'react';
import { 
  Plus, Zap, Shield, ArrowUpCircle, Coins, Lock, Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { useUserInfo } from '../hooks/useContract';
import { SBTUpgradeCard } from '../features/profile/components/SBTUpgradeCard';
import { SBTGallery } from '../features/profile/components/SBTGallery';
import { ReferralCard } from '../features/profile/components/ReferralCard';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT as useSBTData } from '../hooks/useSBT';
import { useOAuth } from '../hooks/useOAuth';
import { userService } from '../services/userService';
import toast from 'react-hot-toast';

// Modular Feature Imports [v3.61.0]
import { useProfile } from '../features/profile/hooks/useProfileQueries';
import { ProfileHeader } from '../features/profile/components/ProfileHeader';
import { ProfileStats } from '../features/profile/components/ProfileStats';
import { ActivityLogSection } from '../features/profile/components/ActivityLogSection';
import { CreateTaskModal } from '../features/profile/components/modals/CreateTaskModal';
import { DailyClaimModal } from '../features/profile/components/modals/DailyClaimModal';
import { RevenueClaimModal, RenewSponsorshipModal } from '../features/profile/components/modals/ExtraModals';
import { SwapModal } from '../components/SwapModal';
import { ProfileData } from '../features/profile/types';
import { WalletPortfolio } from '../components/WalletPortfolio';

/**
 * ProfilePage Component
 * [v3.61.0] Hardened & Polished Implementation
 * Full parity with backend user-bundle.ts
 */
export default function ProfilePage() {
  const { address } = useAccount();
  const navigate = useNavigate();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { ecosystemSettings, refetch: refetchPoints } = usePoints();
  const { linkGoogle, linkX, isLinking: isOAuthLinking } = useOAuth();

  // Modular Data Fetching (TanStack Query)
  const { data: profileData, refetch: refetchProfile, isLoading: isProfileLoading, isError: isProfileError } = useProfile(address);
  const { refetch: refetchOnChainStats, stats: onChainStats } = useUserInfo(address);
  const { claimableAmount, refetchAll: refetchSBT } = useSBTData();

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableProfileData, setEditableProfileData] = useState<ProfileData | null>(null);

  // Update editable data when profileData loads
  useEffect(() => {
    if (profileData) setEditableProfileData(profileData);
  }, [profileData]);

  const handleSaveProfile = async () => {
    if (!address || !editableProfileData) return;
    setIsSaving(true);
    const tid = toast.loading("Signing profile update...");

    try {
      const timestamp = new Date().toISOString();
      const message = `Update Profile Settings\nWallet: ${address}\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      toast.loading("Persisting changes...", { id: tid });
      
      await userService.updateProfile({
        wallet: address,
        signature,
        message,
        payload: {
          display_name: editableProfileData.displayName,
          username: editableProfileData.username,
          pfp_url: editableProfileData.avatarUrl
        }
      });

      toast.success("Profile updated! 🎉", { id: tid });
      setIsEditing(false);
      refetchProfile();
    } catch (e: any) {
      toast.error(e.message || "Update failed", { id: tid });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncUser = async (addr: string, force = false) => {
    if (!addr) return;
    try {
      const timestamp = new Date().toISOString();
      const message = `Sync Farcaster Identity\nWallet: ${addr}\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });
      
      const res = await userService.syncFarcaster({ address: addr, signature, message });
      if (res?.profile) {
        refetchProfile();
        return res.profile;
      }
      return null;
    } catch (e: any) {
      console.error("[handleSyncUser] Error:", e);
      throw e;
    }
  };

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative mb-8">
            <div className="w-24 h-24 bg-indigo-500/10 rounded-[2.5rem] flex items-center justify-center border border-indigo-500/20 rotate-12 animate-pulse">
                <Lock size={44} className="text-indigo-400 -rotate-12" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
                <Shield size={20} className="text-emerald-400" />
            </div>
        </div>
        
        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">
            DISCO <span className="text-indigo-500">IDENTITY</span>
        </h2>
        <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.2em] max-w-xs mb-8 leading-relaxed">
            PLEASE CONNECT YOUR WALLET TO UNLOCK YOUR ON-CHAIN PROGRESS & SOCIAL DISCOVERY.
        </p>
        
        <button 
            onClick={() => (window as any).rainbowContext?.openConnectModal?.()}
            className="group relative flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-indigo-50 transition-all active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
        >
            <Wallet size={18} />
            CONNECT WALLET
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
        </button>
      </div>
    );
  }

  if (isProfileError) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 p-8 text-center">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
        <Shield size={32} className="text-red-400" />
      </div>
      <p className="text-[11px] font-black text-red-400 uppercase tracking-widest">Failed to load profile</p>
      <button onClick={() => refetchProfile()} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all">
        RETRY
      </button>
    </div>
  );

  if (isProfileLoading || !profileData) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="w-12 h-12 border-[3px] border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_20px_rgba(99,102,241,0.2)]" />
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">LOADING PROFILE...</p>
    </div>
  );

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <ProfileHeader 
        profileData={editableProfileData || (profileData as ProfileData)}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        isSaving={isSaving}
        handleSaveProfile={handleSaveProfile}
        syncUser={handleSyncUser}
        isFarcasterLoading={false}
        address={address}
        onChainUserData={{
            currentTier: onChainStats?.currentTier || 0
        }}
        setActiveModal={setActiveModal}
        setProfileData={(data) => setEditableProfileData(data)}
      />

      <main className="max-w-screen-md mx-auto space-y-6">
        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-3 gap-3 px-4 mt-6">
          <button 
            onClick={() => setActiveModal('claim')}
            className={`flex flex-col items-center justify-center p-4 border rounded-3xl transition-all group active:scale-95 ${
              onChainStats?.lastDailyBonusClaim && (Date.now() / 1000 - onChainStats.lastDailyBonusClaim) < 72000
                ? 'bg-slate-500/10 border-slate-500/20 opacity-60'
                : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
          >
            <Zap className={`mb-2 group-hover:scale-110 transition-transform ${
              onChainStats?.lastDailyBonusClaim && (Date.now() / 1000 - onChainStats.lastDailyBonusClaim) < 72000
                ? 'text-slate-400' : 'text-emerald-400'
            }`} size={24} />
            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">
              {onChainStats?.lastDailyBonusClaim && (Date.now() / 1000 - onChainStats.lastDailyBonusClaim) < 72000
                ? 'CLAIMED ✓' : 'DAILY CLAIM'}
            </span>
          </button>
          
          <button 
            onClick={() => setActiveModal('swap')}
            className="flex flex-col items-center justify-center p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl hover:bg-amber-500/20 transition-all group active:scale-95"
          >
            <Coins className="text-amber-400 mb-2 group-hover:scale-110 transition-transform" size={24} />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">QUICK SWAP</span>
          </button>

          <button 
            onClick={() => setActiveModal('task')}
            className="flex flex-col items-center justify-center p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl hover:bg-indigo-500/20 transition-all group active:scale-95"
          >
            <Plus className="text-indigo-400 mb-2 group-hover:scale-110 transition-transform" size={24} />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">NEW MISSION</span>
          </button>
        </div>

        {/* MODALS */}
        {activeModal === 'task' && <CreateTaskModal onClose={() => setActiveModal(null)} onRequestSwap={() => setActiveModal('swap')} />}
        {activeModal === 'claim' && (
          <DailyClaimModal 
            onClose={() => setActiveModal(null)}
            onSuccess={() => {
              refetchProfile();
              refetchPoints();
              refetchOnChainStats();
              refetchSBT();
            }}
            streakCount={(profileData as any)?.streakCount || (profileData as any)?.streak_count || 0}
          />
        )}
        {activeModal === 'renew' && <RenewSponsorshipModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'revenue' && (
          <RevenueClaimModal 
            onClose={() => setActiveModal(null)} 
            claimable={claimableAmount}
            onSuccess={() => {
              refetchOnChainStats();
              refetchSBT();
            }}
          />
        )}
        {activeModal === 'swap' && <SwapModal isOpen={true} onClose={() => setActiveModal(null)} />}

        {/* STATS & IDENTITY */}
        <ProfileStats 
          profileData={profileData} 
          linkGoogle={linkGoogle}
          linkX={linkX}
          isOAuthLinking={isOAuthLinking}
          fetchProfile={refetchProfile}
        />

        {/* TIER & ACHIEVEMENTS */}
        <div className="px-4 space-y-6">
          <SBTUpgradeCard />
          <WalletPortfolio />
          <SBTGallery />
          <ReferralCard />
        </div>

        {/* ACTIVITY LOGS */}
        <div className="px-4 pb-12">
          <ActivityLogSection walletAddress={address} />
        </div>
      </main>

      {/* REVENUE BAR (Floating Mini) */}
      {claimableAmount > 0n && (
        <div className="fixed bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom-4">
          <button 
            onClick={() => setActiveModal('revenue')}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-2xl flex items-center justify-between shadow-xl border border-white/20"
          >
            <div className="flex items-center gap-3">
              <Coins className="text-white" size={20} />
              <div className="text-left">
                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">CLAIMABLE REVENUE</p>
                <p className="text-sm font-black text-white">{Number(claimableAmount) / 1e18} ETH</p>
              </div>
            </div>
            <ArrowUpCircle className="text-white" size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
