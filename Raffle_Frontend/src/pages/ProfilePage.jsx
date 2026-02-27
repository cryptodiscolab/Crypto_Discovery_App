import { useState, useEffect } from 'react';
import {
  RefreshCw, Star, Crown, Edit, X, Save, Loader2, Users, UserCheck, ShieldCheck, Hash, AtSign, Sparkles, Award, LogOut, Copy, Check, ExternalLink, Calendar, Plus, Ticket, Share2, Globe, Flame, Zap, Shield
} from 'lucide-react';
import { useAccount, useSignMessage, useDisconnect, useWriteContract, useReadContract } from 'wagmi';
import { useFarcaster } from '../hooks/useFarcaster';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { CONTRACTS, DAILY_APP_ABI } from '../lib/contracts';

export default function ProfilePage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { syncUser, isLoading: isFarcasterLoading } = useFarcaster();
  const { writeContractAsync } = useWriteContract();

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

        {/* UGC ACTION BUTTONS */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setActiveModal('claim')}
              className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all active:scale-95"
            >
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                <Calendar size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Daily Claim</span>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const handleCreateBatch = async () => {
    if (!email) return toast.error("Email required for contact!");
    const validTasks = tasksBatch.filter(t => t.title && t.link);
    if (validTasks.length === 0) return toast.error("Add at least one task!");

    setIsSubmitting(true);
    const tid = toast.loading("Initiating UGC Sponsorship ($2 Fee)...");
    try {
      const titles = validTasks.map(t => t.title);
      const links = validTasks.map(t => t.link);

      // Call contract with $2 USDC Platform Fee (logic inside buySponsorshipWithToken)
      await writeContractAsync({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'buySponsorshipWithToken',
        args: [
          0, // Bronze
          titles,
          links,
          email,
          BigInt(5 * 1e18) // 5 Tokens Min Reward Pool
        ],
      });

      toast.success("Sponsorship Created! Duration: 3 Days.", { id: tid });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed: " + (error.shortMessage || error.message), { id: tid });
    } finally {
      setIsSubmitting(false);
    }
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

        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-indigo-400">
            <span>Platform Fee</span>
            <span>$2.00 USDC</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Duration</span>
            <span>3 Days Active</span>
          </div>
          <p className="text-[9px] text-slate-500 leading-relaxed italic pt-2">
            Sponsorship includes a $2 platform fee and a 5 token reward pool.
            Tasks expire in 3 days but can be extended if reward tokens remain.
            Titles and Links cannot be changed after creation.
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-white/5 bg-black/50 backdrop-blur-md">
        <button
          onClick={handleCreateBatch}
          disabled={isSubmitting}
          className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? "TRANSACTING..." : "PAY & CREATE BATCH"}
        </button>
      </div>
    </div>
  );
}

function DailyClaimModal({ onClose }) {
  const { address } = useAccount();
  const [isClaiming, setIsClaiming] = useState(false);
  const { writeContractAsync } = useWriteContract();

  // Read userStats to check cooldown
  const { data: userData } = useReadContract({
    address: CONTRACTS.DAILY_APP,
    abi: DAILY_APP_ABI,
    functionName: 'userStats',
    args: [address],
    query: {
      enabled: !!address,
    }
  });

  // userData[5] is lastDailyBonusClaim (timestamp in seconds)
  const lastClaim = userData ? Number(userData[5]) : 0;
  const nextClaimTime = lastClaim > 0 ? (lastClaim + 24 * 60 * 60) * 1000 : 0;
  const isCooldown = Date.now() < nextClaimTime;

  // Formatting remaining time if on cooldown
  const getRemainingTime = () => {
    if (!isCooldown) return null;
    const diff = nextClaimTime - Date.now();
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m remaining`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-sm:max-w-xs max-w-sm p-8 space-y-6 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${isCooldown ? 'bg-slate-500/10' : 'bg-emerald-500/20 animate-pulse'}`}>
          <Sparkles size={40} className={isCooldown ? 'text-slate-500' : 'text-emerald-400'} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Daily <span className="text-emerald-500">Mojo</span></h2>
          <p className="text-xs text-slate-400 mt-2">
            {isCooldown
              ? "You've claimed your bonus! Come back later for more XP."
              : "Claim your daily XP boost to climb the leaderboard!"}
          </p>
          {isCooldown && (
            <p className="text-[10px] text-indigo-400 font-mono mt-2 uppercase tracking-widest">{getRemainingTime()}</p>
          )}
        </div>

        <button
          onClick={async () => {
            if (isCooldown) return toast.error("Cooldown active! Please wait.");
            setIsClaiming(true);
            const tid = toast.loading("Connecting to contract...");
            try {
              console.log("[DailyClaim] Executing on:", CONTRACTS.DAILY_APP);

              // More robust gas handling: Estimate + small buffer (1.2x)
              // to satisfy user request for low/reasonable gas while avoiding "too low" errors.
              await writeContractAsync({
                address: CONTRACTS.DAILY_APP,
                abi: DAILY_APP_ABI,
                functionName: 'claimDailyBonus',
              });
              toast.success("+100 XP Claimed!", { id: tid });
              onClose();
            } catch (err) {
              console.error("Daily Claim Error:", err);
              // Smart distinction of errors
              const errMsg = err.shortMessage || err.message || "";
              if (errMsg.includes("User rejected")) {
                toast.error("Transaction cancelled", { id: tid });
              } else if (errMsg.includes("CooldownActive") || errMsg.includes("already claimed")) {
                toast.error("Already claimed today!", { id: tid });
              } else {
                toast.error("Claim failed: " + (err.shortMessage || "Contract error"), { id: tid });
              }
            } finally {
              setIsClaiming(false);
            }
          }}
          disabled={isClaiming || isCooldown}
          className={`w-full py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${isCooldown ? 'bg-slate-700 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        >
          {isClaiming ? "CONNECTING..." : isCooldown ? "CLAIMED" : "CLAIM DAILY (+100 XP)"}
        </button>
        <button onClick={onClose} className="text-[10px] text-slate-500 uppercase font-black hover:text-white transition-colors">Maybe later</button>
      </div>
    </div>
  );
}

function RenewSponsorshipModal({ onClose }) {
  const [reqId, setReqId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const handleRenew = async () => {
    if (!reqId) return toast.error("Please enter a Sponsorship ID");

    setIsSubmitting(true);
    const tid = toast.loading("Renewing Sponsorship ($2)...");
    try {
      await writeContractAsync({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'renewSponsorship',
        args: [BigInt(reqId)],
      });
      toast.success("Sponsorship Extended 3 Days!", { id: tid });
      onClose();
    } catch (err) {
      toast.error(err.shortMessage || "Failed to renew", { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

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

          <button
            onClick={handleRenew}
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? "EXTENDING..." : "PAY $2 USDC & RENEW"}
          </button>
          <button onClick={onClose} className="w-full text-[10px] text-slate-600 uppercase font-black hover:text-white transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
