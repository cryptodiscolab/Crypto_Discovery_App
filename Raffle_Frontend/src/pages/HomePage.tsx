import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT } from '../hooks/useSBT';
import { useCMS } from '../hooks/useCMS';
import { formatUnits } from 'viem';
import { AnnouncementBanner, Announcement } from '../components/AnnouncementBanner';
import { FeatureCardSkeleton } from '../components/FeatureCardSkeleton';
import { HypeFeed } from '../components/HypeFeed';
import { useFarcaster } from '../shared/context/FarcasterContext';
import { supabase } from '../lib/supabaseClient';
import { DailyClaimModal } from '../features/profile/components/modals/DailyClaimModal';
import { ActivityLogSection } from '../features/profile/components/ActivityLogSection';

interface PoolSettings {
  targetUSDC: number;
  claimTimestamp: number;
}

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  link: string;
  active: boolean;
  visible: boolean;
  color: string;
  linkText: string;
  badge: string;
}

interface ActivityLogItem {
  id: number | string;
  description: string | null;
  activity_type: string | null;
  created_at: string | null;
}

export function HomePage() {
  const { isConnected, address } = useAccount();
  const { userPoints, unclaimedRewards: _unclaimedRewards, userTier, rankName, profileData, ecosystemSettings } = usePoints();
  const { totalPoolBalance } = useSBT();
  const { isFrame, frameUser } = useFarcaster();
  const typedFrameUser = frameUser as { pfpUrl?: string; pfpUser?: string; username?: string } | undefined;
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const {
    featureCards = [],
    announcement,
    poolSettings,
    ethPrice = 0,
    isLoadingCards
  } = useCMS();

  const displayCards = featureCards as FeatureCard[];
  const currentPoolSettings = poolSettings as PoolSettings | undefined;
  const poolUSD = parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice;
  const poolETH = parseFloat(formatUnits(totalPoolBalance || 0n, 18)).toFixed(4);
  const targetUSDC = currentPoolSettings?.targetUSDC || 5000;
  const claimTimestamp = currentPoolSettings?.claimTimestamp ?? 0;
  const progressPct = Math.min((poolUSD / targetUSDC) * 100, 100).toFixed(1);

  const typedProfile = profileData as {
    display_name?: string | null;
    basename?: string | null;
    ens_name?: string | null;
    streak_count?: number | null;
    raffle_tickets_bought?: number | null;
    total_raffles_created?: number | null;
    last_streak_claim?: string | null;
    is_base_social_verified?: boolean | null;
  } | null;
  const displayStreak = Number(typedProfile?.streak_count || 0);
  const displayTickets = Number(typedProfile?.raffle_tickets_bought || 0);
  const displayXp = userPoints;
  const tierNames = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const currentTier = Math.max(0, Math.min(Number(userTier || 0), tierNames.length - 1));
  const displayTierName = rankName || tierNames[currentTier];
  const welcomeEns = typedFrameUser?.username || typedProfile?.basename || typedProfile?.ens_name || typedProfile?.display_name || (isConnected ? 'Connected Agent' : 'Guest Agent');
  const welcomeAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect wallet';
  const activeRafflesCreated = Number(typedProfile?.total_raffles_created || 0);
  const lastClaimAt = typedProfile?.last_streak_claim ? new Date(typedProfile.last_streak_claim).getTime() : null;
  const lastClaimLabel = lastClaimAt ? formatRelativeTime(lastClaimAt) : 'No check-in yet';
  const dailyClaimXp = ecosystemSettings?.daily_claim ?? 0;
  const recentLogs = activityLogs.slice(0, 4);
  const unclaimedRewardsCount = Array.isArray(_unclaimedRewards) ? _unclaimedRewards.length : 0;
  const [showDailyClaimModal, setShowDailyClaimModal] = useState(false);
  const { refetch: refetchPoints } = usePoints();

  useEffect(() => {
    if (!address) {
      setActivityLogs([]);
      return;
    }

    let isMounted = true;
    const cleanAddress = address.toLowerCase();

    const fetchActivityLogs = async () => {
      // [FIX v3.64.30] Use API route (service role key) instead of direct Supabase anon query
      // Direct anon query was blocked by RLS. The API handler uses getSupabaseAdmin().
      try {
        const res = await fetch(`/api/user-bundle?action=get-activity-logs&wallet=${cleanAddress}&limit=4`);
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted) setActivityLogs((json?.logs || []) as ActivityLogItem[]);
      } catch (e) {
        console.warn('[HomePage] Activity log fetch failed:', e);
      }
    };

    void fetchActivityLogs();

    const channel = supabase
      .channel(`home-activity-${cleanAddress}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_activity_logs',
        filter: `wallet_address=eq.${cleanAddress}`,
      }, () => {
        void fetchActivityLogs();
      })
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [address]);

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden pb-safe md:pb-8">
      {/* Farcaster Frame Immersion */}
      {isFrame && (
        <div className="sticky top-0 z-50 w-full px-4 py-3 backdrop-blur-3xl border-b border-white/5 bg-[#050505]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {typedFrameUser?.pfpUrl ? (
              <img src={typedFrameUser.pfpUser || typedFrameUser.pfpUrl} alt="" className="w-8 h-8 rounded-full border-2 border-indigo-500/50 shadow-lg" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <i className="fa-solid fa-user text-indigo-400 text-sm"></i>
              </div>
            )}
            <div>
              <p className="text-[11px] font-black uppercase tracking-tighter text-indigo-500 leading-none">
                {typedFrameUser?.username || 'Nexus Agent'}
              </p>
              <p className="text-[11px] font-bold text-white">
                {isConnected && address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Guest Mode'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] font-black uppercase tracking-tighter text-emerald-500 leading-none">Points</p>
              <p className="text-[11px] font-black text-white">{displayXp?.toString() || '0'} XP</p>
            </div>
          </div>
        </div>
      )}

      {/* HypeFeed */}
      <div className="w-full">
        <HypeFeed />
      </div>

      <div className="max-w-4xl mx-auto px-4">

        {/* ── USER WELCOME CARD ─────────────────────────────────────────── */}
        <div className="glass-card mb-6 p-5 flex items-center justify-between gap-5 flex-wrap" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(5,5,5,0.2) 100%)' }}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                className="rounded-full border-2 border-[var(--colors-brand-primary)] object-cover"
                src={typedFrameUser?.pfpUrl || 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=150&auto=format&fit=crop&q=80'}
                alt="Avatar"
                style={{ width: '50px', height: '50px' }}
              />
              <div className="absolute top-0 left-0 w-full h-full rounded-full" style={{ boxShadow: '0 0 10px var(--colors-brand-primary-glow)', pointerEvents: 'none' }}></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-base text-white m-0" style={{ fontFamily: 'var(--typography-family-heading)', letterSpacing: '0.02em' }}>
                  {welcomeEns}
                </h2>
                <span className="badge-cyber badge-cyber-green text-[8px]" style={{ padding: '2px 6px' }}>Basename Verified</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="value-native text-[10px]" style={{ color: '#64748b' }}>{welcomeAddr}</span>
                <button className="text-slate-500 hover:text-slate-300 text-[10px] bg-none border-none cursor-pointer">
                  <i className="fa-regular fa-copy"></i>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {/* Farcaster Badge */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/25 text-purple-400 cursor-default transition-all duration-200 hover:translate-y-[-1px]">
                  <svg viewBox="0 0 256 256" width="12" height="12" fill="currentColor">
                    <path d="M239.11,107a16,16,0,0,0-12.06-5.32H28.95A16,16,0,0,0,16.89,107a17.65,17.65,0,0,0-4.89,12.63v38.08A16.54,16.54,0,0,0,28.54,174h9.13l5,27.18A16,16,0,0,0,58.38,214h139.2a16,16,0,0,0,15.75-12.87l5-27.13h9.13a16.54,16.54,0,0,0,16.54-16.29V119.63A17.65,17.65,0,0,0,239.11,107Z" />
                  </svg>
                  <span className="value-native text-[10px] text-slate-200">@{typedFrameUser?.username || welcomeEns}</span>
                  <i className="fa-solid fa-circle-check text-[9px] text-emerald-500 ml-1"></i>
                </div>
                {/* X Badge */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-slate-400 cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-white/20 hover:text-slate-200">
                  <i className="fa-brands fa-x-twitter text-xs opacity-60"></i>
                  <span className="value-native text-[10px]">Link X</span>
                  <i className="fa-solid fa-plus text-[8px]"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="glass-card p-2 min-w-[80px] flex flex-col items-center justify-center rounded-md" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <span className="label-native text-[8px] text-slate-500">STREAK</span>
              <span className="value-native text-xs text-white font-bold mt-0.5">{displayStreak} Days</span>
            </div>
            <div className="glass-card p-2 min-w-[80px] flex flex-col items-center justify-center rounded-md" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <span className="label-native text-[8px] text-slate-500">XP TIER</span>
              <span className="value-native text-xs" style={{ color: 'var(--colors-brand-primary)', fontWeight: 'bold', marginTop: '2px' }}>{displayTierName}</span>
            </div>
          </div>
        </div>

        {/* ── Announcement Banner ───────────────────────────────────────── */}
        <AnnouncementBanner announcement={announcement as Announcement} />

        {/* ── SBT REWARD POOL WIDGET ────────────────────────────────────── */}
        <div className="glass-card mb-6 p-5" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(5, 5, 5, 0.4) 100%)' }}>
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <p className="label-native mb-1" style={{ color: 'var(--colors-brand-primary)' }}>SBT REWARD POOL</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white" style={{ fontFamily: 'var(--typography-family-heading)' }}>
                  ${poolUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="label-native text-[10px] text-slate-500">USDC</span>
              </div>
              <p className="value-native text-xs text-slate-600 mt-1">≈ {poolETH} ETH</p>
            </div>

            {claimTimestamp > Date.now() && (
              <div className="glass-card p-3 flex items-center gap-2.5 rounded-md" style={{ background: 'rgba(255,255,255,0.02)', margin: 0 }}>
                <i className="fa-solid fa-hourglass-half" style={{ color: 'var(--colors-brand-primary)', fontSize: '16px' }}></i>
                <div>
                  <div className="label-native text-[8px] text-slate-500 leading-none">NEXT DROP</div>
                  <div className="value-native text-xs text-white">
                    <HomeCountdown timestamp={claimTimestamp} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="flex justify-between items-center mb-2">
              <span className="label-native text-[9px] text-slate-500">REWARD PROGRESS</span>
              <span className="value-native text-[10px]" style={{ color: 'var(--colors-brand-primary)' }}>{progressPct}% OF ${targetUSDC.toLocaleString()}</span>
            </div>
            <div className="streak-bar-container h-1.5">
              <div className="streak-bar-progress" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 label-native" style={{ color: 'var(--colors-brand-success)' }}>
            <i className="fa-solid fa-circle-check text-xs"></i>
            <span className="text-[9px]">NO RIBA · VERIFIED ON-CHAIN · LIVE TELEMETRY</span>
          </div>
        </div>

        {/* ── STATS GRID (4 Cards) ──────────────────────────────────────── */}
        <div className="stats-grid-cyber">
          {/* Identity Tier */}
          <div className="glass-card stat-card-cyber p-5">
            <div className="stat-header-cyber">
              <span className="label-native">Identity Tier</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-slate-400">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
            </div>
            <div className="stat-value-cyber text-2xl">{displayTierName}</div>
            <span className="badge-cyber badge-cyber-blue">SOULBOUND VERIFIED</span>
          </div>

          {/* Total Earnings */}
          <div className="glass-card stat-card-cyber p-5">
            <div className="stat-header-cyber">
              <span className="label-native">Total Earnings</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-slate-400">
                <i className="fa-solid fa-coins"></i>
              </div>
            </div>
            <div className="stat-value-cyber text-2xl">{displayXp?.toLocaleString() || '0'} XP</div>
            <span className="value-native text-xs text-slate-500">{unclaimedRewardsCount} rewards pending claim</span>
          </div>

          {/* Check-In Streak */}
          <div className="glass-card stat-card-cyber p-5">
            <div className="stat-header-cyber">
              <span className="label-native">Check-In Streak</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-slate-400">
                <i className="fa-solid fa-fire-flame-curved"></i>
              </div>
            </div>
            <div className="stat-value-cyber text-2xl">{displayStreak} Days</div>
            <div className="streak-bar-container">
              <div className="streak-bar-progress" style={{ width: `${Math.min(displayStreak * 10, 100)}%` }}></div>
            </div>
          </div>

          {/* Raffle Tickets */}
          <div className="glass-card stat-card-cyber p-5">
            <div className="stat-header-cyber">
              <span className="label-native">Raffle Tickets</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-slate-400">
                <i className="fa-solid fa-ticket-simple"></i>
              </div>
            </div>
            <div className="stat-value-cyber text-2xl">{displayTickets} Tickets</div>
            <span className="value-native text-xs text-slate-500">{activeRafflesCreated} Active Raffle sponsored</span>
          </div>
        </div>

        {/* ── DASHBOARD SECONDARY GRID ──────────────────────────────────── */}
        <div className="dashboard-grid-secondary mb-8">
          {/* Left Panel: Streak & Basename */}
          <div className="flex flex-col gap-6">
            {/* Streak Check-In */}
            <div className="glass-card p-5">
              <div className="card-title-row flex items-center justify-between mb-5">
                <h3 className="text-base text-white font-heading" style={{ fontFamily: 'var(--typography-family-heading)' }}>Daily Check-In Streak</h3>
                <span className="badge-cyber badge-cyber-orange">STREAK WINDOW OPEN</span>
              </div>
              <p className="content-native mb-5">
                Claim your daily XP to keep your streak alive. The daily streak window is active between 20 to 48 hours after your last check-in.
              </p>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="label-native">Last Check-In</div>
                  <div className="value-native text-white">{lastClaimLabel}</div>
                </div>
                <button onClick={() => setShowDailyClaimModal(true)} className="btn-cyber-primary">
                  <i className="fa-solid fa-bolt"></i>
                  <span>Claim Daily +{dailyClaimXp} XP</span>
                </button>
              </div>
            </div>

            {/* Basename Resolution Info */}
            <div className="glass-card p-5 border-indigo-500/20" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(5, 5, 5, 0.4) 100%)' }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 text-xl shrink-0">
                  <i className="fa-solid fa-shield"></i>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-sm text-white font-heading" style={{ fontFamily: 'var(--typography-family-heading)' }}>Base Basename Verification</h3>
                    <span className="badge-cyber badge-cyber-blue">IDENTITY GATE</span>
                  </div>
                  <p className="content-native text-slate-400 mb-3">
                    Certain partner quests require verification of your official Base Basename. Connect your wallet to automatically resolve and verify your Basename identity.
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="badge-cyber badge-cyber-green"><i className="fa-solid fa-circle-check mr-1"></i> Resolved: {welcomeEns}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Activity Feed */}
          <div className="glass-card p-5 flex flex-col gap-4">
            <h3 className="text-base text-white font-heading" style={{ fontFamily: 'var(--typography-family-heading)' }}>Ecosystem Logs</h3>
            <div className="activity-feed-list flex flex-col gap-3">
              {recentLogs.length > 0 ? recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" style={{ boxShadow: '0 0 8px var(--colors-brand-primary-glow)' }}></div>
                    <span className="value-native text-xs truncate">{log.description || log.activity_type || 'Activity recorded'}</span>
                  </div>
                  <span className="label-native text-[10px] text-slate-500 shrink-0">{log.created_at ? formatRelativeTime(new Date(log.created_at).getTime()) : 'LIVE'}</span>
                </div>
              )) : (
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                  <span className="label-native text-[10px] text-slate-500">NO RECENT ACTIVITY YET</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Feature Cards Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {isLoadingCards && displayCards.length === 0 ? (
            <FeatureCardSkeleton count={6} />
          ) : (
            displayCards
              .filter((card: FeatureCard) => card.visible !== false)
              .map((card: FeatureCard, index: number) => {
                const isCustomImage = card.icon && typeof card.icon === 'string' && card.icon.startsWith('http');
                return (
                  <Link key={index} to={card.link || '/'} className="group">
                    <div className="glass-card p-5 h-full hover:bg-white/5 transition-colors duration-150">
                      <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors overflow-hidden border border-white/5">
                        {isCustomImage ? (
                          <img src={card.icon} alt={card.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <i className="fa-solid fa-sparkles text-indigo-400"></i>
                        )}
                      </div>
                      <h3 className="text-[11px] font-black text-white mb-1 leading-snug uppercase tracking-widest">{String(card.title || '').toUpperCase()}</h3>
                      <p className="text-zinc-500 text-[11px] leading-relaxed font-black uppercase tracking-widest">{String(card.description || '').toUpperCase()}</p>
                      {card.linkText && (
                        <div className="flex items-center mt-3 text-[11px] font-black uppercase tracking-widest text-indigo-400 group-hover:underline">
                          {String(card.linkText || '').toUpperCase()} →
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })
          )}
        </div>

      </div>
      {showDailyClaimModal && (
        <DailyClaimModal
          onClose={() => setShowDailyClaimModal(false)}
          onSuccess={() => {
            refetchPoints();
          }}
          streakCount={displayStreak}
        />
      )}

      {/* Full Activity Log with filter tabs — [v3.64.30] */}
      {isConnected && address && (
        <div className="max-w-4xl mx-auto px-4 pb-8">
          <ActivityLogSection walletAddress={address} />
        </div>
      )}
    </div>
  );
}

// Helper: countdown display
function HomeCountdown({ timestamp }: { timestamp: number }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = timestamp - Date.now();
      if (diff <= 0) { setTimeLeft('READY'); return; }
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

function formatRelativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'LIVE';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'LIVE';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}