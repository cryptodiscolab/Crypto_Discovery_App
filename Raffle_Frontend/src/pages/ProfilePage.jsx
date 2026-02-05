import { useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Trophy, Gift, Wallet, ExternalLink, Timer as TimerIcon, RefreshCw, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePoints } from '../shared/context/PointsContext';
import { useRaffle } from '../hooks/useRaffle';
import { SBTRewardsDashboard } from '../components/SBTRewardsDashboard';

export function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { unclaimedRewards } = usePoints();
  const { claimPrize, rerollWinner } = useRaffle();

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
          <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
            <Award className="w-8 h-8 text-indigo-500" />
            Community Rewards
          </h2>
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
