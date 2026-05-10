import { useState } from 'react';
import { 
  Plus, Zap, Shield, ArrowUpCircle, Coins
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { useUserInfo } from '../hooks/useContract';
import { SBTUpgradeCard } from '../features/profile/components/SBTUpgradeCard';
import { SBTGallery } from '../features/profile/components/SBTGallery';
import { ReferralCard } from '../features/profile/components/ReferralCard';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT as useSBTData } from '../hooks/useSBT';
import { useOAuth } from '../hooks/useOAuth';
import toast from 'react-hot-toast';

// Modular Feature Imports [v3.60.0]
import { useProfile } from '../features/profile/hooks/useProfileQueries';
import { ProfileHeader } from '../features/profile/components/ProfileHeader';
import { ProfileStats } from '../features/profile/components/ProfileStats';
import { ActivityLogSection } from '../features/profile/components/ActivityLogSection';
import { CreateTaskModal } from '../features/profile/components/modals/CreateTaskModal';
import { DailyClaimModal } from '../features/profile/components/modals/DailyClaimModal';
import { RevenueClaimModal, RenewSponsorshipModal } from '../features/profile/components/modals/ExtraModals';
import { SwapModal } from '../components/SwapModal';

/**
 * ProfilePage Component
 * [v3.60.0] Modular Clean Move Implementation
 * Reduced monolithic complexity by ~90%
 */
export default function ProfilePage() {
  const { address } = useAccount();
  const navigate = useNavigate();
  const { disconnect } = useDisconnect();
  const { ecosystemSettings, refetch: refetchPoints } = usePoints();
  const { linkGoogle, linkX, isLinking: isOAuthLinking } = useOAuth();

  // Modular Data Fetching (TanStack Query)
  const { data: profileData, refetch: refetchProfile } = useProfile(address);
  const { refetch: refetchOnChainStats } = useUserInfo(address);
  const { claimableAmount, refetchAll: refetchSBT } = useSBTData();

  const [activeModal, setActiveModal] = useState<string | null>(null); // 'claim', 'task', 'revenue', 'swap', 'renew'

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20">
          <Shield size={40} className="text-indigo-400" />
        </div>
        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">ACCESS <span className="text-indigo-500">DENIED</span></h2>
        <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest max-w-xs">PLEASE CONNECT YOUR WALLET TO VIEW YOUR DISCO IDENTITY & PROGRESS.</p>
      </div>
    );
  }

  if (!profileData) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="pb-24 animate-in fade-in duration-500">
      <ProfileHeader 
        profileData={profileData} 
        onEdit={() => toast.success("Profile customization coming soon!")}
        onLogout={() => { disconnect(); navigate('/'); }}
      />

      <main className="max-w-screen-md mx-auto space-y-6">
        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-2 gap-3 px-4 mt-6">
          <button 
            onClick={() => setActiveModal('claim')}
            className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl hover:bg-emerald-500/20 transition-all group active:scale-95"
          >
            <Zap className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform" size={24} />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">DAILY CLAIM</span>
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
            pointSettings={ecosystemSettings} 
            streakCount={profileData.streakCount}
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
        {activeModal === 'swap' && <SwapModal onClose={() => setActiveModal(null)} />}

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
          <SBTGallery />
          <ReferralCard address={address} />
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
