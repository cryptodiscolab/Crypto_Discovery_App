import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useParams, Link } from 'react-router-dom';
import {
  Ticket,
  Trophy,
  Gift,
  Wallet,
  ExternalLink,
  Timer as TimerIcon,
  RefreshCw,
  Award,
  Zap,
  Users,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { usePoints } from '../shared/context/PointsContext';
import { useRaffle } from '../hooks/useRaffle';
import { useCMS } from '../hooks/useCMS';
import { useFarcaster } from '../hooks/useFarcaster';
import { SBTRewardsDashboard } from '../components/SBTRewardsDashboard';
import { handleDailyClaim, requestSBTMint } from '../dailyAppLogic';
import { useSBT } from '../hooks/useSBT';
import toast from 'react-hot-toast';

/**
 * Mobile Profile Optimization Strategy:
 * 1. Flat UI: Solid backgrounds (#0B0E14) for fast mobile rendering.
 * 2. Skeleton States: No-jank loading feedback.
 * 3. Neynar Integration: Social graph data (Followers/Following/Trust).
 */
export function ProfilePage() {
  const { userAddress } = useParams();
  const { address: connectedAddress, isConnected } = useAccount();

  // Target user: URL param if available, otherwise fallback to connected wallet
  const targetAddress = (userAddress || connectedAddress)?.trim().toLowerCase();
  const isOwnProfile = targetAddress === connectedAddress?.toLowerCase();

  const { unclaimedRewards, manualAddPoints, refetch, sbtThresholds, offChainPoints, offChainLevel, fid: ownFid } = usePoints();
  const { claimPrize, rerollWinner } = useRaffle();
  const { poolSettings, isLoading: loadingCMS } = useCMS();
  const { profileData, isLoading: loadingFC, syncUser } = useFarcaster();

  // Data Syncing State
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    if (targetAddress) {
      setIsSyncing(true);
      syncUser(targetAddress).finally(() => {
        setTimeout(() => setIsSyncing(false), 800);
      });
    } else if (!isConnected && !userAddress) {
      setIsSyncing(false);
    }
  }, [targetAddress, syncUser, isConnected]);

  const isLoading = loadingCMS || loadingFC || isSyncing;

  if (!targetAddress && !isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-[#0B0E14]">
        <div className="bg-[#121720] p-8 rounded-3xl border border-white/5 max-w-md w-full">
          <Wallet className="w-16 h-16 text-slate-700 mb-4 mx-auto" />
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Connection Required</h2>
          <p className="text-slate-500 text-sm mb-6 uppercase tracking-wider font-bold">Connect your wallet to view profile telemetry.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-32 px-4 bg-[#0B0E14]" style={{ transform: 'translateZ(0)' }}>
      <div className="container mx-auto max-w-2xl space-y-6">

        {/* Profile Header Block */}
        <div className="bg-[#121720] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden">
          {/* Background ID accent */}
          <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
            <ShieldCheck className="w-48 h-48 text-indigo-500" />
          </div>

          {isLoading ? <ProfileSkeleton /> : (
            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
              <div className="w-24 h-24 rounded-2xl bg-[#1a2130] border border-indigo-500/20 flex items-center justify-center overflow-hidden shadow-2xl">
                {profileData?.pfp_url ? (
                  <img src={profileData.pfp_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">👤</span>
                )}
              </div>

              <div className="text-center md:text-left min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                  <h1 className="text-2xl font-black text-white uppercase tracking-tighter truncate">
                    @{profileData?.username || 'unknown'}
                  </h1>
                  {profileData?.power_badge && (
                    <div className="bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1 w-fit mx-auto md:mx-0">
                      <Zap className="w-3 h-3 text-indigo-400 fill-indigo-400" />
                      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Power</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                  <div className="flex flex-col items-center md:items-start leading-none gap-0.5">
                    <span className="text-white font-black text-sm">{profileData?.follower_count?.toLocaleString() || 0}</span>
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Followers</span>
                  </div>
                  <div className="w-px h-6 bg-white/5" />
                  <div className="flex flex-col items-center md:items-start leading-none gap-0.5">
                    <span className="text-white font-black text-sm">{profileData?.following_count?.toLocaleString() || 0}</span>
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Following</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-xl w-fit mx-auto md:mx-0 border border-white/5">
                  <span className="font-mono text-slate-400 text-[10px] font-black tracking-tighter">
                    {targetAddress.slice(0, 6)}...{targetAddress.slice(-4)}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reputation Badge Block */}
        <div className="bg-[#121720] border border-white/5 rounded-[2rem] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
              <h2 className="text-xs font-black text-white uppercase tracking-tighter">Reputation Node Audit</h2>
            </div>
            {isLoading ? <div className="h-4 w-12 bg-white/5 rounded" /> : (
              <div className="bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                <span className="text-[10px] font-black text-indigo-400">SCORE: {profileData?.internal_trust_score || 0}</span>
              </div>
            )}
          </div>

          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000"
              style={{ width: isLoading ? '0%' : `${Math.min(profileData?.internal_trust_score || 0, 100)}%` }}
            />
          </div>

          <div className="mt-4 p-4 bg-black/20 rounded-2xl border border-white/5 flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-white uppercase tracking-tight mb-0.5">Neynar Data Protocol v2.4</p>
              <p className="text-[9px] text-slate-500 leading-tight font-medium uppercase tracking-widest">
                Social graph integrity verified via OpenRank algorithms.
                Last audit: {profileData?.last_sync ? new Date(profileData.last_sync).toLocaleTimeString() : 'Pending'}
              </p>
            </div>
          </div>
        </div>

        {/* Private Actions & Rewards (Only for Own Profile) */}
        {isOwnProfile && (
          <>
            <DailyClaimCard address={connectedAddress} onClaim={(p) => manualAddPoints(p)} />

            {unclaimedRewards.length > 0 && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-[2rem] p-6">
                <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2 uppercase italic tracking-tighter">
                  <Gift className="w-4 h-4 text-yellow-500" />
                  Unclaimed Prizes
                </h3>
                <div className="space-y-3">
                  {unclaimedRewards.map(reward => (
                    <div key={reward.id} className="bg-[#121720] p-4 rounded-3xl border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center text-xl">🏆</div>
                        <div>
                          <p className="font-black text-white text-[11px] uppercase tracking-tighter">{reward.title}</p>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Claim Now</p>
                        </div>
                      </div>
                      <button
                        onClick={() => claimPrize(reward.id)}
                        className="bg-yellow-500 text-black font-black text-[9px] px-4 py-2 rounded-xl uppercase tracking-widest active:scale-95 transition-all"
                      >
                        Claim
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase italic tracking-tighter mx-2">
                <Award className="w-5 h-5 text-indigo-500" />
                Community Rewards
              </h2>
              <SBTRewardsDashboard />
            </div>
          </>
        )}

        {/* Public Visibility: Ticket Counter (Simplified) */}
        <div className="bg-[#121720] border border-white/5 rounded-[2rem] p-6">
          <h3 className="text-xs font-black text-white mb-6 flex items-center gap-2 uppercase tracking-tighter">
            <Ticket className="w-4 h-4 text-indigo-500" />
            Reputation Activity
          </h3>
          <div className="text-center py-12 text-slate-700 bg-black/20 rounded-3xl border border-white/5">
            <p className="text-[10px] font-black uppercase tracking-widest">No active telemetry logs found</p>
          </div>
        </div>

      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col md:flex-row items-center gap-6 animate-pulse">
      <div className="w-24 h-24 rounded-2xl bg-white/5" />
      <div className="flex-1 space-y-3 w-full">
        <div className="h-6 w-32 bg-white/5 rounded mx-auto md:mx-0" />
        <div className="h-4 w-48 bg-white/5 rounded mx-auto md:mx-0" />
        <div className="h-8 w-24 bg-white/5 rounded-xl mx-auto md:mx-0" />
      </div>
    </div>
  );
}

/**
 * DailyClaimCard: Integrated with PointsContext and Mobile Optimized UI.
 */
function DailyClaimCard({ address, onClaim }) {
  const { sbtThresholds, fid, offChainPoints, offChainLevel } = usePoints();
  const [canClaim, setCanClaim] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [claiming, setClaiming] = useState(false);

  const realPoints = offChainPoints || 0;
  const realLevel = offChainLevel || 0;

  const nextTierConfig = sbtThresholds.find(t => t.level === realLevel + 1)
    || sbtThresholds[sbtThresholds.length - 1];

  const nextThreshold = nextTierConfig?.min_xp || 10000;
  const currentTierName = sbtThresholds.find(t => t.level === realLevel)?.tier_name || "None";
  const progress = Math.min((realPoints / nextThreshold) * 100, 100);

  const COOLDOWN = 24 * 60 * 60 * 1000;
  const STORAGE_KEY = `daily_claim_${address?.toLowerCase()}`;
  const MASTER_ADMIN = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();

  const checkClaimStatus = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const lastClaim = stored ? parseInt(stored) : 0;
    const now = Date.now();
    const diff = now - lastClaim;

    if (diff >= COOLDOWN) {
      setCanClaim(true);
      setTimeLeft('READY');
    } else {
      setCanClaim(false);
      const remaining = COOLDOWN - diff;
      const h = Math.floor(remaining / (3600000));
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }
  }, [STORAGE_KEY, COOLDOWN]);

  useEffect(() => {
    if (!address) return;
    checkClaimStatus();
    const interval = setInterval(checkClaimStatus, 1000);
    return () => clearInterval(interval);
  }, [address, checkClaimStatus]);

  const handleClaim = async () => {
    if (!fid) {
      toast.error("Open in Farcaster to claim!", { icon: '⚠️' });
      return;
    }

    setClaiming(true);
    const result = await handleDailyClaim(fid, address);

    if (result.success) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      onClaim(100);
      toast.success(result.message, { icon: '🎉' });
      checkClaimStatus();
    } else {
      toast.error(result.message || "Claim failed");
    }
    setClaiming(false);
  };

  const isMasterAdmin = address?.toLowerCase() === MASTER_ADMIN;

  return (
    <div className="bg-[#121720] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden group">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl transition-all ${canClaim ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-[#1a2130]'}`}>
            {canClaim ? '⚡' : '⏳'}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-black tracking-widest uppercase">DAILY NODE SYNC</span>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Daily Points</h3>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">{canClaim ? 'Sync ready' : `Refresh in: ${timeLeft}`}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
          {canClaim ? (
            <button
              disabled={claiming}
              onClick={handleClaim}
              className="bg-indigo-600 w-full md:w-auto px-8 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
            >
              {claiming ? 'SYNCING...' : 'SYNC +100 XP'}
            </button>
          ) : (
            <div className="bg-black/40 px-6 py-2 rounded-xl border border-white/5 w-full md:w-auto text-center">
              <span className="text-xs font-mono font-bold text-slate-500">{timeLeft}</span>
            </div>
          )}
        </div>
      </div>

      {/* SBT Advancement Progress */}
      <div className="mt-6 pt-5 border-t border-white/5">
        <div className="flex justify-between items-end mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">XP PROGRESSION</p>
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-xs uppercase tracking-tighter truncate">{currentTierName}</span>
              <span className="text-[10px] text-slate-600 font-black">/</span>
              <span className="text-slate-600 font-black text-xs">{nextThreshold.toLocaleString()} XP</span>
            </div>
          </div>
          {realPoints >= nextThreshold && (
            <button
              onClick={() => requestSBTMint(fid, address, realLevel + 1)}
              className="bg-indigo-500 text-white font-black text-[9px] px-3 py-1 rounded-lg uppercase tracking-tighter animate-pulse"
            >
              MINT LEVEL {realLevel + 1}
            </button>
          )}
        </div>
        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-indigo-500 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {isMasterAdmin && (
        <button
          onClick={() => { localStorage.removeItem(STORAGE_KEY); checkClaimStatus(); }}
          className="absolute top-2 right-2 text-[8px] text-slate-800 font-black uppercase hover:text-red-500"
        >
          [ADM REBOOT]
        </button>
      )}
    </div>
  );
}
