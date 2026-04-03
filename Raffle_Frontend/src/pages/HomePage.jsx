import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Trophy,
  User,
  Ticket,
  Shield,
  TrendingUp,
  Timer as TimerIcon,
  CheckCircle,
  DollarSign,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT } from '../hooks/useSBT';
import { useCMS } from '../hooks/useCMS';
import { formatUnits } from 'viem';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { FeatureCardSkeleton } from '../components/FeatureCardSkeleton';
import { UnifiedDashboard } from '../components/UnifiedDashboard';
import { HypeFeed } from '../components/HypeFeed';

const iconMap = {
  Sparkles,
  Trophy,
  User,
  Ticket,
  Shield,
  TrendingUp,
};

import { useFarcaster } from '../shared/context/FarcasterContext';

export function HomePage() {
  const { isConnected, address } = useAccount();
  const { userPoints, unclaimedRewards } = usePoints();
  const { totalPoolBalance } = useSBT();
  const { isFrame, frameUser, client } = useFarcaster();
  const {
    featureCards = [],
    announcement,
    poolSettings,
    ethPrice = 0,
    isLoadingCards
  } = useCMS();

  const displayCards = featureCards;
  const poolUSD = parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice;
  const poolETH = parseFloat(formatUnits(totalPoolBalance || 0n, 18)).toFixed(4);
  const targetUSDC = poolSettings?.targetUSDC || 5000;
  const progressPct = Math.min((poolUSD / targetUSDC) * 100, 100).toFixed(1);

  const theme = client?.config?.theme || 'dark';
  const isLight = theme === 'light';

  return (
    // Tidak perlu min-h-screen atau pt di sini — sudah di-handle App.jsx main
    <div className={`w-full pb-safe ${isLight ? 'bg-white text-zinc-900' : 'bg-[#0B0E14] text-slate-100'}`}>

      {/* Farcaster Frame Immersion: Top Status Bar */}
      {isFrame && (
        <div className={`sticky top-0 z-50 w-full px-4 py-3 backdrop-blur-md border-b flex items-center justify-between ${
          isLight ? 'bg-white/80 border-black/5' : 'bg-[#0B0E14]/80 border-white/5'
        }`}>
          <div className="flex items-center gap-2.5">
            {frameUser?.pfpUrl ? (
              <img src={frameUser.pfpUser || frameUser.pfpUrl} alt="" className="w-8 h-8 rounded-full border-2 border-indigo-500/50 shadow-lg" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <User size={14} className="text-indigo-400" />
              </div>
            )}
            <div>
            <p className="text-[11px] font-black uppercase tracking-tighter text-indigo-500 leading-none">
                {frameUser?.username || 'Nexus Agent'}
              </p>
              <p className={`text-[11px] font-bold ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                {isConnected ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Guest Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] font-black uppercase tracking-tighter text-emerald-500 leading-none">Points</p>
              <p className={`text-[11px] font-black ${isLight ? 'text-zinc-900' : 'text-white'}`}>{userPoints} XP</p>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <Trophy className="w-4 h-4 text-yellow-500" />
          </div>
        </div>
      )}

      {/* HypeFeed — flow normal, tidak perlu sticky (Header sudah fixed) */}
      <div className="w-full">
        <HypeFeed />
      </div>

      {/* Page content wrapper — generous padding px-4, maks lebar konten */}
      <div className="max-w-4xl mx-auto px-4">

        {/* ── Hero Section ─────────────────────────────────────────────────── */}
        {/* Lebih kecil di mobile (py-8), lebih besar di desktop (md:py-14) */}
        <div className="text-center py-8 md:py-14">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight">
            CRYPTO DISCO
          </h1>
          <p className="text-[11px] text-zinc-400 max-w-md mx-auto leading-relaxed font-black uppercase tracking-widest">
            COMPLETE DAILY TASKS, EARN POINTS, AND WIN PREMIUM NFTS THROUGH OUR ON-CHAIN RAFFLE SYSTEM.
          </p>
        </div>

        {/* ── Announcement Banner ───────────────────────────────────────── */}
        <AnnouncementBanner announcement={announcement} />

        {/* ── Pool Widget ──────────────────────────────────────────────────── */}
        {/* Minimalist: bg-zinc-900, tanpa border warna, tanpa glow overlay berlapis */}
        <div className="w-full mb-8">
          <div className="bg-zinc-900 rounded-2xl p-6 md:p-8">

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
              <div>
                <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-3">
                  SBT REWARD POOL
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-5xl font-black text-white tabular-nums">
                    ${poolUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-zinc-500 font-semibold text-base">USDC</span>
                </div>
                <p className="text-zinc-600 text-[11px] mt-1 font-mono">≈ {poolETH} ETH</p>
              </div>

              {poolSettings?.claimTimestamp > Date.now() && (
                <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3 self-start sm:self-auto">
                  <TimerIcon className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-[11px] text-zinc-500 font-black uppercase tracking-widest">NEXT DROP</p>
                    <div className="text-[11px] font-black text-white font-mono uppercase tracking-widest">
                      <HomeCountdown timestamp={poolSettings.claimTimestamp} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar — bersih, tanpa glow shadow berat */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-zinc-500 font-black uppercase tracking-widest">REWARD PROGRESS</span>
                <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">{progressPct}% OF ${targetUSDC.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center gap-2 text-[11px] text-emerald-500 font-black uppercase tracking-widest">
              <CheckCircle className="w-3.5 h-3.5" />
              NO RIBA · VERIFIED ON-CHAIN · LIVE RATE
            </div>
          </div>
        </div>

        {/* ── Unified Dashboard (Tasks & Identity) ─────────────────────── */}
        <UnifiedDashboard />

        {/* ── Feature Cards Grid ────────────────────────────────────────── */}
        {/* grid-cols-1 mobile, 2 tablet, 3 desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 mb-6">
          {isLoadingCards && displayCards.length === 0 ? (
            <FeatureCardSkeleton count={6} />
          ) : (
            displayCards
              .filter(card => card.visible !== false)
              .map((card, index) => {
                const isCustomImage = card.icon && typeof card.icon === 'string' && card.icon.startsWith('http');
                const IconComponent = iconMap[card.icon] || Sparkles;

                return (
                  <Link key={index} to={card.link || '/'} className="group">
                    {/* Card: bg-zinc-900 on bg-black — subtle elevation tanpa border tebal */}
                    <div className="bg-zinc-900 rounded-xl p-5 h-full hover:bg-zinc-800 transition-colors duration-150">
                      {/* Icon */}
                      <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600/20 transition-colors overflow-hidden">
                        {isCustomImage ? (
                          <img src={card.icon} alt={card.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <IconComponent className={`w-5 h-5 text-${card.color || 'indigo'}-400`} />
                        )}
                      </div>

                      <h3 className="text-[11px] font-black text-white mb-1 leading-snug uppercase tracking-widest">{String(card.title || '').toUpperCase()}</h3>
                      <p className="text-zinc-500 text-[11px] leading-relaxed font-black uppercase tracking-widest">
                        {String(card.description || '').toUpperCase()}
                      </p>

                      {card.linkText && (
                        <div className={`flex items-center mt-3 text-sm font-semibold text-${card.color || 'indigo'}-400 group-hover:underline`}>
                          {String(card.linkText)} →
                        </div>
                      )}

                      {card.badge && (
                        <div className="flex items-center gap-1 text-[11px] text-zinc-600 mt-2 font-black uppercase tracking-widest">
                          <Shield className="w-3 h-3" />
                          <span>{String(card.badge).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })
          )}
        </div>

      </div>
    </div>
  );
}

// Helper: countdown display
function HomeCountdown({ timestamp }) {
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
