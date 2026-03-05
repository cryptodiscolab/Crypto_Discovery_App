import { useState, useEffect } from 'react';
import {
  RefreshCw, Star, Crown, Edit, X, Save, Loader2, Users, ShieldCheck, Sparkles, Award, LogOut, Copy, Check, ExternalLink, Calendar, Plus, Ticket, Share2, Globe, Flame, Zap, Shield
} from 'lucide-react';
import { useAccount, useSignMessage, useDisconnect, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { useUserInfo } from '../hooks/useContract';
import { SBTUpgradeCard } from '../components/SBTUpgradeCard';
import { ReferralCard } from '../components/ReferralCard';
import { usePoints } from '../shared/context/PointsContext';
import { useFarcaster } from '../hooks/useFarcaster';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { DAILY_APP_ABI, CONTRACTS, ERC20_ABI } from '../lib/contracts';
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusLabel,
  TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';
import { encodeFunctionData } from 'viem';

export default function ProfilePage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { refetch } = usePoints();
  const { syncUser, isLoading: isFarcasterLoading } = useFarcaster();

  // State untuk Mode Edit
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State Form Data & Extended Profile Data
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    avatarUrl: '',
    username: '',
    fid: null,
    followerCount: 0,
    followingCount: 0,
    neynarScore: 0,
    verifications: [],
    powerBadge: false,
    total_xp: 0,
    rankName: 'Rookie'
  });

  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'claim', 'task', 'raffle'
  const [claimCountdown, setClaimCountdown] = useState('');
  const [claimReady, setClaimReady] = useState(true);

  // === READ ON-CHAIN: Cek cooldown Daily Claim ===
  const { stats: onChainUserData, refetch: refetchOnChainStats, isLoading: statsLoading } = useUserInfo(address);

  // onChainUserData.lastDailyBonusClaim = lastDailyBonusClaim (unix timestamp seconds)
  const lastClaimTimestamp = onChainUserData?.lastDailyBonusClaim ? Number(onChainUserData.lastDailyBonusClaim) : 0;
  // Jika lastClaim === 0, artinya user belum pernah claim sama sekali → bukan cooldown
  const nextClaimAt = lastClaimTimestamp > 0 ? (lastClaimTimestamp + 86400) * 1000 : 0;
  const isLoadingOnChain = statsLoading;

  // === COUNTDOWN REAL-TIME untuk Quick Action button ===
  useEffect(() => {
    const tick = () => {
      if (isLoadingOnChain) { setClaimReady(false); setClaimCountdown('Loading...'); return; }
      if (nextClaimAt === 0) { setClaimReady(true); setClaimCountdown(''); return; }
      const diff = nextClaimAt - Date.now();
      if (diff <= 0) { setClaimReady(true); setClaimCountdown(''); return; }
      setClaimReady(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setClaimCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextClaimAt]);

  // Load data awal dari Supabase saat component mount
  useEffect(() => {
    if (address) {
      fetchProfile();
    }
  }, [address]);

  const fetchProfile = async () => {
    if (!address) return;

    // Gunakan address lowercase agar sinkron dengan database
    const walletAddress = address.toLowerCase();

    // Ambil data dari view v_user_full_profile
    const { data, error } = await supabase
      .from('v_user_full_profile')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (error) {
      console.warn("Profile fetching error:", error.message);
    }

    if (data) {
      // Mapping data dari Supabase ke State
      setProfileData({
        displayName: data.display_name || '',
        bio: data.bio || '',
        avatarUrl: data.pfp_url || '',
        username: data.username || '',
        fid: data.fid || 'N/A',
        followerCount: data.follower_count || 0,
        followingCount: data.following_count || 0,
        neynarScore: data.neynar_score || 0,
        verifications: data.verifications || [],
        powerBadge: data.power_badge || false,
        activeStatus: data.active_status || 'active',
        total_xp: data.total_xp || 0,
        rankName: data.rank_name || 'Rookie'
      });
    } else {
      console.log("No profile found for address:", walletAddress);
    }
  };

  // --- CORE LOGIC: SECURE SAVE ---
  const handleSaveProfile = async () => {
    if (!address) return toast.error("Please connect your wallet!");

    setIsSaving(true);
    const toastId = toast.loading("Requesting wallet signature...");

    try {
      // 1. Siapkan Pesan Unik (Anti-Replay Attack)
      const messageToSign = `Update Profile for ${address.toLowerCase()} at ${new Date().toISOString()}`;

      // 2. Trigger Wallet Signature
      const signature = await signMessageAsync({ message: messageToSign });

      toast.loading("Verifying & Saving to Server...", { id: toastId });

      // 3. Kirim ke API (Secured)
      const response = await fetch('/api/user-bundle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-profile',
          wallet: address.toLowerCase(),
          signature: signature,
          message: messageToSign,
          payload: {
            display_name: profileData.displayName,
            bio: profileData.bio,
            pfp_url: profileData.avatarUrl
          }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update profile");
      }

      // 4. Sukses!
      toast.success("Profile updated successfully!", { id: toastId });
      setIsEditing(false);

      // Refresh data di UI biar sinkron
      fetchProfile();

    } catch (error) {
      console.error("Save Error:", error);
      if (error.code === 4001 || error.message.includes("rejected")) {
        toast.error("Signature rejected by user", { id: toastId });
      } else {
        toast.error(`Error: ${error.message}`, { id: toastId });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Wallet address copied!", { duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 pb-20">
      {/* 
        FLAT-NATIVE HEADER 
        Mimic Farcaster/Twitter: Cover Image (Optional) -> Avatar -> Info 
        Since we don't have a cover image, we start with simple padding.
      */}

      {/* Top Action Bar (Mobile only usually, or simplified header) */}
      <div className="flex justify-between items-center px-4 py-3 border-b-subtle sticky top-0 bg-[#0B0E14]/95 backdrop-blur-md z-10 md:hidden">
        <h1 className="text-base font-bold text-white">Profile</h1>
        <div className="flex gap-3">
          <button
            onClick={() => disconnect()}
            className="text-red-400 hover:text-red-300"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto">
        {/* AVATAR & MAIN INFO */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex justify-between items-start mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gray-800 overflow-hidden border-4 border-[#0B0E14] shadow-sm">
                {profileData.avatarUrl ? (
                  <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
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

            {/* Action Buttons (Edit/Sync) */}
            <div className="flex gap-2 mt-2">
              {!isEditing ? (
                <>
                  <button
                    onClick={async () => {
                      if (!address) return toast.error("Please connect your wallet!");
                      const toastId = toast.loading("Syncing with Farcaster...");
                      try {
                        const synced = await syncUser(address, true);
                        await fetchProfile();
                        if (synced?.fid) {
                          toast.success("Farcaster identity synced!", { id: toastId });
                        } else {
                          toast.error("No Farcaster account found for this wallet.", { id: toastId });
                        }
                      } catch (e) {
                        toast.error(e.message || "Sync failed", { id: toastId });
                      }
                    }}
                    disabled={isFarcasterLoading}
                    className={`px-4 py-1.5 rounded-full border text-sm font-bold active:scale-95 transition-all flex items-center gap-2 ${!profileData.fid ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'border-white/20 text-white hover:bg-white/5'}`}
                  >
                    {isFarcasterLoading ? (
                      <Loader2 className="animate-spin w-4 h-4" />
                    ) : !profileData.fid ? (
                      <>
                        <RefreshCw size={14} />
                        Sync Farcaster
                      </>
                    ) : (
                      "Sync"
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-1.5 rounded-full border border-white/20 text-sm font-medium hover:bg-white/10 active:scale-95 transition-transform"
                  >
                    Edit
                  </button>
                  {/* Farcaster Referral Icon */}
                  <a
                    href="https://farcaster.xyz/~/code/CJ393F"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Join Farcaster"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 active:scale-90 transition-all"
                  >
                    <Sparkles size={18} />
                  </a>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-1.5 rounded-full border border-red-500/50 text-red-400 text-sm font-medium active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-full bg-white text-black text-sm font-bold active:scale-95 transition-transform"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {!profileData.fid && !isEditing && (
            <div className="px-4 mb-6">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] text-indigo-300 font-black uppercase tracking-wider mb-1">Verify Your Farcaster Account</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    Belum terdeteksi? Pastikan wallet Anda sudah diverifikasi di: <br />
                    <span className="text-white">Warpcast &gt; Settings &gt; Verified Addresses</span>. <br />
                    Setelah itu, klik tombol <b>Sync Farcaster</b> di atas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* NAME & BIO */}
          <div className="space-y-1">
            {isEditing ? (
              <input
                type="text"
                value={profileData.displayName}
                onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                className="w-full bg-transparent border-b border-gray-700 py-1 text-xl font-bold text-white focus:border-indigo-500 outline-none"
                placeholder="Display Name"
              />
            ) : (
              <h2 className="text-xl font-bold text-white leading-tight">{profileData.displayName || 'No Name'}</h2>
            )}

            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <span className="text-slate-400">@{profileData.username || 'username'}</span>
              {profileData.fid && <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-500">FID: {profileData.fid}</span>}
            </div>
          </div>

          <div className="mt-3">
            {isEditing ? (
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                className="w-full bg-transparent border border-gray-700 rounded p-2 text-sm text-slate-300 focus:border-indigo-500 outline-none h-20"
                placeholder="Bio..."
              />
            ) : (
              <p className="text-[15px] text-slate-300 leading-snug whitespace-pre-wrap">
                {profileData.bio || "No bio yet."}
              </p>
            )}
          </div>

          {/* FOLLOW STATS & WALLET */}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex gap-1">
              <span className="font-bold text-white">{profileData.followingCount.toLocaleString()}</span>
              <span className="text-slate-500">Following</span>
            </div>
            <div className="flex gap-1">
              <span className="font-bold text-white">{profileData.followerCount.toLocaleString()}</span>
              <span className="text-slate-500">Followers</span>
            </div>
            <div
              className="flex items-center gap-1 text-slate-500 cursor-pointer hover:text-indigo-400 transition-colors ml-auto"
              onClick={handleCopyAddress}
            >
              <div className={`w-2 h-2 rounded-full ${address ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-mono text-xs">
                {address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Connect Wallet'}
              </span>
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </div>
          </div>
        </div>

        {/* DIVIDER */}
        <div className="h-px bg-white/5 w-full my-2" />

        {/* UGC ACTION BUTTONS */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setActiveModal('claim')}
              className={`group flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border transition-all active:scale-95
                ${claimReady
                  ? 'bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                  : 'bg-gradient-to-b from-slate-700/20 to-slate-700/10 border-slate-600/20'
                }`}
            >
              <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${claimReady ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/30 text-slate-500'}`}>
                <Calendar size={20} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${claimReady ? 'text-emerald-500' : 'text-slate-500'}`}>
                Daily Claim
              </span>
              {!claimReady && claimCountdown && (
                <span className="text-[9px] font-mono font-bold text-indigo-400 tabular-nums leading-none">
                  {claimCountdown}
                </span>
              )}
              {claimReady && !isLoadingOnChain && (
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">READY ✓</span>
              )}
              {isLoadingOnChain && (
                <span className="text-[9px] font-bold text-slate-500 uppercase animate-pulse">Checking...</span>
              )}
            </button>

            <button
              onClick={() => setActiveModal('task')}
              className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 hover:border-indigo-500/40 transition-all active:scale-95"
            >
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                <Plus size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Create Task</span>
            </button>

            <button
              onClick={() => setActiveModal('raffle')}
              className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-orange-500/10 to-orange-500/5 border border-orange-500/20 hover:border-orange-500/40 transition-all active:scale-95"
            >
              <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 group-hover:scale-110 transition-transform">
                <Ticket size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Create Raffle</span>
            </button>

            <button
              onClick={() => setActiveModal('renew')}
              className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-blue-500/10 to-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all active:scale-95"
            >
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                <RefreshCw size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Renew Task</span>
            </button>
          </div>
        </div>

        {/* MODALS */}
        {activeModal === 'task' && <CreateTaskModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'claim' && <DailyClaimModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'renew' && <RenewSponsorshipModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'raffle' && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-sm p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto">
                <Ticket size={32} className="text-orange-400" />
              </div>
              <h2 className="text-xl font-black text-white">RAFFLE V2 COMING SOON</h2>
              <p className="text-xs text-slate-400">Raffle creation is currently being optimized for better transparency.</p>
              <button onClick={() => setActiveModal(null)} className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl text-xs font-bold transition-all">CLOSE</button>
            </div>
          </div>
        )}

        {/* TIER ASCENSION CARD */}
        <div className="px-4 mb-4">
          <SBTUpgradeCard />
        </div>

        {/* REFERRAL SYSTEM */}
        <div className="px-4 mb-6">
          <ReferralCard address={address} />
        </div>

        {/* STATS LIST (Mobile Native Style) */}
        <div className="flex flex-col">
          {/* Neynar Score */}
          <div className="flex items-center justify-between px-4 py-3 border-b-subtle active:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Neynar Score</h3>
                <p className="text-xs text-slate-500">Reputation Health</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-lg font-mono font-bold ${profileData.neynarScore >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                {(profileData.neynarScore * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Total XP */}
          <div className="flex items-center justify-between px-4 py-3 border-b-subtle active:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                <Award size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Total XP</h3>
                <p className="text-xs text-slate-500">Season Progress</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-mono font-bold text-white">
                {Number(profileData.total_xp).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Rank */}
          <div className="flex items-center justify-between px-4 py-3 border-b-subtle active:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Crown size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Current Rank</h3>
                <p className="text-xs text-slate-500">Leaderboard Tier</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-blue-400">
                {profileData.rankName}
              </span>
            </div>
          </div>
        </div>

        {/* VERIFICATIONS LIST */}
        {profileData.verifications && profileData.verifications.length > 0 && (
          <div className="mt-6 px-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Verified Addresses</h3>
            <div className="space-y-2">
              {profileData.verifications.map((vAddr, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <span className="font-mono text-sm text-slate-300">
                    {vAddr.slice(0, 10)}...{vAddr.slice(-8)}
                  </span>
                  <ExternalLink size={14} className="text-slate-600" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-24" /> {/* Safe spacing for bottom nav */}
      </div>
    </div>
  );
}

function CreateTaskModal({ onClose }) {
  const [tasksBatch, setTasksBatch] = useState([
    { platform: 'farcaster', title: '', link: '' },
    { platform: 'x', title: '', link: '' },
    { platform: 'base', title: '', link: '' }
  ]);
  const [email, setEmail] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sybilFilters, setSybilFilters] = useState({
    minNeynarScore: 0,
    minFollowers: 0,
    accountAgeDays: 0,
    powerBadge: false,
    requiresVerification: true
  });
  const [paymentToken, setPaymentToken] = useState('creator'); // 'creator' or 'eth'
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();

  // Config based on selection
  const isEth = paymentToken === 'eth';
  const rewardTokenAddr = isEth ? "0x0000000000000000000000000000000000000000" : CONTRACTS.CREATOR_TOKEN;
  const rewardAmount = 5n * 10n ** 18n; // 5 tokens (assuming 18 decimals)
  const platformFee = 2n * 10n ** 6n; // 2 USDC (assuming 6 decimals)

  const buildCalls = () => {
    const titles = tasksBatch.filter(t => t.title && t.link).map(t => t.title);
    const links = tasksBatch.filter(t => t.title && t.link).map(t => t.link);

    if (titles.length === 0) return [];

    const calls = [
      // 1. Approve USDC for platform fee
      {
        to: CONTRACTS.USDC,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.DAILY_APP, platformFee],
        }),
      }
    ];

    // 2. Approve reward token (if not ETH)
    if (!isEth) {
      calls.push({
        to: CONTRACTS.CREATOR_TOKEN,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.DAILY_APP, rewardAmount],
        }),
      });
    }

    // 3. The main call
    calls.push({
      to: CONTRACTS.DAILY_APP,
      data: encodeFunctionData({
        abi: DAILY_APP_ABI,
        functionName: 'buySponsorshipWithToken',
        args: [
          0, // SponsorLevel.BRONZE
          titles,
          links,
          email,
          isEth ? 0n : rewardAmount,
          rewardTokenAddr
        ],
      }),
      value: isEth ? rewardAmount : 0n,
    });

    return calls;
  };


  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-white/5">
        <h2 className="text-lg font-black text-white italic tracking-tighter">CREATE <span className="text-indigo-500">TASK BATCH</span></h2>
        <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-4">
          {tasksBatch.map((task, idx) => (
            <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-3xl space-y-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {task.platform === 'farcaster' ? <Share2 size={80} /> : task.platform === 'x' ? <Flame size={80} /> : <Globe size={80} />}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400">{idx + 1}</div>
                <select
                  value={task.platform}
                  onChange={(e) => {
                    const newBatch = [...tasksBatch];
                    newBatch[idx].platform = e.target.value;
                    setTasksBatch(newBatch);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-400 outline-none uppercase tracking-widest cursor-pointer"
                >
                  <option value="farcaster">Farcaster</option>
                  <option value="x">X (Twitter)</option>
                  <option value="base">Base App</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Task Title (e.g. Follow @disco)"
                value={task.title}
                onChange={(e) => {
                  const newBatch = [...tasksBatch];
                  newBatch[idx].title = e.target.value;
                  setTasksBatch(newBatch);
                }}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none"
              />
              <input
                type="text"
                placeholder="Link URL"
                value={task.link}
                onChange={(e) => {
                  const newBatch = [...tasksBatch];
                  newBatch[idx].link = e.target.value;
                  setTasksBatch(newBatch);
                }}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-indigo-400 font-mono focus:border-indigo-500 outline-none"
              />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showAdvanced ? <Shield size={14} /> : <Zap size={14} />}
            {showAdvanced ? "Hide Advanced Settings" : "Configure Sybil Filters (Optional)"}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Min Neynar Score</label>
                <input
                  type="number"
                  value={sybilFilters.minNeynarScore}
                  onChange={(e) => setSybilFilters({ ...sybilFilters, minNeynarScore: e.target.value })}
                  className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  placeholder="0-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Min Followers</label>
                <input
                  type="number"
                  value={sybilFilters.minFollowers}
                  onChange={(e) => setSybilFilters({ ...sybilFilters, minFollowers: e.target.value })}
                  className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="col-span-2 flex items-center justify-between py-2 border-t border-white/5 mt-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Require Power Badge</span>
                <button
                  onClick={() => setSybilFilters({ ...sybilFilters, powerBadge: !sybilFilters.powerBadge })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${sybilFilters.powerBadge ? 'bg-indigo-600' : 'bg-slate-800'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${sybilFilters.powerBadge ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Admin Contact Email</label>
          <input
            type="email"
            placeholder="For sponsorship listing coordination"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white focus:border-indigo-500 outline-none"
          />
        </div>

        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Choose Payment Token</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentToken('creator')}
                className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${paymentToken === 'creator' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/20 border-white/5 text-slate-500'}`}
              >
                Creator Token
              </button>
              <button
                onClick={() => setPaymentToken('eth')}
                className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${paymentToken === 'eth' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/20 border-white/5 text-slate-500'}`}
              >
                Native ETH
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-indigo-400">
              <span>Platform Fee</span>
              <span>$2.00 USDC</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-200">
              <span>Reward Pool</span>
              <span>5.00 {isEth ? 'ETH' : 'TOKEN'}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Duration</span>
              <span>3 Days Active</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-500 leading-relaxed italic">
            Sponsorship includes platform fee and reward pool.
            Native ETH or Creator Tokens can be used as reward.
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-white/5 bg-black/50 backdrop-blur-md">
        <div className="relative z-[9999] pointer-events-auto">
          <Transaction
            calls={buildCalls()}
            onSuccess={() => {
              toast.success("Sponsorship Created! Duration: 3 Days.");
              // BUG-8 fix: sync XP on-chain ke DB setelah payment (Secured)
              const timestamp = new Date().toISOString();
              const message = `Sync XP for ${address}\nTimestamp: ${timestamp}`;
              signMessageAsync({ message }).then(signature => {
                fetch('/api/user-bundle', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    action: 'xp',
                    wallet_address: address,
                    signature,
                    message
                  }),
                }).catch(() => { });
              }).catch(() => { });
              onClose();
            }}
            onError={(err) => {
              console.error(err);
              toast.error("Failed: " + (err.shortMessage || err.message));
            }}
          >
            <TransactionButton
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50"
              text="PAY & CREATE BATCH"
            />
            <div className="mt-2 text-[10px] text-slate-500 font-mono text-center">
              <TransactionStatus>
                <TransactionStatusLabel />
                <TransactionStatusAction />
              </TransactionStatus>
            </div>
          </Transaction>
        </div>
      </div>
    </div>
  );
}

function DailyClaimModal({ onClose }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { refetch, manualAddPoints } = usePoints();
  const [isClaiming, setIsClaiming] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isCooldown, setIsCooldown] = useState(false);

  const { stats: userData, refetch: refetchStats } = useUserInfo(address);

  const lastDailyClaim = userData?.lastDailyBonusClaim
    ? Number(userData.lastDailyBonusClaim)
    : 0;
  const nextClaimTime = lastDailyClaim > 0 ? (lastDailyClaim + 86400) * 1000 : 0;

  useEffect(() => {
    const tick = () => {
      const diff = nextClaimTime - Date.now();
      if (diff <= 0) {
        setIsCooldown(false);
        setCountdown('');
        return;
      }
      setIsCooldown(true);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextClaimTime]);

  const handleClaim = async () => {
    if (isCooldown) return toast.error("Cooldown active! Come back later.");
    setIsClaiming(true);
    const tid = toast.loading("Preparing claim...");
    try {
      let gasLimit;
      try {
        const estimated = await publicClient.estimateContractGas({
          address: CONTRACTS.DAILY_APP,
          abi: DAILY_APP_ABI,
          functionName: 'claimDailyBonus',
          account: address,
        });
        gasLimit = BigInt(Math.ceil(Number(estimated) * 1.5));
      } catch (estErr) {
        console.warn('[DailyClaim] Gas estimation failed:', estErr.message);
        if (estErr.message?.toLowerCase().includes('user rejected')) {
          toast.dismiss(tid);
        } else {
          toast.error('Already claimed today! Try again later.', { id: tid });
        }
        setIsClaiming(false);
        return;
      }

      const hash = await writeContractAsync({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'claimDailyBonus',
        gas: gasLimit,
      });

      toast.loading('Mining transaction... 🔨', { id: tid });
      await publicClient.waitForTransactionReceipt({ hash });

      // Secured Sync XP
      toast.loading('Syncing XP...', { id: tid });
      try {
        const timestamp = new Date().toISOString();
        const message = `Sync XP for ${address}\nTimestamp: ${timestamp}`;
        const signature = await signMessageAsync({ message });

        const response = await fetch('/api/user-bundle', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'xp',
            wallet_address: address,
            signature,
            message
          }),
        });

        if (!response.ok) throw new Error("Sync API failed");

        manualAddPoints(100);
        await refetchStats();
        await refetch();
      } catch (syncErr) {
        console.warn('[DailyClaim] XP sync failed:', syncErr.message);
      }

      toast.success("+100 XP Claimed! 🎉", { id: tid });
      onClose();
    } catch (err) {
      console.error('Daily Claim Error:', err);
      toast.error('Claim failed: ' + (err.shortMessage || 'Try again'), { id: tid });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-sm:max-w-xs max-w-sm p-8 space-y-6 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all duration-500 ${isCooldown ? 'bg-slate-500/10' : 'bg-emerald-500/20 animate-pulse'}`}>
          <Sparkles size={40} className={isCooldown ? 'text-slate-500' : 'text-emerald-400'} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
            Daily <span className="text-emerald-500">Mojo</span>
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            {isCooldown
              ? "You've claimed today! Next bonus in:"
              : "Claim your daily XP boost to climb the leaderboard!"}
          </p>
        </div>
        {isCooldown && countdown && (
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl py-4 px-6">
            <p className="text-3xl font-black font-mono text-indigo-400 tracking-widest tabular-nums">
              {countdown}
            </p>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-1">HH : MM : SS</p>
          </div>
        )}
        <button
          onClick={handleClaim}
          disabled={isClaiming || isCooldown}
          className={`w-full py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60
            ${isCooldown
              ? 'bg-slate-800 border border-slate-700 cursor-not-allowed text-slate-500'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
            }`}
        >
          {isClaiming
            ? '⏳ PROCESSING...'
            : isCooldown
              ? `⏰ COMEBACK IN ${countdown}`
              : '✨ CLAIM DAILY (+100 XP)'}
        </button>
        <button
          onClick={onClose}
          className="text-[10px] text-slate-500 uppercase font-black hover:text-white transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function RenewSponsorshipModal({ onClose }) {
  const [reqId, setReqId] = useState('');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
            <RefreshCw size={32} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Renew <span className="text-blue-500">Visiblity</span></h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Extend your task visibility for another **3 Days** for **$2 USDC**.
            Title and Link will remain the same.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1">Sponsorship ID</label>
            <input
              type="number"
              placeholder="Enter ID (e.g. 12)"
              value={reqId}
              onChange={(e) => setReqId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm text-white focus:border-blue-500 outline-none"
            />
          </div>

          <div className="relative z-[9999] pointer-events-auto">
            <Transaction
              calls={[{
                to: CONTRACTS.DAILY_APP,
                data: encodeFunctionData({
                  abi: DAILY_APP_ABI,
                  functionName: 'renewSponsorship',
                  args: [BigInt(reqId || 0)],
                }),
              }]}
              onSuccess={() => {
                toast.success("Sponsorship Extended 3 Days!");
                onClose();
              }}
              onError={(err) => {
                toast.error(err.shortMessage || "Failed to renew");
              }}
            >
              <TransactionButton
                className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                text="PAY $2 USDC & RENEW"
              />
              <div className="mt-2 text-[10px] text-slate-500 font-mono text-center">
                <TransactionStatus>
                  <TransactionStatusLabel />
                  <TransactionStatusAction />
                </TransactionStatus>
              </div>
            </Transaction>
          </div>
          <button onClick={onClose} className="w-full text-[10px] text-slate-600 uppercase font-black hover:text-white transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
