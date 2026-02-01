import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Ticket, Gift, Users, TrendingUp, Sparkles, Shield } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useUserInfo } from './useContract'; // Corrected path to match project structure

export function HomePage() {
  const { address } = useAccount();
  // Safe default value for userInfo to prevent crash
  const { userInfo } = useUserInfo(address) || {};

  const features = [
    {
      icon: Ticket,
      title: 'Free Daily Tickets',
      description: 'Get 1 free raffle ticket every day just by logging in',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Gift,
      title: 'Premium NFTs',
      description: 'Win exclusive NFT collections worth thousands',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Shield,
      title: 'Provably Fair',
      description: 'Powered by Chainlink VRF for transparent randomness',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: TrendingUp,
      title: 'Low Entry Cost',
      description: 'Additional tickets only $0.15 each + 5% fee',
      color: 'from-orange-500 to-red-500',
    },
  ];

  const stats = [
    { label: 'Active Raffles', value: '12', icon: Ticket },
    { label: 'Total Winners', value: '1,234', icon: Users },
    { label: 'NFTs Distributed', value: '5,678', icon: Gift },
    { label: 'Total Volume', value: '$45K', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-slate-950 opacity-50"></div>

        {/* Floating elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full opacity-20 blur-xl"
          />
          <motion.div
            animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 7, repeat: Infinity }}
            className="absolute bottom-20 right-10 w-32 h-32 bg-gradient-to-br from-pink-400 to-orange-400 rounded-full opacity-20 blur-xl"
          />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center space-x-2 bg-slate-900/50 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-full mb-6 shadow-2xl">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-slate-300">Built on Base Network</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-bold mb-6">
                <span className="text-gradient">Win Premium NFTs</span>
                <br />
                <span className="text-white">Every Single Day</span>
              </h1>

              <p className="text-xl md:text-2xl text-slate-400 mb-8 max-w-2xl mx-auto">
                The most transparent and fair NFT raffle platform. Get free tickets daily and increase your chances with affordable extras.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <Link to="/raffles">
                  <button className="btn-primary px-8 py-4 text-lg">
                    <Ticket className="inline w-5 h-5 mr-2" />
                    Browse Raffles
                  </button>
                </Link>
                {address && (
                  <Link to="/profile">
                    <button className="btn-secondary px-8 py-4 text-lg">
                      <Users className="inline w-5 h-5 mr-2" />
                      My Profile
                    </button>
                  </Link>
                )}
              </div>

              {address && userInfo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 glass-card inline-block px-6 py-3"
                >
                  <p className="text-sm text-slate-400">
                    You have <span className="font-bold text-blue-400">{Number(userInfo.freeTicketsAvailable || 0)}</span> free tickets available
                  </p>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-slate-900/20 backdrop-blur-sm border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
              // FIX: Assign to variable first (React Standard)
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="stat-card"
                >
                  <Icon className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                  <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-white mb-4">Why Choose NFT Raffle?</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Experience the most transparent, fair, and rewarding NFT raffle platform on Base
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              // FIX: Assign to variable first (React Standard)
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card p-6 hover:scale-105 transition-transform duration-300"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} p-3 mb-4`}>
                    <Icon className="w-full h-full text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 text-center max-w-3xl mx-auto relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
            <div className="relative z-10">
              <h2 className="text-4xl font-bold text-white mb-4">Ready to Win?</h2>
              <p className="text-xl text-slate-400 mb-8">
                Connect your wallet and claim your free daily ticket now
              </p>
              <Link to="/raffles">
                <button className="btn-primary px-10 py-5 text-xl">
                  Get Started Now
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
