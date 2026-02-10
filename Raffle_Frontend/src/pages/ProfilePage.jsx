import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  TrendingUp,
  Users,
  Globe,
  LogOut,
  Trash2,
  RefreshCw,
  Star
} from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { useFarcaster } from '../hooks/useFarcaster';
import toast from 'react-hot-toast';

/**
 * High-Performance Profile Hub (React 18 Optimized).
 * Reverts @neynar/ui to custom Tailwind to resolve React 19 peer-dep conflicts.
 */
export function ProfilePage() {
  const { userAddress } = useParams();
  const { address: connectedAddress, isConnected, disconnect } = useAccount();
  const navigate = useNavigate();

  // Target Address Logic: Use URL param or connected wallet
  const targetAddress = userAddress || connectedAddress;
  const isOwnProfile = !userAddress || userAddress.toLowerCase() === connectedAddress?.toLowerCase();

  const { user, isLoading: isFarcasterLoading, error, syncUser, clearCache } = useFarcaster(targetAddress);
  const [isSyncing, setIsSyncing] = useState(false);

  // Global Purge Strategy (User side maintenance)
  const handleGlobalPurge = useCallback(() => {
    localStorage.clear();
    toast.success('System Cache Purged. Re-initializing...');
    setTimeout(() => window.location.reload(), 1000);
  }, []);

  const handleManualRefresh = useCallback(() => {
    if (!targetAddress) return;
    setIsSyncing(true);
    clearCache(targetAddress);
    syncUser(targetAddress, true).finally(() => {
      setTimeout(() => setIsSyncing(false), 500);
      toast.success('Profile Refresh Triggered');
    });
  }, [targetAddress, clearCache, syncUser]);

  // Derived Social Data
  const socialData = useMemo(() => ({
    display_name: user?.farcaster_user?.display_name || user?.display_name || 'Anonymous User',
    username: user?.farcaster_user?.username || 'user',
    pfp_url: user?.farcaster_user?.pfp_url || `https://avatar.vercel.sh/${targetAddress}.svg`,
    bio: user?.farcaster_user?.profile?.bio?.text || 'Standard Disco Explorer',
    follower_count: user?.farcaster_user?.follower_count || 0,
    following_count: user?.farcaster_user?.following_count || 0,
    power_badge: user?.farcaster_user?.power_badge || false,
    trust_score: user?.trust_score || 0
  }), [user, targetAddress]);

  if (!isConnected && !userAddress) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl max-w-sm">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Identity Locked</h2>
          <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">Connect your wallet to access your profile and reputation stats.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-indigo-600 py-4 rounded-2xl text-white font-bold hover:bg-indigo-500 transition-all shadow-xl active:scale-95 text-xs uppercase tracking-widest"
          >
            Connect Identity
          </button>
        </div>
      </div>
    );
  }

  if (isFarcasterLoading && !user) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-pulse">
        <div className="bg-slate-900/50 h-64 rounded-[2rem]"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-slate-900/50 h-32 rounded-2xl"></div>
          <div className="bg-slate-900/50 h-32 rounded-2xl"></div>
          <div className="bg-slate-900/50 h-32 rounded-2xl"></div>
          <div className="bg-slate-900/50 h-32 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 text-slate-100">

      {/* Premium Profile Header */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-900/40 to-purple-900/40"></div>

        <div className="relative pt-16 px-6 pb-8 md:px-10">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6">

            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              {/* Profile Picture */}
              <div className="w-32 h-32 rounded-full border-4 border-slate-900 bg-slate-800 overflow-hidden shadow-2xl relative">
                <img src={socialData.pfp_url} alt="Profile" className="w-full h-full object-cover" />
              </div>

              <div className="text-center md:text-left mb-2">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{String(socialData.display_name)}</h1>
                  {socialData.power_badge && <TrendingUp className="w-5 h-5 text-indigo-400" />}
                </div>
                <p className="text-indigo-400 font-mono text-sm">@{String(socialData.username)}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                    {socialData.power_badge ? <Star className="w-3 h-3 fill-indigo-400" /> : <Shield className="w-3 h-3" />}
                    {socialData.power_badge ? 'Active Identity' : 'Standard User'}
                  </span>
                  {isOwnProfile && (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Owner
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleManualRefresh}
                disabled={isSyncing}
                className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl flex items-center justify-center transition-all border border-slate-700 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>

            </div>
          </div>

          <div className="mt-8 border-t border-slate-800 pt-6">
            <p className="text-slate-400 text-sm font-medium leading-relaxed italic">
              "{String(socialData.bio)}"
            </p>
          </div>
        </div>
      </div>

      {/* Social Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Followers', value: socialData.follower_count.toLocaleString(), icon: Users, color: 'indigo' },
          { label: 'Following', value: socialData.following_count.toLocaleString(), icon: Globe, color: 'purple' },
          { label: 'Trust Score', value: socialData.trust_score.toFixed(1), icon: Shield, color: 'emerald' },
          { label: 'Points', value: user?.points ? String(user.points) : '0', icon: Trophy, color: 'amber' }
        ].map((stat, i) => {
          const IconComponent = stat.icon;
          return (
            <div key={i} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-lg">
              <div className={`w-10 h-10 bg-${stat.color}-500/10 rounded-xl flex items-center justify-center mb-4`}>
                <IconComponent className={`w-5 h-5 text-${stat.color}-500`} />
              </div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-white tracking-tighter">{String(stat.value)}</p>
            </div>
          );
        })}
      </div>

      {/* Maintenance Controls (Admin Mode) */}
      {isOwnProfile && (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-white font-black uppercase tracking-widest text-xs mb-1">Local Identity maintenance</h3>
            <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Purge local cache and re-sync from protocol nodes.</p>
          </div>
          <button
            onClick={handleGlobalPurge}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all hover:text-red-400 hover:border-red-400/20"
          >
            <Trash2 className="w-4 h-4" />
            Global System Purge
          </button>
        </div>
      )}

    </div>
  );
}

// Minimal helpers
const Trophy = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
);
