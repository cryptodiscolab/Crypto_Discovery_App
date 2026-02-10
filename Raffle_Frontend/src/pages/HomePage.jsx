import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Trophy,
  User,
  Ticket,
  Shield,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Timer as TimerIcon
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT } from '../hooks/useSBT';
import { useCMS } from '../hooks/useCMS';
import { formatUnits } from 'viem';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { FeatureCardSkeleton } from '../components/FeatureCardSkeleton';

// Icon mapping for dynamic feature cards
const iconMap = {
  Sparkles,
  Trophy,
  User,
  Ticket,
  Shield,
  TrendingUp,
};

// Default feature cards if CMS is empty or loading
const DEFAULT_FEATURE_CARDS = [
  {
    title: "NFT Raffles",
    description: "Enter active raffles and win premium NFTs using your earned points.",
    icon: "Trophy",
    link: "/raffles",
    linkText: "Enter Raffle",
    color: "yellow",
    badge: "Most Popular"
  },
  {
    title: "Daily Tasks",
    description: "Complete simple tasks daily to stack social points and rewards.",
    icon: "Sparkles",
    link: "/tasks",
    linkText: "Earn Points",
    color: "indigo",
    badge: "Daily Bonus"
  },
  {
    title: "Leaderboard",
    description: "Track your rank and see how you stack up against the community.",
    icon: "TrendingUp",
    link: "/leaderboard",
    linkText: "View Ranking",
    color: "purple"
  }
];

export function HomePage() {
  const { isConnected } = useAccount();
  const { userPoints, unclaimedRewards } = usePoints();
  const { totalPoolBalance } = useSBT();
  const {
    featureCards = [],
    announcement,
    poolSettings,
    ethPrice = 2500,
    isLoading
  } = useCMS();

  // DEBUG: Log all CMS data to find React elements
  console.log('🔍 HomePage CMS Data:', {
    featureCards,
    announcement,
    poolSettings,
    ethPrice,
    isLoading
  });

  // Check if any value is a React element
  const checkForReactElement = (obj, path = '') => {
    if (obj && typeof obj === 'object') {
      if (obj.$$typeof) {
        console.error(`🚨 FOUND REACT ELEMENT at ${path}:`, obj);
      }
      Object.keys(obj).forEach(key => {
        checkForReactElement(obj[key], `${path}.${key}`);
      });
    }
  };

  checkForReactElement({ featureCards, announcement, poolSettings }, 'CMS');

  // Use CMS cards if available, otherwise fall back to defaults
  const displayCards = featureCards && featureCards.length > 0 ? featureCards : DEFAULT_FEATURE_CARDS;

  return (
    <div className="min-h-screen bg-[#0B0E14] pt-12 pb-12">
      <div className="container mx-auto px-4 pt-10">

        {/* Hero Section */}
        <div className="text-center py-12 mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Crypto Disco
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Complete daily tasks, earn points, and win premium NFTs through our quantum-powered raffle system.
          </p>
        </div>

        {/* Announcement Banner (from on-chain CMS) */}
        <AnnouncementBanner announcement={announcement} />

        {/* SBT Community Sharing Pool - MODERN PROGRESS WIDGET */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="glass-card relative overflow-hidden group border-indigo-500/20 bg-slate-900/40">
            {/* Animated background glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 p-8 md:p-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                  <p className="text-indigo-400 text-xs font-black uppercase tracking-[0.2em] mb-3">
                    Community Sharing Pool (TVL)
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter">
                      ${String(((parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice)).toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                    </h2>
                    <span className="text-slate-500 font-bold text-xl uppercase italic">USDC</span>
                  </div>
                  <p className="text-slate-500 text-sm mt-1 flex items-center gap-1 font-mono">
                    ≈ {String(parseFloat(formatUnits(totalPoolBalance || 0n, 18)).toFixed(4))} ETH
                  </p>
                </div>

                {poolSettings?.claimTimestamp > Date.now() && (
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center animate-pulse">
                      <TimerIcon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Next Distribution</p>
                      <div className="text-lg font-black text-white font-mono">
                        <HomeCountdown timestamp={poolSettings.claimTimestamp} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar Container */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pool Progress</span>
                  <span className="text-sm font-black text-indigo-400">
                    {Math.min(((parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice) / (poolSettings?.targetUSDC || 5000)) * 100, 100).toFixed(1)}% to Target
                  </span>
                </div>

                <div className="h-6 bg-black/40 rounded-full border border-white/5 p-1 relative overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(((parseFloat(formatUnits(totalPoolBalance || 0n, 18)) * ethPrice) / (poolSettings?.targetUSDC || 5000)) * 100, 100)}%` }}
                    className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  />
                </div>

                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter pt-1">
                  <span>Start: $0</span>
                  <span className="text-slate-300">Phase Goal: ${String(poolSettings?.targetUSDC?.toLocaleString() || '5,000')}</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2">
                <div className="flex items-center gap-2 text-[11px] text-green-400 font-bold uppercase tracking-wide">
                  <CheckCircle className="w-3.5 h-3.5" />
                  No Riba / Verified On-Chain
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 italic">
                  * Live conversion rate based on market price
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid - Dynamic from CMS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {isLoading ? (
            <FeatureCardSkeleton count={6} />
          ) : (
            displayCards
              .filter(card => card.visible !== false) // Only show visible cards
              .map((card, index) => {
                const IconComponent = iconMap[card.icon] || Sparkles;
                return (
                  <Link key={index} to={card.link || '/'}>
                    <div className={`bg-[#161B22] border border-white/${card.borderOpacity || '10'} rounded-2xl p-6 shadow-xl hover:border-indigo-500/50 transition-all hover:-translate-y-1 cursor-pointer h-full`}>
                      <div className={`w-12 h-12 bg-${card.color || 'indigo'}-500/10 rounded-xl flex items-center justify-center mb-4`}>
                        <IconComponent className={`w-6 h-6 text-${card.color || 'indigo'}-400`} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{String(card.title || '')}</h3>
                      <p className="text-slate-400 text-sm mb-4">
                        {String(card.description || '')}
                      </p>
                      {card.linkText && (
                        <div className={`flex items-center text-${card.color || 'indigo'}-400 font-medium text-sm`}>
                          {String(card.linkText)}
                        </div>
                      )}
                      {card.badge && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
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

// Helper: Simple countdown for home page
function HomeCountdown({ timestamp }) {
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
