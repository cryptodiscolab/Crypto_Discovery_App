import { Link } from 'react-router-dom';
import { Sparkles, Trophy, User, Ticket, Shield, TrendingUp } from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';

export function HomePage() {
  const { isConnected } = useAccount();
  const { userPoints, unclaimedRewards } = usePoints();

  return (
    <div className="min-h-screen bg-[#F8F9FB] pt-20 pb-12">
      <div className="container mx-auto px-4">

        {/* Hero Section */}
        <div className="text-center py-12 mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">
            Crypto Disco
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Complete daily tasks, earn points, and win premium NFTs through our quantum-powered raffle system.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">

          {/* Tasks Card */}
          <Link to="/tasks">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Daily Tasks</h3>
              <p className="text-slate-600 text-sm mb-4">
                Complete simple social tasks to earn points. Follow us on X, join our Farcaster channel, and more.
              </p>
              <div className="flex items-center text-blue-600 font-medium text-sm">
                Start Earning →
              </div>
            </div>
          </Link>

          {/* Raffle Card */}
          <Link to="/raffles">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Ticket className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">NFT Raffles</h3>
              <p className="text-slate-600 text-sm mb-4">
                Use your points to enter raffles for premium NFTs. Powered by API3 QRNG for true randomness.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-purple-600 font-medium text-sm">Browse Raffles →</span>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Shield className="w-3 h-3" />
                  <span>Verified</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Profile/Stats Card */}
          <Link to="/profile">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Your Profile</h3>
              <p className="text-slate-600 text-sm mb-4">
                Track your points, view your raffle history, and claim your winnings.
              </p>

              {isConnected ? (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Points</div>
                    <div className="text-lg font-bold text-slate-900">{userPoints || 0}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Claims</div>
                    <div className="text-lg font-bold text-slate-900">{unclaimedRewards?.length || 0}</div>
                  </div>
                </div>
              ) : (
                <div className="text-green-600 font-medium text-sm">
                  View Profile →
                </div>
              )}
            </div>
          </Link>

          {/* Leaderboard Card */}
          <Link to="/leaderboard">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Leaderboard</h3>
              <p className="text-slate-600 text-sm mb-4">
                See who's winning the most raffles and earning the most points in our community.
              </p>
              <div className="flex items-center text-yellow-600 font-medium text-sm">
                View Rankings →
              </div>
            </div>
          </Link>

          {/* How It Works Card */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-6 shadow-sm h-full">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">How It Works</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">1.</span>
                <span>Connect your wallet</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">2.</span>
                <span>Complete daily tasks to earn points</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">3.</span>
                <span>Use points to enter NFT raffles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">4.</span>
                <span>Win & claim your prizes!</span>
              </li>
            </ul>
          </div>

          {/* Stats Card */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm h-full">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Platform Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm">Active Raffles</span>
                <span className="text-lg font-bold text-slate-900">12</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm">Total Winners</span>
                <span className="text-lg font-bold text-slate-900">1,234</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm">NFTs Distributed</span>
                <span className="text-lg font-bold text-slate-900">5,678</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-slate-600 text-sm">Total Volume</span>
                <span className="text-lg font-bold text-blue-600">$45K</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
