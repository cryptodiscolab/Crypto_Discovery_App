import { useState, useEffect } from 'react';
import {
  RefreshCw, Star, Crown, Edit, X, Save, Loader2, Users, UserCheck, ShieldCheck, Hash, AtSign, Sparkles, Award, LogOut, Copy, Check, ExternalLink
} from 'lucide-react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { useFarcaster } from '../hooks/useFarcaster';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
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
    xp: 0,
    rankName: 'Rookie'
  });

  const [copied, setCopied] = useState(false);

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
    if (!address) return toast.error("Connect wallet dulu bos!");

    setIsSaving(true);
    const toastId = toast.loading("Meminta tanda tangan wallet...");

    try {
      // 1. Siapkan Pesan Unik (Anti-Replay Attack)
      const messageToSign = `Update Profile for ${address.toLowerCase()} at ${new Date().toISOString()}`;

      // 2. Trigger Wallet Signature
      const signature = await signMessageAsync({ message: messageToSign });

      toast.loading("Verifikasi & Simpan ke Server...", { id: toastId });

      // 3. Kirim ke API
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: address.toLowerCase(),
          signature: signature,
          message: messageToSign,
          profile_data: {
            display_name: profileData.displayName,
            bio: profileData.bio,
            avatar_url: profileData.avatarUrl
            // Note: Data Neynar (FID, Username, Stats) biasanya read-only dari sync, tidak diedit manual
          }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal update profile");
      }

      // 4. Sukses!
      toast.success("Profile berhasil diupdate!", { id: toastId });
      setIsEditing(false);

      // Refresh data di UI biar sinkron
      fetchProfile();

    } catch (error) {
      console.error("Save Error:", error);
      if (error.code === 4001 || error.message.includes("rejected")) {
        toast.error("Tanda tangan dibatalkan user", { id: toastId });
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
                      if (!address) return toast.error("Connect wallet dulu!");
                      const toastId = toast.loading("Syncing...");
                      try {
                        await syncUser(address, true);
                        await fetchProfile();
                        toast.success("Synced!", { id: toastId });
                      } catch (e) {
                        toast.error("Failed", { id: toastId });
                      }
                    }}
                    disabled={isFarcasterLoading}
                    className="px-4 py-1.5 rounded-full border border-white/20 text-sm font-medium hover:bg-white/5 active:scale-95 transition-transform"
                  >
                    {isFarcasterLoading ? <Loader2 className="animate-spin w-4 h-4" /> : "Sync"}
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-1.5 rounded-full border border-white/20 text-sm font-medium hover:bg-white/5 active:scale-95 transition-transform"
                  >
                    Edit
                  </button>
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
