import { Link } from 'react-router-dom';
import { Sparkles, Trophy, User, Ticket, Shield, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { useSBT } from '../hooks/useSBT';
import { formatEther } from 'ethers';

export function HomePage() {
  const { isConnected } = useAccount();
  const { userPoints, unclaimedRewards } = usePoints();
  const { totalPoolBalance } = useSBT();

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

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">

          {/* Tasks Card */}
          <Link to="/tasks">
            <div className="bg-[#161B22] border border-white/10 rounded-2xl p-6 shadow-xl hover:border-indigo-500/50 transition-all hover:-translate-y-1 cursor-pointer h-full">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Daily Tasks</h3>
              <p className="text-slate-400 text-sm mb-4">
                Complete simple social tasks to earn points. Follow us on X, join our Farcaster channel, and more.
              </p>
              <div className="flex items-center text-indigo-400 font-medium text-sm">
                Start Earning →
              </div>
            </div>
          </Link>

          {/* Raffle Card */}
          <Link to="/raffles">
            <div className="bg-[#161B22] border border-white/5 rounded-3xl p-6 hover:border-indigo-500/50 transition-all hover:-translate-y-1 cursor-pointer h-full">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
                <Ticket className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">NFT Raffles</h3>
              <p className="text-slate-400 text-sm mb-4">
                Get your premium NFTs, Cash reward & many more. Powered by API3 QRNG true quantum randomness.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-purple-400 font-medium text-sm">Browse Raffles →</span>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Shield className="w-3 h-3" />
                  <span>Verified</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Profile/Stats Card */}
          <Link to="/profile">
            <div className="bg-[#161B22] border border-white/5 rounded-3xl p-6 hover:border-indigo-500/50 transition-all hover:-translate-y-1 cursor-pointer h-full">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Your Profile</h3>
              <p className="text-slate-400 text-sm mb-4">
                Track your points, view your raffle history, and claim your winnings.
              </p>

              {isConnected ? (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Points</div>
                    <div className="text-lg font-bold text-white">{userPoints || 0}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Claims</div>
                    <div className="text-lg font-bold text-white">{unclaimedRewards?.length || 0}</div>
                  </div>
                </div>
              ) : (
                <div className="text-green-400 font-medium text-sm">
                  View Profile →
                </div>
              )}
            </div>
          </Link>

          {/* Leaderboard Card */}
          <Link to="/leaderboard">
            <div className="bg-[#161B22] border border-white/5 rounded-3xl p-6 hover:border-indigo-500/50 transition-all hover:-translate-y-1 cursor-pointer h-full">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Leaderboard</h3>
              <p className="text-slate-400 text-sm mb-4">
                See who's winning the most raffles and earning the most points in our community.
              </p>
              <div className="flex items-center text-yellow-400 font-medium text-sm">
                View Rankings →
              </div>
            </div>
          </Link>

          {/* How It Works Card */}
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-6 h-full">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">How It Works</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">1.</span>
                <span>Connect your wallet</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">2.</span>
                <span>Complete daily tasks to earn points</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">3.</span>
                <span>Use points to enter NFT raffles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">4.</span>
                <span>Win & claim your prizes!</span>
              </li>
            </ul>
          </div>

          {/* Stats Card */}
          <div className="bg-[#161B22] border border-white/5 rounded-3xl p-6 h-full">
            <h3 className="text-xl font-bold text-white mb-4">Platform Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Active Raffles</span>
                <span className="text-lg font-bold text-white">12</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Total Winners</span>
                <span className="text-lg font-bold text-white">1,234</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">NFTs Distributed</span>
                <span className="text-lg font-bold text-white">5,678</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <span className="text-slate-400 text-sm">Total Volume</span>
                <span className="text-lg font-bold text-indigo-400">$45K</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
