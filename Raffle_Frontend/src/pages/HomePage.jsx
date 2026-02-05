import { Link } from 'react-router-dom';
import { Sparkles, Trophy, User, Ticket, Shield, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT } from '../hooks/useSBT';
import { useCMS } from '../hooks/useCMS';
import { formatEther } from 'ethers';
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

export function HomePage() {
  const { isConnected } = useAccount();
  const { userPoints, unclaimedRewards } = usePoints();
  const { totalPoolBalance } = useSBT();
  const { featureCards, announcement, isLoading } = useCMS();

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

        {/* SBT Community Sharing Pool - TOP PRIORITY */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="glass-card p-8 border-t-4 border-t-indigo-500 relative overflow-hidden bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="w-32 h-32 text-indigo-500" />
            </div>

            <div className="relative z-10">
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">
                Disco Community Pool
              </p>
              <h2 className="text-5xl font-black text-white flex items-center gap-3 mb-3">
                <DollarSign className="w-10 h-10 text-green-400" />
                {parseFloat(formatEther(totalPoolBalance || 0n)).toFixed(6)}
                <span className="text-2xl text-slate-500 font-normal">ETH</span>
              </h2>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="font-semibold">Locked & Distributed On-Chain</span>
                  <span className="text-xs text-slate-500">(Tanpa Riba)</span>
                </p>
                <p className="text-xs text-indigo-400/70 italic">
                  * Rewards distributed in ETH based on current USD exchange rate
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid - Dynamic from CMS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {isLoading ? (
            <FeatureCardSkeleton count={6} />
          ) : (
            featureCards
              .filter(card => card.visible !== false) // Only show visible cards
              .map((card, index) => {
                const IconComponent = iconMap[card.icon] || Sparkles;
                return (
                  <Link key={index} to={card.link || '/'}>
                    <div className={`bg-[#161B22] border border-white/${card.borderOpacity || '10'} rounded-2xl p-6 shadow-xl hover:border-indigo-500/50 transition-all hover:-translate-y-1 cursor-pointer h-full`}>
                      <div className={`w-12 h-12 bg-${card.color || 'indigo'}-500/10 rounded-xl flex items-center justify-center mb-4`}>
                        <IconComponent className={`w-6 h-6 text-${card.color || 'indigo'}-400`} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{card.title}</h3>
                      <p className="text-slate-400 text-sm mb-4">
                        {card.description}
                      </p>
                      {card.linkText && (
                        <div className={`flex items-center text-${card.color || 'indigo'}-400 font-medium text-sm`}>
                          {card.linkText}
                        </div>
                      )}
                      {card.badge && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                          <Shield className="w-3 h-3" />
                          <span>{card.badge}</span>
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
