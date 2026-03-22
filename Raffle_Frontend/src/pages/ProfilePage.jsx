import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Star, Crown, Edit, X, Save, Loader2, Users, ShieldCheck, Sparkles, Award, LogOut, Copy, Check, ExternalLink, Calendar, Plus, Ticket, Share2, Globe, Flame, Zap, Shield, ArrowUpCircle, Video, Instagram, Heart, Repeat, MessageCircle, Coins, Mail, Twitter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useSignMessage, useDisconnect, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { useUserInfo } from '../hooks/useContract';
import { SBTUpgradeCard } from '../components/SBTUpgradeCard';
import { SBTGallery } from '../components/SBTGallery';
import { ReferralCard } from '../components/ReferralCard';
import { usePoints } from '../shared/context/PointsContext';
import { useFarcaster } from '../hooks/useFarcaster';
import { useSBT as useSBTData } from '../hooks/useSBT';
import { useOAuth } from '../hooks/useOAuth';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { DAILY_APP_ABI, CONTRACTS, ERC20_ABI, MASTER_X_ADDRESS } from '../lib/contracts';
import ActivityLogSection from '../components/ActivityLogSection';
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusLabel,
  TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';
import { usePriceOracle } from '../hooks/usePriceOracle';
import { encodeFunctionData, formatUnits, parseUnits } from 'viem';

export default function ProfilePage() {
  const { address } = useAccount();
  const navigate = useNavigate();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { sbtThresholds, ecosystemSettings, profileData: contextProfile, refetch: refetchPoints } = usePoints();
  const { syncUser, isLoading: isFarcasterLoading } = useFarcaster();
  const { linkGoogle, linkX, isLinking: isOAuthLinking } = useOAuth();

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form Data & Extended Profile Data State
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
    rankName: 'Rookie',
    streakCount: 0,
    google_id: null,
    google_email: '',
    twitter_id: null,
    twitter_username: '',
    oauth_provider: null
  });

  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'claim', 'task', 'raffle', 'revenue'
  const [claimCountdown, setClaimCountdown] = useState('');
  const [claimReady, setClaimReady] = useState(true);

  // === READ ON-CHAIN: Cek cooldown Daily Claim ===
  const { stats: onChainUserData, refetch: refetchOnChainStats, isLoading: statsLoading } = useUserInfo(address);
  const { claimableAmount, refetchAll: refetchSBT } = useSBTData();

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
  }, [nextClaimAt, isLoadingOnChain]);





  const [potentialTier, setPotentialTier] = useState(0);

  const calculatePotentialTier = useCallback((xp) => {
    if (!sbtThresholds || sbtThresholds.length === 0) {
      return 0; // Dynamic-only mode: no hardcoded fallbacks
    }
    
    // Dynamically match highest tier threshold passed (uses min_xp correctly now)
    let reached = 0;
    const sorted = [...sbtThresholds].sort((a,b) => (a.min_xp || 0) - (b.min_xp || 0));
    for (const t of sorted) {
       if (xp >= (t.min_xp || 0)) {
           reached = t.level;
       }
    }
    return reached;
  }, [sbtThresholds]);

  const fetchProfile = useCallback(async () => {
    if (!address) return;

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
      // Map data from Supabase to state
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
        rankName: data.rank_name || 'Rookie',
        tier: data.tier || 0,
        streakCount: data.streak_count || 0,
        lastDailyClaim: data.last_daily_bonus_claim,
        google_id: data.google_id || null,
        google_email: data.google_email || '',
        twitter_id: data.twitter_id || null,
        twitter_username: data.twitter_username || '',
        oauth_provider: data.oauth_provider || null
      });
      setPotentialTier(calculatePotentialTier(data.total_xp || 0));
    } else {
      console.log("No profile found for", walletAddress);
    }
  }, [address, calculatePotentialTier, setProfileData, setPotentialTier]);

  // Load data awal dari Supabase saat component mount
  useEffect(() => {
    if (address) {
      fetchProfile();
    }
  }, [address, fetchProfile]);

  const getTierName = (t) => {
    const names = ['Guest', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    return names[t] || 'Guest';
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
            pfp_url: profileData.avatarUrl,
            username: profileData.username
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

      // Refresh UI to sync data
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
    <div className="w-full text-slate-100">
      {/* 
        FLAT-NATIVE HEADER 
        Minimalist elevation via bg contrast.
      */}

      {/* Top Action Bar (Mobile only usually, or simplified header) */}
      <div className="flex justify-between items-center px-4 h-14 bg-zinc-900/50 backdrop-blur-md md:hidden">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">Profile</h1>
        <button
          onClick={() => disconnect()}
          className="text-zinc-500 hover:text-red-400 p-2"
        >
          <LogOut size={18} />
        </button>
      </div>

      <div className="max-w-screen-md mx-auto">
        {/* AVATAR & MAIN INFO */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex justify-between items-start mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gray-800 overflow-hidden border-4 border-[#0B0E14] shadow-sm">
                {profileData.avatarUrl ? (
                  <img src={profileData.avatarUrl} alt="Avatar" loading="lazy" className="w-full h-full object-cover" />
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
                      const toastId = toast.loading("Syncing Identity...");
                      try {
                        const synced = await syncUser(address, true);
                        if (synced?.fid) {
                          await fetchProfile();
                          toast.success("Identity synced! 🎉", { id: toastId });
                        } else {
                          toast.error("Farcaster account not found.", { id: toastId });
                        }
                      } catch (e) {
                         console.error(e);
                         toast.error("Sync failed: " + (e.message || "Unknown error"), { id: toastId });
                      }
                    }}
                    disabled={isFarcasterLoading}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${!profileData.fid ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                  >
                    {isFarcasterLoading ? (
                      <Loader2 className="animate-spin w-4 h-4" />
                    ) : !profileData.fid ? (
                      "Sync Farcaster"
                    ) : (
                      "Refresh"
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
                    Not detected? Make sure your wallet is verified at: <br />
                    <span className="text-white">Warpcast &gt; Settings &gt; Verified Addresses</span>. <br />
                    Then, click the <b>Sync Farcaster</b> button above.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {isEditing && (
              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Avatar URL (GIF/PNG/WebP)</label>
                <input
                  type="url"
                  maxLength={500}
                  value={profileData.avatarUrl}
                  onChange={(e) => setProfileData({ ...profileData, avatarUrl: e.target.value })}
                  className="w-full bg-transparent border-b border-gray-700 py-1 text-sm text-indigo-400 focus:border-indigo-500 outline-none placeholder-slate-600"
                  placeholder="https://example.com/my-avatar.gif"
                />
                <p className="text-[10px] text-slate-500 mt-1">Use direct links. Avoid huge files for better loading performance.</p>
              </div>
            )}

            {isEditing ? (
              <input
                type="text"
                maxLength={50}
                value={profileData.displayName}
                onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                className="w-full bg-transparent border-b border-gray-700 py-1 text-xl font-bold text-white focus:border-indigo-500 outline-none"
                placeholder="Display Name"
              />
            ) : (
              <h2 className="text-xl font-bold text-white leading-tight">{profileData.displayName || 'No Name'}</h2>
            )}

            <div className="flex items-center gap-2 text-slate-500 text-sm">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">@</span>
                  <input
                    type="text"
                    maxLength={30}
                    value={profileData.username || ''}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    className="bg-transparent border-b border-gray-700 py-0.5 text-sm text-slate-400 focus:border-indigo-500 outline-none w-32"
                    placeholder="username"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">@{profileData.username || 'username'}</span>
                  <div 
                    onClick={() => onChainUserData?.currentTier < potentialTier && setActiveModal('upgrade')}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all cursor-pointer
                      ${onChainUserData?.currentTier < potentialTier 
                        ? 'bg-indigo-500/20 border-indigo-500/40 animate-pulse' 
                        : 'bg-zinc-800/50 border-white/10'}`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                      {profileData.rankName}
                    </span>
                    {onChainUserData?.currentTier < potentialTier && <ArrowUpCircle size={10} className="text-indigo-400" />}
                  </div>
                  
                  {/* UNDERDOG BONUS INDICATOR */}
                  {(onChainUserData?.currentTier === 1 || onChainUserData?.currentTier === 2) && 
                   onChainUserData?.lastActivity > 0 && 
                   (Math.floor(Date.now() / 1000) <= onChainUserData.lastActivity + 48 * 3600) && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-500 animate-pulse">
                      <Zap size={8} /> Catch-up active
                    </div>
                  )}
                </div>
              )}
              {profileData.fid && !isEditing && <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-500">FID: {profileData.fid}</span>}
            </div>
          </div>

          <div className="mt-3">
            {isEditing ? (
              <textarea
                maxLength={160}
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
            {profileData.streakCount > 0 && (
              <div className="flex gap-1 items-center bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                <Flame size={12} className="text-orange-500 fill-current" />
                <span className="font-bold text-orange-500 text-[11px]">{profileData.streakCount} Day Streak</span>
              </div>
            )}
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

        {/* TIER UPGRADE PROMPT (MINIMALIST) */}
        {onChainUserData?.currentTier < potentialTier && (
          <div className="mx-4 mb-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                  Ascension Ready: {getTierName(potentialTier)}
                </span>
                <span className="text-[8px] text-slate-500 uppercase">Mint SBT for {getTierName(potentialTier)} Multiplier</span>
              </div>
            </div>
            <button 
              onClick={() => setActiveModal('upgrade')}
              className="text-[9px] font-black text-white bg-indigo-600 px-3 py-1.5 rounded-lg uppercase tracking-tight hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
            >
              Mint Status
            </button>
          </div>
        )}

        {/* UGC ACTION BUTTONS */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setActiveModal('claim')}
              className={`flex flex-col items-center justify-center gap-1 p-4 rounded-xl transition-colors
                ${claimReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-900 text-zinc-600 opacity-50'}`}
            >
              <Calendar size={18} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Daily Bonus</span>
              {claimCountdown && <span className="text-[9px] font-mono">{claimCountdown}</span>}
            </button>

            <button
              onClick={() => setActiveModal('task')}
              className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              <Plus size={18} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Create Task</span>
            </button>

            <button
              onClick={() => navigate('/create-raffle')}
              className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              <Ticket size={18} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Launch Raffle</span>
            </button>

            <button
              onClick={() => setActiveModal('renew')}
              className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw size={18} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Renew Job</span>
            </button>

            {onChainUserData?.currentTier > 0 && (
              <button
                onClick={() => setActiveModal('revenue')}
                className={`flex flex-col items-center justify-center gap-1 p-4 rounded-xl transition-all relative overflow-hidden group
                  ${claimableAmount > 0n 
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/10' 
                    : 'bg-zinc-900 text-zinc-600'}`}
              >
                {claimableAmount > 0n && (
                   <div className="absolute inset-0 bg-indigo-500/10 animate-pulse pointer-events-none" />
                )}
                <Coins size={18} className={claimableAmount > 0n ? "animate-bounce" : ""} />
                <span className="text-[10px] font-bold uppercase tracking-tight">Claim Dividends</span>
                {claimableAmount > 0n && (
                  <span className="text-[9px] font-mono text-indigo-300">
                    {Number(claimableAmount).toFixed(4)} ETH
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* MODALS */}
        {activeModal === 'task' && <CreateTaskModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'claim' && (
          <DailyClaimModal 
            onClose={() => setActiveModal(null)}
            onSuccess={() => {
              // BUG-FIX 3: Refetch profile data setelah daily claim berhasil agar XP realtime update
              fetchProfile();
              refetchPoints();
            }}
            pointSettings={ecosystemSettings} 
            streakCount={profileData.streakCount}
            profileData={profileData}
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

        {/* TIER ASCENSION CARD */}
        <div className="px-4 mb-4">
          <SBTUpgradeCard />
        </div>

        {/* SBT ACHIEVEMENT GALLERY */}
        <div className="px-4 mb-6">
          <SBTGallery />
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
        
        {/* SOCIAL IDENTITY BADGES (v3.3.1) */}
        <div className="px-4 mb-6">
          <div className="flex flex-wrap gap-3">
            {/* Google Identity */}
            <button
              onClick={async () => {
                if (profileData.google_id) return;
                const res = await linkGoogle();
                if (res?.success) fetchProfile();
              }}
              disabled={isOAuthLinking || !!profileData.google_id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all
                ${profileData.google_id 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-default' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 active:scale-95'}`}>
              <Mail size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {profileData.google_id ? 'Google Linked' : 'Link Google'}
              </span>
              {profileData.google_id && <Check size={10} className="text-blue-400" />}
            </button>
 
            {/* X (Twitter) Identity */}
            <button
              onClick={async () => {
                if (profileData.twitter_id) return;
                const res = await linkX();
                if (res?.success) fetchProfile();
              }}
              disabled={isOAuthLinking || !!profileData.twitter_id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all
                ${profileData.twitter_id 
                  ? 'bg-white/10 border-white/20 text-white cursor-default' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 active:scale-95'}`}>
              <Twitter size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {profileData.twitter_id ? 'X Linked' : 'Link X (Twitter)'}
              </span>
              {profileData.twitter_id && <Check size={10} className="text-white" />}
            </button>
 
            {/* Farcaster Identity (Existing) */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all
              ${profileData.fid && profileData.fid !== 'N/A'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                : 'bg-zinc-900 border-white/5 text-zinc-600'}`}>
              <Share2 size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {profileData.fid && profileData.fid !== 'N/A' ? 'Farcaster Linked' : 'Farcaster Unlinked'}
              </span>
              {profileData.fid && profileData.fid !== 'N/A' && <Check size={10} className="text-indigo-400" />}
            </div>
          </div>
          {profileData.google_email && (
            <p className="text-[9px] text-slate-500 mt-2 ml-4 font-mono uppercase">
              Primary identity: <span className="text-slate-400">{profileData.google_email}</span>
            </p>
          )}
        </div>

        {/* ACTIVITY LOG SECTION */}
        <div className="px-4">
          <ActivityLogSection walletAddress={address} />
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
    { platform: 'farcaster', action_type: 'follow', title: '', link: '' },
    { platform: 'x', action_type: 'follow', title: '', link: '' },
    { platform: 'base', action_type: 'follow', title: '', link: '' }
  ]);
  const [email, setEmail] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { refetch: refetchStats } = useUserInfo(address);
  const { ecosystemSettings } = usePoints(); // Zero Hardcode integration

  // RESTRICTION: ETH ONLY for Reward Pool
  const allowedTokens = ecosystemSettings?.allowed_tokens || ecosystemSettings?.whitelisted_tokens || [];
  const ethToken = allowedTokens.find(t => t.symbol === 'ETH') || allowedTokens[0];
  
  const [ethReward, setEthReward] = useState(ecosystemSettings?.sponsorship_reward_amount || '0.01');
  const [sybilFilters, setSybilFilters] = useState({
    minNeynarScore: 0,
    minFollowers: 0,
    accountAgeDays: 0,
    powerBadge: false,
    requiresVerification: true
  });
  
  const rewardTokenAddr = ethToken?.address || "0x0000000000000000000000000000000000000000";
  const feeUsd = Number(ecosystemSettings?.sponsorship_listing_fee_usdc || 0);

  const { prices } = usePriceOracle(allowedTokens.map(t => t.address));
  const currentPrice = prices[rewardTokenAddr?.toLowerCase()] || 0;
  const rewardUsdValue = currentPrice * parseFloat(ethReward || 0);
  
  const tokenDecimals = ethToken?.decimals || 18;
  // Fix: Use viem parseUnits to handle decimals properly and avoid BigInt exponent errors
  const rewardAmount = parseUnits(ethReward || '0', tokenDecimals);
  
  const platformFee = BigInt(Math.floor(feeUsd * 1000000)); // USDC 6 decimals

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

    // 2. The main call
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
          0n, // ETH uses value: field, rewardAmount arg is for ERC20
          rewardTokenAddr
        ],
      }),
      value: rewardAmount, // Using native ETH for rewards
    });

    return calls;
  };


  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[10001] flex flex-col animate-in fade-in duration-200">
      <div className="flex justify-between items-center p-4 border-b border-white/5">
        <h2 className="text-lg font-black text-white italic tracking-tighter">CREATE <span className="text-indigo-500">TASK BATCH</span></h2>
        <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-4">
          {tasksBatch.map((task, idx) => (
            <div key={idx} className="bg-zinc-900 border border-white/5 p-4 rounded-2xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {task.platform === 'farcaster' ? <Share2 size={80} /> : 
                 task.platform === 'x' ? <Flame size={80} /> : 
                 task.platform === 'tiktok' ? <Video size={80} /> :
                 task.platform === 'instagram' ? <Instagram size={80} /> :
                 <Globe size={80} />}
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
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                </select>
                <select
                  value={task.action_type}
                  onChange={(e) => {
                    const newBatch = [...tasksBatch];
                    newBatch[idx].action_type = e.target.value;
                    setTasksBatch(newBatch);
                  }}
                  className="bg-transparent text-xs font-bold text-indigo-400 outline-none uppercase tracking-widest cursor-pointer"
                >
                  <option value="follow">Follow</option>
                  <option value="like">Like</option>
                  <option value="repost">Repost</option>
                  <option value="quote">Quote</option>
                  <option value="comment">Comment</option>
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

        <div className="p-5 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 space-y-5 relative overflow-hidden group">
          {/* Subtle Glow Background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] -mr-10 -mt-10" />
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sponsorship Asset</label>
              <div className="flex items-center gap-1.5 py-0.5 px-2 rounded-full bg-emerald-500/20 border border-emerald-500/20">
                <Shield size={8} className="text-emerald-400" />
                <span className="text-[8px] font-black text-emerald-400 uppercase">ETH Restricted</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-zinc-900/50 border border-indigo-500/30 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl">⟠</div>
              <div>
                <p className="text-[11px] font-bold text-white uppercase tracking-wider">Ethereum (Native)</p>
                <p className="text-[9px] text-slate-500">Fastest settlement & non-custodial payouts</p>
              </div>
              <Check size={16} className="ml-auto text-indigo-400" />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5 relative z-10">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
              <span className="text-slate-400">Platform Listing Fee</span>
              <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20">${feeUsd.toFixed(2)} USDC</span>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Determine Reward Pool (ETH)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  value={ethReward}
                  onChange={(e) => setEthReward(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-lg font-mono text-indigo-400 outline-none focus:border-indigo-500 transition-all"
                  placeholder="0.01"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end">
                  <span className="text-[10px] font-black text-white px-2 py-0.5 bg-indigo-500 rounded-md mb-1">ETH</span>
                  {rewardUsdValue > 0 && (
                    <span className="text-[10px] font-bold text-slate-500 animate-in fade-in slide-in-from-right-1 duration-300">
                      ≈ ${rewardUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[9px] text-slate-500 leading-relaxed italic relative z-10">
            <div className="flex items-start gap-2">
              <Shield size={10} className="mt-0.5" />
              <span>
                Standard 3-day activation. Reward pool is distributed to users who complete all {tasksBatch.length} tasks in your batch.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/5 bg-black/50 backdrop-blur-md">
        <div className="relative z-[9999] pointer-events-auto">
          <Transaction
            calls={buildCalls()}
            onSuccess={async (receipt) => {
              toast.success("Missions Created Successfully! Syncing... 🚀");

              // Sync UGC Mission to DB & Log
              try {
                const timestamp = new Date().toISOString();
                const taskCount = tasksBatch.filter(t => t.title && t.link).length;
                const firstTask = tasksBatch.find(t => t.title && t.link) || { title: "New Missions", platform: "farcaster" };

                const message = `Log activity for ${address}\nAction: UGC Mission Creation\nTimestamp: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                await fetch('/api/user-bundle', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    action: 'sync-ugc-mission',
                    wallet: address,
                    signature,
                    message,
                    payload: {
                      title: firstTask.title,
                      description: `UGC Campaign with ${taskCount} missions on ${firstTask.platform}`,
                      sponsor_address: address,
                      platform_code: firstTask.platform,
                      reward_amount_per_user: ethReward.toString(), 
                      max_participants: 100,
                      txHash: receipt.transactionHash,
                      payment_token: rewardTokenAddr,
                      reward_symbol: 'ETH',
                      tasks_batch: tasksBatch.filter(t => t.title && t.link)
                    }
                  }),
                });
                toast.success("Campaign synced to explorer!");
              } catch (logErr) {
                console.warn('UGC Sync failed:', logErr);
              }

              await refetchStats();
              onClose();
            }}
            onError={(err) => {
              console.error(err);
              toast.error("Failed: " + (err.shortMessage || err.message));
            }}
          >
            <TransactionButton
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              text="PAY & CREATE MISSION"
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

function DailyClaimModal({ onClose, onSuccess, pointSettings, streakCount, profileData }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { refetch: refetchPoints, ecosystemSettings } = usePoints();
  const [isClaiming, setIsClaiming] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isCooldown, setIsCooldown] = useState(false);

  // BUG-FIX 1: Tambah refetchOnChainStats dari useUserInfo di scope DailyClaimModal
  const { stats: userData, refetch: refetchOnChainStats } = useUserInfo(address);
  // BUG-FIX 2: Hitung dailyReward dari pointSettings (hindari variabel undefined)
  const dailyReward = pointSettings?.daily_claim || ecosystemSettings?.daily_claim || 0;

  const lastDailyClaim = profileData?.lastDailyClaim
    ? Number(new Date(profileData.lastDailyClaim).getTime() / 1000)
    : (userData?.lastDailyBonusClaim ? Number(userData.lastDailyBonusClaim) : 0);
  const nextClaimTime = lastDailyClaim > 0 ? (lastDailyClaim + (ecosystemSettings?.daily_claim_cooldown_sec || 86400)) * 1000 : 0;

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

  // Helper: wrap signMessageAsync with a timeout to prevent silent hang
  // when wallet extensions conflict and lock window.ethereum as read-only.
  const signWithTimeout = useCallback(async (params, timeoutMs = 10000) => {
    return Promise.race([
      signMessageAsync(params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Wallet signature timeout – wallet extension conflict detected')), timeoutMs)
      ),
    ]);
  }, [signMessageAsync]);

  const handleClaim = async () => {
    if (isCooldown) return toast.error("Cooldown active! Come back later.");
    setIsClaiming(true);
    const tid = toast.loading("Preparing claim...");

    // Safety net: force-reset isClaiming after 60s regardless
    const safetyTimer = setTimeout(() => {
      setIsClaiming(false);
      console.warn('[DailyClaim] Safety timeout: force-reset isClaiming');
    }, 60000);

    try {
      let gasLimit;
      try {
        const estimated = await publicClient.estimateContractGas({
          address: CONTRACTS.DAILY_APP,
          abi: DAILY_APP_ABI,
          functionName: 'claimDailyBonus',
          account: address,
        });
        gasLimit = estimated;
      } catch (estErr) {
        console.warn('[DailyClaim] Gas estimation failed:', estErr.message);
        if (estErr.message?.toLowerCase().includes('user rejected')) {
          toast.dismiss(tid);
        } else {
          toast.error('Claim failed. You may have already claimed today or your Farcaster is not linked.', { id: tid });
        }
        clearTimeout(safetyTimer);
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

      // On-chain claim confirmed — XP sync is best-effort only.
      // Use signWithTimeout to avoid infinite hang from wallet extension conflict.
      toast.loading('Syncing XP...', { id: tid });
      try {
        const timestamp = new Date().toISOString();
        const message = `Sync XP for ${address}\nTimestamp: ${timestamp}`;

        let signature = null;
        try {
          // 10s timeout: if wallet is locked (EIP-6963 conflict), we'll try to sync via txHash proof alone
          signature = await signWithTimeout({ message }, 10000);
        } catch (signErr) {
          console.warn('[DailyClaim] Signature skipped/timed out, attempting sync via txHash only:', signErr.message);
        }

        const response = await fetch('/api/user-bundle', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'xp',
            wallet_address: address,
            signature, // Can be null if skipped, backend handleXpSync will verify via tx_hash
            message: signature ? message : null,
            tx_hash: hash,
          }),
        });

        const resData = await response.json();
        if (resData.ok && resData.total_xp) {
          console.log('[DailyClaim] Backend Sync OK. New XP:', resData.total_xp);
        }

        await refetchOnChainStats();
        await new Promise(r => setTimeout(r, 1500));
        await refetchPoints();

        toast.success(`+${dailyReward} XP Claimed! 🎉`, { id: tid });
        if (onSuccess) onSuccess();
        onClose();
      } catch (syncErr) {
        // Claim is already on-chain. XP sync failed (timeout or wallet conflict).
        // Log & still close cleanly — XP will be reconciled by backend polling.
        console.warn('[DailyClaim] XP sync failed or timed out:', syncErr.message);
        toast.success('Daily Claim confirmed on-chain! XP syncing in background...', { id: tid });
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      console.error('Daily Claim Error:', err);
      toast.error('Claim failed: ' + (err.shortMessage || err.message || 'Try again'), { id: tid });
    } finally {
      clearTimeout(safetyTimer);
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
              : `Claim your daily ${pointSettings?.daily_claim || 0} XP boost to climb the leaderboard!`}
          </p>
        </div>
        {streakCount > 0 && (
          <div className="flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/20 py-2 px-4 rounded-xl w-fit mx-auto animate-bounce">
            <Flame size={16} className="text-orange-500 fill-current" />
            <span className="text-sm font-black text-orange-400 italic">
              {streakCount} DAY STREAK 🔥
            </span>
          </div>
        )}
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
        : `✨ CLAIM DAILY (+${pointSettings?.daily_claim || 0} XP)`}
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
  const { ecosystemSettings } = usePoints();
  const [reqId, setReqId] = useState('');
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { refetch: refetchStats } = useUserInfo(address);
  const feeUsd = Number(ecosystemSettings?.sponsorship_listing_fee_usdc || 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
            <RefreshCw size={32} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Renew <span className="text-blue-500">Visiblity</span></h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Extend your task visibility for another **3 Days** for **${feeUsd} USDC**.
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
              onSuccess={async (receipt) => {
                toast.success("Sponsorship Extended 3 Days!");

                // Log Activity
                try {
                  const timestamp = new Date().toISOString();
                  const logDescription = `Renewed sponsorship for ID ${reqId}`;
                  const message = `Log activity for ${address}\nAction: Sponsorship Renewal\nTimestamp: ${timestamp}`;
                  const signature = await signMessageAsync({ message });

                  await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      action: 'log-activity',
                      wallet_address: address,
                      signature,
                      message,
                      category: 'PURCHASE',
                      type: 'Sponsorship Renewal',
                      description: logDescription,
                      amount: feeUsd,
                      symbol: 'USDC',
                      txHash: receipt.transactionHash,
                      metadata: { reqId: reqId }
                    }),
                  });
                } catch (logErr) {
                  console.warn('Logging sponsorship renewal failed:', logErr);
                }

                await refetchStats();
                onClose();
              }}
              onError={(err) => {
                toast.error(err.shortMessage || "Failed to renew");
              }}
            >
              <TransactionButton
                className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                text={`PAY $${feeUsd} USDC & RENEW`}
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
function RevenueClaimModal({ onClose, claimable, onSuccess }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { claimRewards } = useSBTData();
  const [isClaiming, setIsClaiming] = useState(false);
  const publicClient = usePublicClient();

  const handleClaim = async () => {
    if (claimable === 0n) return toast.error("Nothing to claim!");
    
    setIsClaiming(true);
    const tid = toast.loading("Confirming claim transaction...");
    try {
      const hash = await claimRewards();
      toast.loading("Transferring dividends... 🏦", { id: tid });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Sync to DB
      try {
        const timestamp = new Date().toISOString();
        const message = `Claim Dividends for ${address}\nTimestamp: ${timestamp}`;
        const signature = await signMessageAsync({ message });

        await fetch('/api/user-bundle', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'sync-pool-claim',
            wallet: address,
            signature,
            message,
            payload: {
              amountETH: Number(claimable).toString(),
              tier: 0, // Backend identifies from wallet anyway
              txHash: receipt.transactionHash
            }
          }),
        });
        toast.success("Dividends claimed and synced!", { id: tid });
      } catch (syncErr) {
        console.warn('Dividend sync failed:', syncErr);
        toast.success("On-chain claim success!", { id: tid });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.shortMessage || "Claim failed", { id: tid });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-sm p-8 space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto border border-indigo-500/30">
          <Coins size={40} className="text-indigo-400" />
        </div>
        
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
            Revenue <span className="text-indigo-500">Share</span>
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            Your SBT status entitles you to a share of the protocol revenue.
          </p>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl py-6 px-4">
          <p className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mb-1">Available to Claim</p>
          <p className="text-4xl font-black text-white font-mono">{Number(claimable).toFixed(6)} <span className="text-sm text-slate-500">ETH</span></p>
        </div>

        <button
          onClick={handleClaim}
          disabled={isClaiming || claimable === 0n}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
        >
          {isClaiming ? "PROCESSING..." : "CLAIM DIVIDENDS NOW"}
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
