import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, useLocation } from 'react-router-dom';
import { Ticket, Trophy, User, Home, Plus, Sparkles, Shield } from 'lucide-react';
import { usePoints } from './shared/context/PointsContext';

export function Header() {
  const location = useLocation();
  const { isAdmin } = usePoints();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/tasks', icon: Sparkles, label: 'Tasks' },
    { path: '/raffles', icon: Ticket, label: 'Raffles' },
    { path: '/create', icon: Plus, label: 'Host' },
    { path: '/leaderboard', icon: Trophy, label: 'Winners' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-white/5">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-xl">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">NFT Raffle</h1>
            </div>
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${location.pathname === item.path ? 'bg-white/10 text-white' : 'text-slate-400'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}

            {/* Admin Menu - Only visible to admin */}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all border border-yellow-500/30 ${location.pathname === '/admin' ? 'bg-yellow-500/20 text-yellow-400' : 'text-yellow-400 hover:bg-yellow-500/10'
                  }`}
              >
                <Shield className="w-4 h-4" />
                <span className="font-medium">Admin</span>
              </Link>
            )}
          </nav>

          {/* Connect Wallet - VERSI POLOS (Paling Aman) */}
          <div className="flex items-center space-x-4">
            <ConnectButton />
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex justify-around mt-4 pt-4 border-t border-slate-200">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center space-y-1 px-3 py-2 text-slate-400"
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
