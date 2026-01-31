import { motion } from 'framer-motion';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';

export function LeaderboardPage() {
  // Mock data - in production, this would come from backend API
  const topWinners = [
    { address: '0x742d35Cc6634C0532925a3b8...', wins: 15, tickets: 1250, volume: '$12,500' },
    { address: '0x9A1b2C3D4E5F6789012345AB...', wins: 12, tickets: 980, volume: '$9,800' },
    { address: '0x1234567890ABCDEF12345678...', wins: 10, tickets: 850, volume: '$8,500' },
    { address: '0xABCDEF1234567890ABCDEF12...', wins: 8, tickets: 720, volume: '$7,200' },
    { address: '0x567890ABCDEF1234567890AB...', wins: 7, tickets: 650, volume: '$6,500' },
  ];

  const getRankBadge = (rank) => {
    switch (rank) {
      case 0:
        return { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
      case 1:
        return { icon: Medal, color: 'text-slate-400', bg: 'bg-slate-50' };
      case 2:
        return { icon: Award, color: 'text-orange-500', bg: 'bg-orange-50' };
      default:
        return { icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' };
    }
  };

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-yellow-400 to-orange-400 px-6 py-3 rounded-full mb-4">
            <Trophy className="w-6 h-6 text-white" />
            <span className="text-white font-bold text-lg">Top 100 Winners</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Leaderboard</h1>
          <p className="text-lg text-slate-400">See who's winning the most NFTs</p>
        </motion.div>

        {/* Top 3 Podium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          {/* 2nd Place */}
          <div className="md:order-1 order-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="glass-card p-6 text-center relative"
            >
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-slate-900 border border-white/10 rounded-full p-3 shadow-lg">
                  <Medal className="w-8 h-8 text-slate-400" />
                </div>
              </div>
              <div className="mt-8 mb-4">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <p className="font-mono text-sm text-slate-600 mb-2">
                  {topWinners[1].address.slice(0, 10)}...
                </p>
              </div>
              <div className="space-y-2">
                <div className="bg-white/50 rounded-lg p-2">
                  <p className="text-2xl font-bold text-slate-800">{topWinners[1].wins}</p>
                  <p className="text-xs text-slate-600">Wins</p>
                </div>
                <div className="bg-white/50 rounded-lg p-2">
                  <p className="text-lg font-semibold text-slate-700">{topWinners[1].volume}</p>
                  <p className="text-xs text-slate-600">Volume</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 1st Place */}
          <div className="md:order-2 order-1">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="glass-card p-6 text-center relative border-2 border-yellow-400"
            >
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full p-4 shadow-xl">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
              </div>
              <div className="mt-10 mb-4">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center mb-3 shadow-xl">
                  <span className="text-3xl font-bold text-white">1</span>
                </div>
                <p className="font-mono text-sm text-slate-600 mb-2">
                  {topWinners[0].address.slice(0, 10)}...
                </p>
              </div>
              <div className="space-y-2">
                <div className="bg-yellow-400/10 rounded-lg p-3">
                  <p className="text-3xl font-bold text-yellow-400">{topWinners[0].wins}</p>
                  <p className="text-xs text-yellow-500/70">Wins</p>
                </div>
                <div className="bg-yellow-400/10 rounded-lg p-2">
                  <p className="text-xl font-semibold text-yellow-400">{topWinners[0].volume}</p>
                  <p className="text-xs text-yellow-500/70">Volume</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 3rd Place */}
          <div className="md:order-3 order-3">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="glass-card p-6 text-center relative"
            >
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-slate-900 border border-white/10 rounded-full p-3 shadow-lg">
                  <Award className="w-8 h-8 text-orange-400" />
                </div>
              </div>
              <div className="mt-8 mb-4">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-300 to-orange-400 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <p className="font-mono text-sm text-slate-600 mb-2">
                  {topWinners[2].address.slice(0, 10)}...
                </p>
              </div>
              <div className="space-y-2">
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-2xl font-bold text-white">{topWinners[2].wins}</p>
                  <p className="text-xs text-slate-400">Wins</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-lg font-semibold text-slate-300">{topWinners[2].volume}</p>
                  <p className="text-xs text-slate-400">Volume</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Full Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 border-b border-white/5 text-white">
                Broadway
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Rank</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Address</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Wins</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Tickets</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {topWinners.map((winner, index) => {
                  const badge = getRankBadge(index);
                  const Icon = badge.icon;

                  return (
                    <motion.tr
                      key={winner.address}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-blue-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className={`${badge.bg} p-2 rounded-full`}>
                            <Icon className={`w-5 h-5 ${badge.color}`} />
                          </div>
                          <span className="font-bold text-slate-700">#{index + 1}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-slate-600">{winner.address}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                          {winner.wins}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-slate-700 font-medium">{winner.tickets}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-blue-600 font-bold">{winner.volume}</span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
