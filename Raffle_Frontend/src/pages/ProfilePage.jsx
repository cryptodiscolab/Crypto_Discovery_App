import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Wallet,
  ExternalLink,
  RefreshCw,
  Award,
  Zap,
  ShieldCheck,
  LogOut,
  Trash2
} from 'lucide-react';

// Neynar UI Primitives (Modular imports to save RAM)
import { Card, CardHeader, CardContent } from '@neynar/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@neynar/ui/avatar';
import { Skeleton } from '@neynar/ui/skeleton';
import { Badge } from '@neynar/ui/badge';
import { Button } from '@neynar/ui/button';

import { usePoints } from '../shared/context/PointsContext';
import { useFarcaster } from '../hooks/useFarcaster';
import { SBTRewardsDashboard } from '../components/SBTRewardsDashboard';
import { handleDailyClaim, requestSBTMint } from '../dailyAppLogic';
import toast from 'react-hot-toast';

/**
 * Optimized Profile Page:
 * 1. Neynar UI Integration: Professional, lightweight UI.
 * 2. Hardware Optimized: Reduced animations and lighter DOM.
 * 3. Cache Control: Manual localStorage purge for maintenance.
 */
export function ProfilePage() {
  const { userAddress } = useParams();
  const { address: connectedAddress, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();

  const targetAddress = (userAddress || connectedAddress)?.trim().toLowerCase();
  const isOwnProfile = targetAddress === connectedAddress?.toLowerCase();

  const { manualAddPoints, sbtThresholds, offChainPoints, offChainLevel, fid: ownFid } = usePoints();
  const { profileData, isLoading: loadingFC, error: errorFC, syncUser, clearCache } = useFarcaster();

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

  useEffect(() => {
    if (errorFC) toast.error(`Identity Check: ${errorFC}`);
  }, [errorFC]);

  useEffect(() => {
    if (targetAddress) syncUser(targetAddress);
  }, [targetAddress, syncUser]);

  const isLoading = loadingFC && !profileData;

  if (!targetAddress && !isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-[#0B0E14]">
        <Card className="max-w-md w-full border-white/5 bg-[#121720]/50 backdrop-blur-xl">
          <CardContent className="pt-8 text-center">
            <Wallet className="w-16 h-16 text-slate-700 mb-4 mx-auto" />
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Connection Required</h2>
            <p className="text-slate-500 text-sm mb-6 uppercase tracking-wider font-bold">Connect your wallet to proceed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-32 px-4 bg-[#0B0E14]">
      <div className="container mx-auto max-w-2xl space-y-6">

        {/* Profile Identity Block */}
        <Card className="border-white/5 bg-[#121720] rounded-[2rem] overflow-hidden">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <Skeleton className="w-24 h-24 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center gap-6 relative">
                <Avatar className="w-24 h-24 rounded-2xl border border-indigo-500/20 shadow-2xl">
                  <AvatarImage src={profileData?.pfp_url} alt={profileData?.username} />
                  <AvatarFallback className="bg-slate-800 text-3xl">👤</AvatarFallback>
                </Avatar>

                <div className="text-center md:text-left min-w-0 flex-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter truncate">
                      @{profileData?.username || 'unknown'}
                    </h1>
                    {profileData?.power_badge && (
                      <Badge variant="indigo" className="w-fit mx-auto md:mx-0 bg-indigo-500/20 text-indigo-400 border-indigo-500/30 flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-indigo-400" />
                        POWER
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-center md:justify-start gap-6 mb-4">
                    <div className="flex flex-col">
                      <span className="text-white font-black text-lg leading-none">{profileData?.follower_count?.toLocaleString() || 0}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Followers</span>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="flex flex-col">
                      <span className="text-white font-black text-lg leading-none">{profileData?.following_count?.toLocaleString() || 0}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Following</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-xl border border-white/5">
                      <span className="font-mono text-slate-400 text-[10px] font-black tracking-tighter">
                        {targetAddress.slice(0, 6)}...{targetAddress.slice(-4)}
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-600" />
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleManualRefresh}
                      className="rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 h-8 w-8"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isSyncing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {isOwnProfile && (
                  <div className="flex flex-col gap-2 mt-4 md:mt-0">
                    <Button
                      variant="destructive"
                      onClick={() => { disconnect(); navigate('/login'); }}
                      className="bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 text-[10px] uppercase font-black tracking-widest h-10 px-4 rounded-xl"
                    >
                      <LogOut className="w-3 h-3 mr-2" />
                      Logout
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleGlobalPurge}
                      className="bg-white/5 border-white/10 text-slate-500 hover:bg-white/10 text-[10px] uppercase font-black tracking-widest h-10 px-4 rounded-xl"
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Clean Cache
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reputation Audit Card */}
        <Card className="border-white/5 bg-[#121720] rounded-[2rem]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                <h2 className="text-xs font-black text-white uppercase tracking-widest">Reputation Node Audit</h2>
              </div>
              <Badge variant="outline" className="bg-indigo-500/10 border-indigo-500/20 text-indigo-400 font-black">
                SCORE: {profileData?.internal_trust_score || 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden mb-4 border border-white/5">
              <div
                className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                style={{ width: `${Math.min(profileData?.internal_trust_score || 0, 100)}%` }}
              />
            </div>
            <div className="p-4 bg-black/20 rounded-2xl border border-white/5 flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl">
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-white uppercase mb-1">InviSync Protocol v2.5</p>
                <p className="text-[9px] text-slate-500 leading-relaxed font-bold uppercase tracking-widest">
                  Verified via Neynar Managed Signer.<br />
                  Last audit: {profileData?.last_sync ? new Date(profileData.last_sync).toLocaleTimeString() : 'Awaiting initialization'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Blocks (Private) */}
        {isOwnProfile && (
          <div className="space-y-6">
            <DailyClaimCard address={connectedAddress} onClaim={(p) => manualAddPoints(p)} />
            <SBTRewardsDashboard />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Optimized DailyClaimCard
 */
function DailyClaimCard({ address, onClaim }) {
  const { sbtThresholds, fid, offChainPoints, offChainLevel } = usePoints();
  const [canClaim, setCanClaim] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [claiming, setClaiming] = useState(false);

  const realPoints = offChainPoints || 0;
  const realLevel = offChainLevel || 0;
  const nextTierConfig = sbtThresholds.find(t => t.level === realLevel + 1) || sbtThresholds[sbtThresholds.length - 1];
  const nextThreshold = nextTierConfig?.min_xp || 10000;
  const progress = Math.min((realPoints / nextThreshold) * 100, 100);

  const COOLDOWN = 24 * 60 * 60 * 1000;
  const STORAGE_KEY = `daily_claim_${address?.toLowerCase()}`;

  const checkStatus = useCallback(() => {
    const lastClaim = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
    const diff = Date.now() - lastClaim;
    if (diff >= COOLDOWN) {
      setCanClaim(true);
      setTimeLeft('READY');
    } else {
      setCanClaim(false);
      const rem = COOLDOWN - diff;
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }
  }, [STORAGE_KEY]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleClaim = async () => {
    if (!fid) {
      toast.error("Farcaster identity required!", { icon: '🤖' });
      return;
    }
    setClaiming(true);
    const res = await handleDailyClaim(fid, address);
    if (res.success) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      onClaim(100);
      toast.success(res.message);
      checkStatus();
    } else {
      toast.error(res.message || "Protocol mismatch");
    }
    setClaiming(false);
  };

  return (
    <Card className="border-white/5 bg-[#121720] rounded-[2rem] overflow-hidden relative">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${canClaim ? 'bg-indigo-600 shadow-xl shadow-indigo-500/20' : 'bg-slate-800'}`}>
              {canClaim ? '⚡' : '⏳'}
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter leading-tight">Identity Sync</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{canClaim ? 'Protocol ready' : `Refresh: ${timeLeft}`}</p>
            </div>
          </div>
          <Button
            disabled={!canClaim || claiming}
            onClick={handleClaim}
            className={`font-black text-xs uppercase tracking-widest px-8 rounded-xl h-12 ${canClaim ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-800'}`}
          >
            {claiming ? 'SYNCING...' : 'SYNC +100'}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">XP Progression</span>
            <span className="text-[10px] text-white font-black">{realPoints.toLocaleString()} / {nextThreshold.toLocaleString()} XP</span>
          </div>
          <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

