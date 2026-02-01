import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Ticket, Trophy, Gift, Wallet, ExternalLink } from 'lucide-react'; // <--- IMPORT PENTING
import { Link } from 'react-router-dom';

export function ProfilePage() {
  const { address, isConnected } = useAccount();

  // Dummy stats
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
