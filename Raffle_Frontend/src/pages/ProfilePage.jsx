import { useState, useEffect } from 'react';
import {
  RefreshCw, Star, Crown, Edit, X, Save, Loader2, Users, UserCheck, ShieldCheck, Hash, AtSign, Sparkles, Award
} from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { useFarcaster } from '../hooks/useFarcaster';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
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
    totalXp: 0,
    rankName: 'Rookie'
  });

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
        totalXp: data.total_xp || 0,
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

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600">
          <Crown className="w-8 h-8 text-yellow-500" />
          User Profile
        </h1>

        <div className="flex gap-2 w-full md:w-auto">
          {!isEditing ? (
            <>
              <button
                onClick={async () => {
                  if (!address) return toast.error("Connect wallet dulu!");
                  const toastId = toast.loading("Syncing with Farcaster...");
                  try {
                    const result = await syncUser(address, true);
                    if (result) {
                      await fetchProfile();
                      toast.success("Sync Complete! Data updated.", { id: toastId });
                    } else {
                      toast.error("Sync failed. Check console.", { id: toastId });
                    }
                  } catch (e) {
                    console.error("Sync Click Error:", e);
                    toast.error("Sync failed: " + e.message, { id: toastId });
                  }
                }}
                disabled={isFarcasterLoading}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition disabled:opacity-50 backdrop-blur-sm"
              >
                {isFarcasterLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Sync Farcaster
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition backdrop-blur-sm"
              >
                <Edit size={16} /> Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
              >
                <X size={20} />
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-900/20"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* LEFT COLUMN: MAIN PROFILE CARD */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-gray-800 overflow-hidden border-2 border-gray-700 shadow-lg">
                  {profileData.avatarUrl ? (
                    <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <Users size={32} />
                    </div>
                  )}
                </div>
                {profileData.powerBadge && (
                  <div className="absolute -top-1 -right-1 bg-yellow-500/20 text-yellow-400 p-1 rounded-full border border-yellow-500/50" title="Power User">
                    <Star size={12} fill="currentColor" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 text-white font-bold text-lg focus:border-purple-500 focus:outline-none"
                    placeholder="Display Name"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-white truncate">{profileData.displayName || 'No Name Set'}</h2>
                )}

                <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                  <AtSign size={14} />
                  <span>{profileData.username || address?.slice(0, 6) + '...' + address?.slice(-4)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bio</label>
              {isEditing ? (
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-gray-300 h-32 focus:border-purple-500 focus:outline-none resize-none"
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <div className="bg-black/30 rounded-lg p-4 border border-gray-800 min-h-[5rem]">
                  <p className="text-gray-300 whitespace-pre-wrap">{profileData.bio || "No bio yet."}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STATS & NEYNAR DATA */}
        <div className="space-y-4">

          {/* Stats Card */}
          <div className="glass-card p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Hash className="text-purple-500" size={20} /> Social Stats
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 p-3 rounded-lg border border-gray-800/50">
                <div className="text-xs text-gray-500 mb-1">Followers</div>
                <div className="text-xl font-bold text-white">{profileData.followerCount.toLocaleString()}</div>
              </div>
              <div className="bg-black/30 p-3 rounded-lg border border-gray-800/50">
                <div className="text-xs text-gray-500 mb-1">Following</div>
                <div className="text-xl font-bold text-white">{profileData.followingCount.toLocaleString()}</div>
              </div>
              <div className="bg-black/30 p-3 rounded-lg border border-gray-800/50 col-span-2 flex justify-between items-center">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Neynar Score</div>
                  <div className={`text-xl font-bold ${profileData.neynarScore >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {(profileData.neynarScore * 100).toFixed(1)}%
                  </div>
                </div>
                <ShieldCheck className={profileData.neynarScore >= 0.9 ? "text-green-500" : "text-yellow-500"} size={24} />
              </div>
            </div>
          </div>

          {/* Game Progress Card */}
          <div className="glass-card p-5 border-blue-500/20 bg-blue-500/5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="text-blue-400" size={20} /> Game Progress
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-blue-600/10 p-4 rounded-xl border border-blue-500/20">
                <div>
                  <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Current Rank</div>
                  <div className="text-2xl font-black text-white">{profileData.rankName}</div>
                </div>
                <Award className="text-blue-400 w-10 h-10" />
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-gray-800/50">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs text-gray-400 font-bold uppercase">Total XP Balance</span>
                  <span className="text-2xl font-black text-yellow-500">{Number(profileData.totalXp).toLocaleString()}</span>
                </div>
                {/* Visual progress bar could be added here if we had max_xp info */}
              </div>
            </div>
          </div>

          {/* Farcaster ID Card */}
          <div className="glass-card p-5">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Farcaster ID</div>
                <div className="text-2xl font-mono text-white tracking-widest">{profileData.fid || '---'}</div>
              </div>
              <div className="h-10 w-10 bg-purple-900/30 rounded-full flex items-center justify-center border border-purple-500/20">
                <UserCheck className="text-purple-400" size={20} />
              </div>
            </div>
          </div>

          {/* Verifications (Optional) */}
          {profileData.verifications && profileData.verifications.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Verified Addresses</h3>
              <div className="flex flex-col gap-2">
                {profileData.verifications.map((vAddr, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-300 font-mono bg-black/30 p-2 rounded border border-gray-800">
                    <span className={`w-2 h-2 rounded-full ${vAddr.toLowerCase() === address?.toLowerCase() ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    {vAddr.slice(0, 6)}...{vAddr.slice(-4)}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
