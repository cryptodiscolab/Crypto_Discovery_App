import { useState, useEffect } from 'react';
import {
  RefreshCw, Star, Crown, Edit, X, Save, Loader2
} from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { useFarcaster } from '../hooks/useFarcaster'; // Asumsi lo pake ini buat read data awal
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { syncUser, isLoading: isFarcasterLoading } = useFarcaster();

  // State untuk Mode Edit
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State Form Data
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    avatarUrl: ''
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
      .maybeSingle(); // Pakai maybeSingle() biar gak error JSON coercion kalau data kosong

    if (error) {
      console.warn("Profile fetching error:", error.message);
    }

    if (data) {
      setFormData({
        displayName: data.display_name || '',
        bio: data.bio || '',
        avatarUrl: data.pfp_url || ''
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
            display_name: formData.displayName,
            bio: formData.bio,
            avatar_url: formData.avatarUrl
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
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="w-6 h-6 text-yellow-500" /> User Profile
        </h1>

        {!isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!address) return toast.error("Connect wallet dulu!");
                const toastId = toast.loading("Syncing with Farcaster...");
                try {
                  const result = await syncUser(address, true);
                  if (result) {
                    await fetchProfile();
                    toast.success("Synced successfully!", { id: toastId });
                  } else {
                    // Cek apa ada error spesifik dari hook
                    toast.error("Sync failed. Check console or try again.", { id: toastId });
                  }
                } catch (e) {
                  console.error("Sync Click Error:", e);
                  toast.error("Sync failed: " + e.message, { id: toastId });
                }
              }}
              disabled={isFarcasterLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {isFarcasterLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Sync Farcaster
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Edit size={16} /> Edit Profile
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <X size={20} />
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save
            </button>
          </div>
        )}
      </div>

      {/* FORM INPUTS */}
      <div className="space-y-4 bg-gray-900 p-6 rounded-xl border border-gray-800">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Display Name</label>
          <input
            type="text"
            disabled={!isEditing}
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            className="w-full bg-black border border-gray-700 rounded p-2 text-white disabled:text-gray-500 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Bio</label>
          <textarea
            disabled={!isEditing}
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="w-full bg-black border border-gray-700 rounded p-2 text-white h-24 disabled:text-gray-500 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}
