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

export function HomePage() {
  const { isConnected } = useAccount();
  const { userPoints, unclaimedRewards } = usePoints();
  const { totalPoolBalance } = useSBT();
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

  return (
    // Tidak perlu min-h-screen atau pt di sini — sudah di-handle App.jsx main
    <div className="w-full bg-[#0B0E14]">

      {/* HypeFeed — sticky tepat di bawah header, z cukup 10 agar tidak tabrakan dengan BottomNav */}
      <div className="sticky top-16 z-10 w-full">
        <HypeFeed />
      </div>

      {/* Page content wrapper — generous padding px-4, maks lebar konten */}
      <div className="max-w-4xl mx-auto px-4">

        {/* ── Hero Section ─────────────────────────────────────────────────── */}
        {/* Lebih kecil di mobile (py-8), lebih besar di desktop (md:py-14) */}
        <div className="text-center py-8 md:py-14">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight">
            Crypto Disco
          </h1>
          <p className="text-sm md:text-base text-zinc-400 max-w-md mx-auto leading-relaxed">
            Complete daily tasks, earn points, and win premium NFTs through our on-chain raffle system.
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
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">
                  SBT Reward Pool
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-5xl font-black text-white tabular-nums">
                    ${poolUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-zinc-500 font-semibold text-base">USDC</span>
                </div>
                <p className="text-zinc-600 text-xs mt-1 font-mono">≈ {poolETH} ETH</p>
              </div>

              {poolSettings?.claimTimestamp > Date.now() && (
                <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3 self-start sm:self-auto">
                  <TimerIcon className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Next Drop</p>
                    <div className="text-sm font-black text-white font-mono">
                      <HomeCountdown timestamp={poolSettings.claimTimestamp} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar — bersih, tanpa glow shadow berat */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 font-medium">Reward Progress</span>
                <span className="text-xs font-bold text-indigo-400">{progressPct}% of ${targetUSDC.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center gap-2 text-xs text-emerald-500 font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
              No Riba · Verified On-Chain · Live Rate
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

                      <h3 className="text-base font-bold text-white mb-1 leading-snug">{String(card.title || '')}</h3>
                      <p className="text-zinc-500 text-sm leading-relaxed">
                        {String(card.description || '')}
                      </p>

                      {card.linkText && (
                        <div className={`flex items-center mt-3 text-sm font-semibold text-${card.color || 'indigo'}-400 group-hover:underline`}>
                          {String(card.linkText)} →
                        </div>
                      )}

                      {card.badge && (
                        <div className="flex items-center gap-1 text-xs text-zinc-600 mt-2">
                          <Shield className="w-3 h-3" />
                          <span>{String(card.badge)}</span>
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
