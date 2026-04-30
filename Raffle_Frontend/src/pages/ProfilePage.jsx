import { useState, useEffect, useCallback, startTransition } from 'react';
import {
  RefreshCw, Star, Crown, Edit, X, Save, Loader2, Users, ShieldCheck, Sparkles, Award, LogOut, Copy, Check, ExternalLink, Calendar, Plus, Ticket, Share2, Globe, Flame, Zap, Shield, ArrowUpCircle, Video, Instagram, Heart, Repeat, MessageCircle, Coins, Mail, Twitter, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useSignMessage, useDisconnect, useWriteContract, useReadContract, usePublicClient, useWaitForTransactionReceipt } from 'wagmi';
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
import { usePriceOracle } from '../hooks/usePriceOracle';
import { SwapModal } from '../components/SwapModal';
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
    last_daily_bonus_claim: null,
    google_id: null,
    google_email: '',
    twitter_id: null,
    twitter_username: '',
    oauth_provider: null,
    base_username: '',
    is_base_social_verified: false,
    rankName: 'ROOKIE'
  });

  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'claim', 'task', 'raffle', 'revenue', 'swap'
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
        oauth_provider: data.oauth_provider || null,
        base_username: data.base_username || '',
        is_base_social_verified: data.is_base_social_verified || false
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

  const handleLinkBaseSocial = async () => {
    if (!address) return toast.error("Connect wallet first!");
    
    const tid = toast.loading("Resolving Basename...");
    try {
      const timestamp = new Date().toISOString();
      const message = `Verify Base Social Identity\nWallet: ${address.toLowerCase()}\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch('/api/user-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-base-social',
          wallet_address: address.toLowerCase(),
          signature,
          message
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Sync failed");

      toast.success(`Success! Linked as ${result.basename}`, { id: tid });
      fetchProfile();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to link Base Social", { id: tid });
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
    <div className="w-full text-slate-100 pb-28 md:pb-8">
      {/* 
        FLAT-NATIVE HEADER 
        Minimalist elevation via bg contrast.
      */}

      {/* Top Action Bar (Mobile only usually, or simplified header) */}
      <div className="max-w-screen-md mx-auto">
        {/* AVATAR & MAIN INFO */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex justify-between items-start mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[#050505] overflow-hidden border-2 border-white/10 shadow-xl">
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
                    className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors ${!profileData.fid ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                  >
                    {isFarcasterLoading ? (
                      <Loader2 className="animate-spin w-4 h-4" />
                    ) : !profileData.fid ? (
                      "SYNC FARCASTER"
                    ) : (
                      "REFRESH"
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-1.5 rounded-full border border-white/20 label-native hover:bg-white/10 active:scale-95 transition-transform"
                  >
                    EDIT
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
                    className="px-4 py-1.5 rounded-full border border-red-500/50 text-red-400 label-native active:scale-95 transition-transform"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-full bg-white text-black label-native active:scale-95 transition-transform"
                  >
                    {isSaving ? "SAVING..." : "SAVE"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {!profileData.fid && !profileData.google_id && !profileData.twitter_id && !isEditing && (
            <div className="px-4 mb-6">
              <div className="p-4 bg-zinc-500/10 border border-zinc-500/20 rounded-2xl flex items-start gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-zinc-500/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-zinc-400" />
                </div>
                <div className="flex-1">
                  <p className="label-native text-zinc-300 mb-1">LINK A SOCIAL ACCOUNT</p>
                  <p className="label-native text-slate-400 leading-relaxed">
                    Link your <b>Farcaster</b>, <b>Google</b>, or <b>X (Twitter)</b> account below to enhance your profile and unlock social task verification.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {isEditing ? (
              <div className="space-y-1">
                <p className="text-[11px] font-black text-white uppercase tracking-widest opacity-60">Display Name</p>
                <p className="text-lg font-black text-white italic">{profileData.username || "Anonymous Disco"}</p>
                <label className="admin-label">Avatar URL (GIF/PNG/WebP)</label>
                <input
                  type="url"
                  maxLength={500}
                  value={profileData.avatarUrl}
                  onChange={(e) => setProfileData({ ...profileData, avatarUrl: e.target.value })}
                  className="input-native"
                  placeholder="https://example.com/my-avatar.gif"
                />
                <p className="text-[11px] text-slate-500 mt-1">Use direct links. Avoid huge files for better loading performance.</p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white uppercase tracking-tighter italic leading-none">{profileData.displayName || 'ANONYMOUS DISCO'}</h2>
                {profileData.is_base_social_verified && (
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]" title="Verified Base Social Identity">
                    <ShieldCheck size={12} className="text-white" />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-black uppercase tracking-widest">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">{profileData.total_following || 0}</span>
                    <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest">FOLLOWING</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">{profileData.total_followers || 0}</span>
                    <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest">FOLLOWERS</span>
                  </div>
                  <span className="text-slate-500">@</span>
                  <input
                    type="text"
                    maxLength={30}
                    value={profileData.username || ''}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    className="bg-transparent border-b border-gray-700 py-0.5 text-[11px] font-black text-slate-400 focus:border-indigo-500 outline-none w-32 uppercase tracking-widest"
                    placeholder="USERNAME"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="label-native text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      TIER {onChainUserData?.currentTier?.toString() || '0'} RESIDENT
                    </span>
                  </div>
                  <span className="label-native text-slate-400 whitespace-nowrap">@{profileData.username || 'USERNAME'}</span>
                  <div 
                    onClick={() => onChainUserData?.currentTier < potentialTier && startTransition(() => setActiveModal('upgrade'))}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all cursor-pointer
                      ${onChainUserData?.currentTier < potentialTier 
                        ? 'bg-indigo-500/20 border-indigo-500/40 animate-pulse' 
                        : 'bg-zinc-800/50 border-white/10'}`}
                  >
                    <span className="label-native text-indigo-400">
                      {profileData.rankName}
                    </span>
                    {onChainUserData?.currentTier < potentialTier && <ArrowUpCircle size={10} className="text-indigo-400" />}
                  </div>
                  
                  {/* UNDERDOG BONUS INDICATOR */}
                  {(onChainUserData?.currentTier === 1 || onChainUserData?.currentTier === 2) && 
                   onChainUserData?.lastActivity > 0 && 
                   (Math.floor(Date.now() / 1000) <= onChainUserData.lastActivity + 48 * 3600) && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 label-native text-amber-500 animate-pulse">
                      <Zap size={8} /> CATCH-UP ACTIVE
                    </div>
                  )}
                </div>
              )}
              {profileData.fid && !isEditing && <span className="px-1.5 py-0.5 rounded bg-white/5 label-native text-slate-500">FID: {profileData.fid}</span>}
            </div>
          </div>

          <div className="mt-4">
            {isEditing ? (
              <textarea
                maxLength={160}
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                className="w-full bg-transparent border border-gray-700 rounded-xl p-3 content-native text-slate-300 focus:border-indigo-500 outline-none h-24"
                placeholder="Share your story..."
              />
            ) : (
              <p className="content-native text-slate-300 leading-relaxed whitespace-pre-wrap">
                {profileData.bio || "NO BIO YET."}
              </p>
            )}
          </div>

          {/* FOLLOW STATS & WALLET */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex gap-1">
              <span className="value-native text-white">{profileData.followingCount.toLocaleString()}</span>
              <span className="label-native text-slate-500">FOLLOWING</span>
            </div>
            <div className="flex gap-1">
              <span className="value-native text-white">{profileData.followerCount.toLocaleString()}</span>
              <span className="label-native text-slate-500">FOLLOWERS</span>
            </div>
            {profileData.streakCount > 0 && (
              <div className="flex gap-1 items-center bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                <Flame size={12} className="text-orange-500 fill-current" />
                <span className="label-native text-orange-500">{profileData.streakCount} DAY STREAK</span>
              </div>
            )}
            <div
              className="flex items-center gap-1 text-slate-500 cursor-pointer hover:text-indigo-400 transition-colors ml-auto"
            >
              <div className={`w-2 h-2 rounded-full ${address ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="value-native font-mono" onClick={handleCopyAddress}>
                {address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Connect Wallet'}
              </span>
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} onClick={handleCopyAddress} />}
              {address && (
                <a 
                  href={`https://base.app/profile/${address}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="ml-1 p-1 hover:bg-white/5 rounded-full transition-colors text-indigo-400"
                  title="View on Base Profile"
                >
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* DIVIDER */}
        <div className="h-px bg-white/5 w-full my-2" />

        {/* TIER UPGRADE PROMPT (MINIMALIST) */}
        {onChainUserData?.currentTier < potentialTier && (
          <div className="mx-4 mb-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3 premium-glow-indigo">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400" />
              <div className="flex flex-col">
                <span className="label-native text-indigo-300">
                  Ascension Ready: {getTierName(potentialTier)}
                </span>
                <span className="label-native text-slate-500">Mint SBT for {getTierName(potentialTier)} Multiplier</span>
              </div>
            </div>
            <button 
              onClick={() => startTransition(() => setActiveModal('upgrade'))}
              className="px-4 py-2 rounded-xl bg-yellow-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] active:scale-95"
            >
              Mint Status
            </button>
          </div>
        )}

        {/* UGC ACTION BUTTONS */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => startTransition(() => setActiveModal('claim'))}
              className={`flex flex-col items-center justify-center gap-1 p-4 rounded-xl transition-colors
                ${claimReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-900 text-zinc-600 opacity-50'}`}
            >
              <Calendar size={18} />
              <span className="label-native">DAILY BONUS</span>
              {claimCountdown && <span className="value-native font-mono">{claimCountdown}</span>}
            </button>

            <button
              onClick={() => startTransition(() => setActiveModal('task'))}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-[#080808] border border-white/5 text-zinc-400 hover:bg-zinc-800 transition-all hover:border-white/10 group"
            >
              <Plus size={18} className="group-hover:text-white transition-colors" />
              <span className="label-native mb-0">CREATE MISSION</span>
            </button>

            <button
              onClick={() => startTransition(() => navigate('/create-raffle'))}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-[#080808] border border-white/5 text-zinc-400 hover:bg-zinc-800 transition-all hover:border-white/10 group"
            >
              <Ticket size={18} className="group-hover:text-white transition-colors" />
              <span className="label-native mb-0">LAUNCH RAFFLE</span>
            </button>

            <button
              onClick={() => startTransition(() => setActiveModal('renew'))}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-[#080808] border border-white/5 text-zinc-400 hover:bg-zinc-800 transition-all hover:border-white/10 group"
            >
              <RefreshCw size={18} className="group-hover:text-white transition-colors" />
              <span className="label-native mb-0">RENEW JOB</span>
            </button>

            {onChainUserData?.currentTier > 0 && (
              <button
                onClick={() => startTransition(() => setActiveModal('revenue'))}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all relative overflow-hidden group border
                  ${claimableAmount > 0n 
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30 shadow-lg shadow-indigo-500/10' 
                    : 'bg-[#080808] border-white/5 text-zinc-600'}`}
              >
                {claimableAmount > 0n && (
                   <div className="absolute inset-0 bg-indigo-500/10 animate-pulse pointer-events-none" />
                )}
                <Coins size={18} className={claimableAmount > 0n ? "animate-bounce" : ""} />
                <span className="label-native">CLAIM DIVIDENDS</span>
                {claimableAmount > 0n && (
                  <span className="value-native font-mono text-indigo-300">
                    {Number(claimableAmount).toFixed(4)} ETH
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => startTransition(() => setActiveModal('swap'))}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all group shadow-lg shadow-indigo-500/5"
            >
              <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
              <span className="label-native mb-0">GET USDC / SWAP</span>
            </button>
          </div>
        </div>

        {/* MODALS */}
        {activeModal === 'task' && <CreateTaskModal onClose={() => setActiveModal(null)} onRequestSwap={() => setActiveModal('swap')} />}
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
        <div className="flex flex-col bg-[#080808] border-y border-white/5">
          {/* Neynar Score */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 active:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">NEYNER SCORE</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">REPUTATION HEALTH</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-xl font-mono font-black ${profileData.neynarScore >= 0.9 ? 'text-green-400' : 'text-yellow-400'}`}>
                {(profileData.neynarScore * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Total XP */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 active:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                <Award size={20} />
              </div>
              <div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">TOTAL XP</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SEASON PROGRESS</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-mono font-black text-white">
                {Number(profileData.total_xp).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Rank */}
          <div className="flex items-center justify-between px-6 py-4 active:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Crown size={20} />
              </div>
              <div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">CURRENT RANK</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">LEADERBOARD TIER</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-blue-400 italic">
                {profileData.rankName?.toUpperCase() || 'ROOKIE'}
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
              <span className="label-native">
                {profileData.google_id ? 'GOOGLE LINKED' : 'LINK GOOGLE'}
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
              <span className="label-native">
                {profileData.twitter_id ? 'X LINKED' : 'LINK X (TWITTER)'}
              </span>
              {profileData.twitter_id && <Check size={10} className="text-white" />}
            </button>
 
            {/* Farcaster Identity (Existing) */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all
              ${profileData.fid && profileData.fid !== 'N/A'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                : 'bg-zinc-900 border-white/5 text-zinc-600'}`}>
              {profileData.fid && profileData.fid !== 'N/A' && <Check size={10} className="text-indigo-400" />}
            </div>

            {/* Base Social Identity (v3.42.1 Premium) */}
            <button
              onClick={handleLinkBaseSocial}
              disabled={profileData.is_base_social_verified}
              className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-all shadow-lg
                ${profileData.is_base_social_verified 
                  ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 cursor-default shadow-none' 
                  : 'bg-[#0052FF] border-[#0052FF] text-white hover:bg-[#0042CC] active:scale-95 shadow-blue-900/20'}`}>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${profileData.is_base_social_verified ? 'bg-blue-500/20' : 'bg-white/20'}`}>
                {profileData.is_base_social_verified ? <ShieldCheck size={14} /> : <Shield size={14} />}
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {profileData.is_base_social_verified ? 'IDENTITY VERIFIED' : 'VERIFY BASE IDENTITY'}
                </span>
                <span className="text-[8px] font-bold opacity-60 uppercase tracking-tighter">
                  {profileData.is_base_social_verified ? `LINKED AS ${profileData.base_username || 'BASENAME'}` : 'SYBIL PROTECTION VIA BASENAMES'}
                </span>
              </div>
            </button>
          </div>
          {profileData.google_email && (
            <p className="label-native text-slate-500 mt-2 ml-4 font-mono">
              PRIMARY IDENTITY: <span className="text-slate-400">{profileData.google_email?.toUpperCase() || ''}</span>
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
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Verified Addresses</h3>
            <div className="space-y-2">
              {profileData.verifications.map((vAddr, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <span className="font-mono text-[11px] font-black text-slate-300 uppercase tracking-widest">
                    {vAddr.slice(0, 10)}...{vAddr.slice(-8)}
                  </span>
                  <ExternalLink size={14} className="text-slate-600" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pb-safe" />
      </div>

      <SwapModal 
        isOpen={activeModal === 'swap'} 
        onClose={() => setActiveModal(null)} 
      />
    </div>
  );
}

function CreateTaskModal({ onClose, onRequestSwap }) {
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
    requiresVerification: true,
    isBaseSocialRequired: false
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

    const calls = [];

    // 1. Approve USDC for platform fee
    if (platformFee > 0n) {
      if (!CONTRACTS.USDC) throw new Error("Critical: USDC contract address is undefined. Please verify environment variables.");
      calls.push({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.DAILY_APP, platformFee],
      });
    }

    // 2. The main call
    calls.push({
      address: CONTRACTS.DAILY_APP,
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
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[11px] font-black text-indigo-400">{idx + 1}</div>
                <select
                  value={task.platform}
                  onChange={(e) => {
                    const newBatch = [...tasksBatch];
                    newBatch[idx].platform = e.target.value;
                    setTasksBatch(newBatch);
                  }}
                  className="bg-transparent text-[11px] font-black text-slate-400 outline-none uppercase tracking-widest cursor-pointer"
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
                  className="bg-transparent text-[11px] font-black text-indigo-400 outline-none uppercase tracking-widest cursor-pointer"
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
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white focus:border-indigo-500 outline-none placeholder:text-slate-600"
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
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-indigo-400 font-mono focus:border-indigo-500 outline-none placeholder:text-indigo-900"
              />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-[11px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showAdvanced ? <Shield size={14} /> : <Zap size={14} />}
            {showAdvanced ? "Hide Advanced Settings" : "Configure Sybil Filters (Optional)"}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Min Neynar Score</label>
                <input
                  type="number"
                  value={sybilFilters.minNeynarScore}
                  onChange={(e) => setSybilFilters({ ...sybilFilters, minNeynarScore: e.target.value })}
                  className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500"
                  placeholder="0-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Min Followers</label>
                <input
                  type="number"
                  value={sybilFilters.minFollowers}
                  onChange={(e) => setSybilFilters({ ...sybilFilters, minFollowers: e.target.value })}
                  className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="col-span-2 flex items-center justify-between py-2 border-t border-white/5 mt-2">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Require Power Badge</span>
                <button
                  onClick={() => setSybilFilters({ ...sybilFilters, powerBadge: !sybilFilters.powerBadge })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${sybilFilters.powerBadge ? 'bg-indigo-600' : 'bg-slate-800'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${sybilFilters.powerBadge ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              <div className="col-span-2 flex flex-col gap-1 py-3 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Shield size={12} className="fill-blue-400/20" />
                    Identity Guard
                  </span>
                  <button
                    onClick={() => setSybilFilters({ ...sybilFilters, isBaseSocialRequired: !sybilFilters.isBaseSocialRequired })}
                    className={`w-10 h-5 rounded-full transition-all relative ${sybilFilters.isBaseSocialRequired ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${sybilFilters.isBaseSocialRequired ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">
                  Require verified <span className="text-blue-400">Base Social (Basenames)</span> for high-value rewards (Pro Identity)
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">Admin Contact Email</label>
          <input
            type="email"
            placeholder="For sponsorship listing coordination"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 text-[11px] font-black uppercase tracking-widest text-white focus:border-indigo-500 outline-none placeholder:text-slate-600"
          />
        </div>

        <div className="p-5 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 space-y-5 relative overflow-hidden group">
          {/* Subtle Glow Background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] -mr-10 -mt-10" />
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between px-1">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sponsorship Asset</label>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full">
                <Shield size={10} className="text-slate-400" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Protocol Admin</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-zinc-900/50 border border-indigo-500/30 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl">⟠</div>
              <div>
                <p className="text-[11px] font-black text-white uppercase tracking-widest">Ethereum (Native)</p>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Fastest settlement & non-custodial payouts</p>
              </div>
              <Check size={16} className="ml-auto text-indigo-400" />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5 relative z-10">
            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
              <span className="text-slate-400">Platform Listing Fee</span>
              <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20">${feeUsd.toFixed(2)} USDC</span>
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                Determine Reward Pool (ETH)
                <span className="relative group cursor-help">
                  <Info size={12} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-[10px] font-bold text-slate-300 normal-case tracking-normal whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl z-50">
                    Reward pool is paid in ETH (Native).
                    <br />USDC value is real-time conversion.
                  </span>
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  value={ethReward}
                  onChange={(e) => setEthReward(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-lg font-mono font-black text-indigo-400 outline-none focus:border-indigo-500 transition-all"
                  placeholder="0.01"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end">
                  <span className="text-[11px] font-black text-white px-2 py-0.5 bg-indigo-500 rounded-md mb-1">ETH</span>
                  {rewardUsdValue > 0 && (
                    <span className="text-[11px] font-black text-slate-500 animate-in fade-in slide-in-from-right-1 duration-300 uppercase tracking-widest">
                      ≈ ${rewardUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] text-slate-500 leading-relaxed italic relative z-10">
            <div className="flex items-start gap-2">
              <Shield size={10} className="mt-0.5" />
              <span className="font-black uppercase tracking-widest">
                Standard 3-day activation. Reward pool is distributed to users who complete all {tasksBatch.length} tasks in your batch.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/5 bg-black/50 backdrop-blur-md">
        <div className="relative z-[9999] pointer-events-auto">
          <PayAndCreateMissionButton 
            calls={buildCalls()} 
            ethReward={ethReward}
            address={address}
            tasksBatch={tasksBatch}
            rewardTokenAddr={rewardTokenAddr}
            onInsufficientBalance={onRequestSwap}
            onSuccess={async (hash) => {
               toast.success("Missions Created Successfully! Syncing... 🚀");
               // ... (existing sync logic)
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
                      txHash: hash,
                      payment_token: rewardTokenAddr,
                      reward_symbol: 'ETH',
                      is_base_social_required: sybilFilters.isBaseSocialRequired,
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
          />
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
  const { stats: userData, refetch: refetchOnChainStats, isLoading: isStatsLoading } = useUserInfo(address);
  // BUG-FIX 2: Hitung dailyReward dari pointSettings (hindari variabel undefined)
  const dailyReward = pointSettings?.daily_claim || ecosystemSettings?.daily_claim || 0;

  // FIX v3.40.3: Single Source of Truth for cooldown — use on-chain data ONLY.
  // DB (profileData.lastDailyClaim) can be stale right after a claim, causing countdown de-sync.
  // On-chain lastDailyBonusClaim is the authoritative source for cooldown status.
  const lastDailyClaim = userData?.lastDailyBonusClaim
    ? Number(userData.lastDailyBonusClaim)
    : 0;
  const nextClaimTime = lastDailyClaim > 0
    ? (lastDailyClaim + (ecosystemSettings?.daily_claim_cooldown_sec || 86400)) * 1000
    : 0;

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

    // Safety net: force-reset isClaiming after 120s regardless (increased for safety)
    const safetyTimer = setTimeout(() => {
      setIsClaiming(false);
      console.warn('[DailyClaim] Safety timeout: force-reset isClaiming');
    }, 120000);

    try {
      let gasLimit;
      try {
        const estimated = await publicClient.estimateContractGas({
          address: CONTRACTS.DAILY_APP,
          abi: DAILY_APP_ABI,
          functionName: 'claimDailyBonus',
          account: address,
        });
        gasLimit = (estimated * 120n) / 100n; // 20% buffer for safety
      } catch (estErr) {
        console.warn('[DailyClaim] Gas estimation failed:', estErr.message);
        if (estErr.message?.toLowerCase().includes('user rejected')) {
          toast.dismiss(tid);
        } else {
          toast.error('Claim reverted by contract. You may have already claimed today or there is a temporary contract issue.', { id: tid });
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // On-chain claim confirmed — Back-end Sync is now triggered automatically via TxHash.
      // NO SECOND SIGNATURE REQUIRED (Fast & Safe v3.40+)
      toast.loading('Syncing XP & Streak...', { id: tid });
      
      try {
        const response = await fetch('/api/user-bundle', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'xp',
            wallet_address: address,
            signature: null, // Signature removed to prevent wallet lock-up conflicts
            message: null,
            tx_hash: hash, // Proven on-chain activity
          }),
        });

        const resData = await response.json();
        if (resData.ok) {
          console.log('[DailyClaim] Backend Sync OK. Total XP:', resData.total_xp, '| Tier:', resData.tier, '| RPC OK:', resData.rpc_ok);
        } else {
          console.warn('[DailyClaim] Backend returned non-ok:', resData);
        }

        // FIX v3.40.3: Wait 1.5s for Supabase view (v_user_full_profile) to settle,
        // then do a full parallel refetch to ensure leaderboard + tier + XP are all fresh.
        await new Promise(r => setTimeout(r, 1500));
        await Promise.all([
          refetchOnChainStats(),
          refetchPoints(),
        ]);

        toast.success(`+${dailyReward} XP Claimed! 🎉`, { id: tid });
        if (onSuccess) onSuccess(); // triggers fetchProfile() in parent for immediate UI update
        onClose();
      } catch (syncErr) {
        // Log & still close cleanly — XP was confirmed on-chain, backend will catch up.
        console.warn('[DailyClaim] XP sync fetch failed (on-chain OK):', syncErr.message);
        toast.success('Daily Claim confirmed on-chain! XP syncing in background...', { id: tid });
        // Still refetch on-chain so cooldown updates correctly in UI
        await refetchOnChainStats();
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
            DAILY <span className="text-emerald-500">MOJO</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-2 font-black uppercase tracking-widest leading-relaxed">
            {isCooldown
              ? "YOU'VE CLAIMED TODAY! NEXT BONUS IN:"
              : `CLAIM YOUR DAILY ${pointSettings?.daily_claim || 0} XP BOOST TO CLIMB THE LEADERBOARD!`}
          </p>
        </div>
        {streakCount > 0 && (
          <div className="flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/20 py-2 px-4 rounded-xl w-fit mx-auto animate-bounce">
            <Flame size={16} className="text-orange-500 fill-current" />
            <span className="text-[11px] font-black text-orange-400 uppercase tracking-widest italic">
              {streakCount} DAY STREAK 🔥
            </span>
          </div>
        )}
        {isCooldown && countdown && (
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl py-4 px-6">
            <p className="text-3xl font-black font-mono text-indigo-400 tracking-widest tabular-nums">
              {countdown}
            </p>
            <p className="text-[11px] text-slate-600 uppercase tracking-widest mt-1 font-black">HH : MM : SS</p>
          </div>
        )}
        <button
          onClick={handleClaim}
          disabled={isClaiming || isCooldown || isStatsLoading}
          className={`w-full py-4 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60
            ${isCooldown || isStatsLoading
              ? 'bg-slate-800 border border-slate-700 cursor-not-allowed text-slate-500'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
            }`}
        >
          {isClaiming
            ? '⏳ PROCESSING...'
            : isStatsLoading
            ? '⌛ LOADING STATS...'
            : isCooldown
            ? `⏰ COMEBACK IN ${countdown}`
            : `✨ CLAIM DAILY (+${pointSettings?.daily_claim || 0} XP)`}
        </button>
        <button
          onClick={onClose}
          className="text-[11px] text-slate-500 uppercase font-black tracking-widest hover:text-white transition-colors"
        >
          MAYBE LATER
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
          <p className="text-[11px] text-slate-500 leading-relaxed font-black uppercase tracking-widest">
            Extend your task visibility for another **3 Days** for **${feeUsd} USDC**.
            Title and Link will remain the same.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest px-1">Sponsorship ID</label>
            <input
              type="number"
              placeholder="Enter ID (e.g. 12)"
              value={reqId}
              onChange={(e) => setReqId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-[11px] font-black uppercase tracking-widest text-white focus:border-blue-500 outline-none placeholder:text-slate-600"
            />
          </div>

          <div className="relative z-[9999] pointer-events-auto">
            <RenewButton 
              reqId={reqId} 
              feeUsd={feeUsd} 
              address={address} 
              onSuccess={() => {
                refetchStats();
                onClose();
              }} 
            />
          </div>
          <button onClick={onClose} className="w-full text-[11px] text-slate-600 uppercase font-black tracking-widest hover:text-white transition-colors">CANCEL</button>
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
            REVENUE <span className="text-indigo-500">SHARE</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-2 font-black uppercase tracking-widest leading-relaxed">
            YOUR SBT STATUS ENTITLES YOU TO A SHARE OF THE PROTOCOL REVENUE.
          </p>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl py-6 px-4">
          <p className="text-[11px] text-indigo-300 font-black uppercase tracking-widest mb-1">Available to Claim</p>
          <p className="text-4xl font-black text-white font-mono uppercase tracking-tighter italic">
            {Number(claimable).toFixed(6)} <span className="text-[11px] text-slate-500 uppercase tracking-widest leading-none">ETH</span>
          </p>
        </div>

        <button
          onClick={handleClaim}
          disabled={isClaiming || claimable === 0n}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
        >
          {isClaiming ? "PROCESSING..." : "CLAIM DIVIDENDS NOW"}
        </button>
        <button
          onClick={onClose}
          className="text-[11px] text-slate-500 uppercase font-black tracking-widest hover:text-white transition-colors"
        >
          MAYBE LATER
        </button>
      </div>
    </div>
  );
}
function PayAndCreateMissionButton({ calls, ethReward, address, tasksBatch, rewardTokenAddr, onSuccess, onInsufficientBalance }) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClick = async () => {
    if (calls.length === 0) return toast.error("No valid tasks in batch");
    
    setIsProcessing(true);
    const tid = toast.loading("Processing transaction...");
    
    try {
      let lastHash;
      for (let i = 0; i < calls.length; i++) {
        const isApprove = calls[i].functionName === 'approve';
        toast.loading(isApprove ? "Please sign Approve USDC..." : "Please sign Create Mission...", { id: tid });
        
        const hash = await writeContractAsync(calls[i]);
        lastHash = hash;
        
        toast.loading(
          `Waiting for confirmation (${i + 1}/${calls.length})...`, 
          { id: tid }
        );
        
        await publicClient.waitForTransactionReceipt({ hash });
      }
      
      toast.success("Mission Created Successfully!", { id: tid });
      if (lastHash && onSuccess) onSuccess(lastHash);
      
    } catch (err) {
      console.error('[PayAndCreateMission] Error:', err);
      if (err.message?.toLowerCase().includes('insufficient funds') || err.message?.toLowerCase().includes('exceeds balance')) {
        toast.error("Insufficient balance. Redirecting to Swap...", { id: tid });
        if (onInsufficientBalance) onInsufficientBalance();
      } else {
        toast.error(err.shortMessage || err.message || "Transaction failed", { id: tid });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isProcessing}
      className={`w-fit mx-auto px-12 block bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl text-white text-[11px] font-black uppercase tracking-widest transition-all ${isProcessing ? 'opacity-50' : ''}`}
    >
      {isProcessing ? "PROCESSING..." : "CREATE"}
    </button>
  );
}

function RenewButton({ reqId, feeUsd, address, onSuccess }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    const syncLog = async () => {
      if (isSuccess && hash) {
        toast.success("Sponsorship Extended 3 Days!");
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
              txHash: hash,
              metadata: { reqId: reqId }
            }),
          });
        } catch (logErr) {
          console.warn('Logging sponsorship renewal failed:', logErr);
        }
        onSuccess();
      }
    };
    if (isSuccess) syncLog();
  }, [isSuccess, hash, address, feeUsd, reqId, signMessageAsync, onSuccess]);

  const handleRenew = () => {
    if (!reqId) return toast.error("Enter a valid ID");
    writeContract({
      address: CONTRACTS.DAILY_APP,
      abi: DAILY_APP_ABI,
      functionName: 'renewSponsorship',
      args: [BigInt(reqId)],
    });
  };

  return (
    <button
      onClick={handleRenew}
      disabled={isPending || isConfirming}
      className={`w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all ${isPending || isConfirming ? 'opacity-50' : ''}`}
    >
      {isPending ? "SIGNING..." : isConfirming ? "WAITING..." : `PAY $${feeUsd} USDC & RENEW`}
    </button>
  );
}
