import React, { useRef, useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Trophy, Gift, Wallet, ExternalLink, Timer as TimerIcon, RefreshCw, Award, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePoints } from '../shared/context/PointsContext';
import { useRaffle } from '../hooks/useRaffle';
import { useCMS } from '../hooks/useCMS';
import { SBTRewardsDashboard } from '../components/SBTRewardsDashboard';
import { handleDailyClaim, requestSBTMint } from '../dailyAppLogic';

export function ProfilePage() {
  const { address, isConnected } = useAccount();

  const { unclaimedRewards, manualAddPoints } = usePoints();
  const { claimPrize, rerollWinner } = useRaffle();
  const { poolSettings, ethPrice, isLoading: loadingCMS } = useCMS();
  const { isLoading: loadingSBT } = useSBT();

  const isLoadingData = loadingCMS || loadingSBT;

  // Dummy stats (could be replaced with real data from usePoints if available)
  const stats = [
    { label: 'Total Tickets', value: '15', icon: Ticket, color: 'text-blue-400' },
    { label: 'Raffles Won', value: '2', icon: Trophy, color: 'text-yellow-400' },
    { label: 'NFTs Claimed', value: '1', icon: Gift, color: 'text-purple-400' },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <div className="bg-slate-900/50 p-8 rounded-2xl border border-white/10 max-w-md">
          <Wallet className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Wallet Not Connected</h2>
          <p className="text-slate-400 mb-6">Please connect your wallet to view your profile and tickets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Profile Header */}
        <div className="glass-card p-8 mb-8 flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 p-1">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl font-bold text-white mb-2">My Profile</h1>
            <div className="flex items-center justify-center md:justify-start gap-2 bg-slate-900/50 py-1 px-3 rounded-full w-fit mx-auto md:mx-0 border border-white/10">
              <span className="font-mono text-slate-300 text-sm">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Daily Claim Section */}
        <DailyClaimCard address={address} onClaim={(points) => manualAddPoints(points)} />

        {/* Unclaimed Prizes Section - HIGH PRIORITY */}
        <AnimatePresence>
          {unclaimedRewards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <div className="glass-card p-6 border-l-4 border-l-yellow-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Gift className="w-32 h-32 text-yellow-500" />
                </div>

                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Gift className="w-6 h-6 text-yellow-400" />
                  Unclaimed Prizes
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                    Action Required
                  </span>
                </h3>

                <div className="space-y-4 relative z-10">
                  {unclaimedRewards.map((reward) => (
                    <div key={reward.id} className="bg-slate-900/60 p-4 rounded-xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-2xl shadow-lg shadow-orange-500/20">
                          🏆
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-lg">{reward.title || `Raffle #${reward.id}`}</h4>
                          <p className="text-slate-400 text-sm">You won this prize!</p>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Timer Component */}
                        <ClaimTimer deadline={reward.deadline} />

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {reward.deadline > Date.now() ? (
                            <button
                              onClick={() => claimPrize(reward.id)}
                              className="btn-primary bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-green-500/20 px-6 py-2 flex items-center gap-2"
                            >
                              <Gift className="w-4 h-4" /> Claim Now
                            </button>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Deadline Missed</span>
                              <button
                                onClick={() => rerollWinner(reward.id)}
                                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2"
                              >
                                <RefreshCw className="w-4 h-4" /> Reroll Winner
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SBT Community Rewards Dashboard */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Award className="w-8 h-8 text-indigo-500" />
              Community Rewards
            </h2>

            {poolSettings?.claimTimestamp > Date.now() && (
              <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl">
                <TimerIcon className="w-4 h-4 text-indigo-400 animate-pulse" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-black">Next Distribution In:</p>
                  <p className="text-sm font-bold text-white font-mono">
                    <ProfileCountdown timestamp={poolSettings.claimTimestamp} />
                  </p>
                </div>
              </div>
            )}
          </div>
          <SBTRewardsDashboard />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 flex items-center gap-4"
              >
                <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-400" />
            My Tickets
          </h3>
          <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-xl border border-white/5">
            <p>No active tickets found</p>
            <Link to="/raffles" className="text-blue-400 text-sm mt-2 hover:underline inline-block">
              Browse Active Raffles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileCountdown({ timestamp }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = timestamp - Date.now();
      if (diff <= 0) {
        setTimeLeft('READY');
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span>{timeLeft}</span>;
}

function DailyClaimCard({ address, onClaim }) {
  const { sbtThresholds, fid, offChainPoints, offChainLevel } = usePoints();
  const [canClaim, setCanClaim] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Use Centralized Context Data (Anti-Halu)
  // Fallback to 0 if context not yet loaded
  const realPoints = offChainPoints || 0;
  const realLevel = offChainLevel || 0;

  // Determine Next Threshold
  const nextTierConfig = sbtThresholds.find(t => t.level === realLevel + 1)
    || sbtThresholds[sbtThresholds.length - 1]; // Fallback to max

  const nextThreshold = nextTierConfig?.min_xp || 10000;
  const currentTierName = sbtThresholds.find(t => t.level === realLevel)?.tier_name || "None";
  const progress = Math.min((realPoints / nextThreshold) * 100, 100);
  const pointsNeeded = Math.max(0, nextThreshold - realPoints);
  const canMint = realPoints >= nextThreshold;

  // Constants
  const DAILY_POINTS = 100;
  const COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in ms
  const STORAGE_KEY = `daily_claim_${address?.toLowerCase()}`; // Keep local fallback for cooldown UI only
  const MASTER_ADMIN = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();

  useEffect(() => {
    // If we have FID, we should check DB for last claim time ideally
    // But for UI speed, we can keep the localstorage check as a "First Defense"
    // TODO: Fetch last_login_at from DB for valid check
    if (!address) return;
    checkClaimStatus();
    const interval = setInterval(checkClaimStatus, 1000);
    return () => clearInterval(interval);
  }, [address]);

  const checkClaimStatus = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const lastClaim = stored ? parseInt(stored) : 0;

    const now = Date.now();
    const diff = now - lastClaim;

    if (diff >= COOLDOWN) {
      setCanClaim(true);
      setTimeLeft('Ready');
    } else {
      setCanClaim(false);
      const remaining = COOLDOWN - diff;
      const h = Math.floor(remaining / (1000 * 60 * 60));
      const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }
  };

  const handleClaim = async () => {
    if (!fid) {
      // Fallback for non-Farcaster users (Mock or Fail)
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error("Please open in Farcaster to claim!", { icon: '⚠️' });
      });
      return;
    }

    const result = await handleDailyClaim(fid, address);

    if (result.success) {
      // Update Local State based on result
      const now = Date.now();
      localStorage.setItem(STORAGE_KEY, now.toString());
      // Optimistic Update handled by manualAddPoints via onClaim
      onClaim(DAILY_POINTS);

      import('react-hot-toast').then(({ default: toast }) => {
        toast.success(result.message, { icon: '🎉' });
      });
      checkClaimStatus();
    } else {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error(result.message || "Claim failed", { icon: '❌' });
      });
    }
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    checkClaimStatus();
    import('react-hot-toast').then(({ default: toast }) => {
      toast("Daily cooldown reset (Admin)", { icon: '🔧' });
    });
  };

  const handleMintSBT = async () => {
    if (!fid || !address) return;

    const targetLevel = realLevel + 1;

    const toastId = toast.loading("Verifying eligibility...");

    const result = await requestSBTMint(fid, address, targetLevel);

    if (result.success) {
      toast.success(result.message, { id: toastId });
      // Optional: Set a local "Pending" state to disable button
    } else {
      toast.error(result.message, { id: toastId });
    }
  };

  const isMasterAdmin = address?.toLowerCase() === MASTER_ADMIN;

  // Import toast locally if not available in scope, but usually it is. 
  // For safety in this component structure, we'll import it dynamically or assume global.
  // Actually DailyClaimCard uses dynamic import. Let's stick to that pattern or use the one from props if available.
  // To avoid complexity, I'll use simple dynamic import inside the handler like handleClaim does.
  // Wait, handleClaim uses import(). Let's align.

  const handleMintSBTWrapper = () => {
    import('react-hot-toast').then(({ default: toast }) => {
      handleMintSBTWithToast(toast);
    });
  };

  const handleMintSBTWithToast = async (toast) => {
    if (!fid || !address) return;
    const targetLevel = realLevel + 1;
    const toastId = toast.loading("Verifying eligibility...");
    const result = await requestSBTMint(fid, address, targetLevel);
    if (result.success) {
      toast.success(result.message, { id: toastId });
    } else {
      toast.error(result.message, { id: toastId });
    }
  };

  return (
    <div className="glass-card p-6 mb-8 relative overflow-hidden group">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Zap className="w-32 h-32 text-yellow-400" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg transition-transform md:group-hover:scale-110 ${canClaim ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-orange-500/20' : 'bg-slate-800'}`}>
            {canClaim ? '🎁' : '⏳'}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded font-black tracking-widest uppercase">DAILY</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Daily Reward</h3>
            <p className="text-slate-400 text-sm">
              {canClaim
                ? "Your daily points are ready to be claimed!"
                : "Come back tomorrow for more points."}
            </p>
          </div>
        </div>


        <div className="flex flex-col items-end gap-2">
          {canClaim ? (
            <button
              onClick={handleClaim}
              className="btn-primary bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-bold px-8 py-3 rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transform active:scale-95 transition-all"
            >
              <Gift className="w-5 h-5" />
              Claim +{DAILY_POINTS} Points
            </button>
          ) : (
            <div className="flex flex-col items-center bg-slate-900/50 px-6 py-2 rounded-xl border border-white/5">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Next Claim In</span>
              <span className="text-xl font-mono font-bold text-white">{timeLeft}</span>
            </div>
          )}

          {/* Master Admin Reset */}
          {isMasterAdmin && !canClaim && (
            <button
              onClick={handleReset}
              className="text-xs text-slate-600 hover:text-red-400 underline mt-2"
            >
              [Admin] Reset Cooldown
            </button>
          )}
        </div>
      </div>

      {/* SBT Progress Bar */}
      <div className="relative z-10 mt-4 pt-4 border-t border-white/5">
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {realLevel > 0 ? `Current: ${currentTierName}` : "Beginner"}
            </span>
            <div className="text-white font-mono text-sm max-w-[200px] truncate">
              <span className="text-yellow-400 font-bold">{realPoints.toLocaleString()}</span>
              <span className="text-slate-500"> / {nextThreshold.toLocaleString()} XP</span>
              {fid ? <span className="text-[10px] text-slate-600 block">FID: {fid}</span> : <span className="text-[10px] text-red-500 block">No FID</span>}
            </div>
          </div>
          <div className="text-right">
            {canMint ? (
              <button
                onClick={handleMintSBTWrapper}
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:scale-105 active:scale-95 transition-all px-4 py-1 rounded-lg text-xs font-bold text-white shadow-lg shadow-pink-500/30 animate-pulse"
              >
                MINT LEVEL {realLevel + 1} SBT
              </button>
            ) : (
              <span className="text-[10px] text-slate-500">{pointsNeeded.toLocaleString()} points to {nextTierConfig?.tier_name || "Next Tier"}</span>
            )}
          </div>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={`h-full relative ${canMint ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'}`}
          >
            {canMint && <div className="absolute inset-0 bg-white/50 animate-ping"></div>}
          </motion.div>
        </div>
      </div>
    </div>
  );
}


