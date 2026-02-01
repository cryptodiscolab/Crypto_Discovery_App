import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, useLocation } from 'react-router-dom';
import { Ticket, Trophy, User, Home, Plus } from 'lucide-react';
import { NeynarAuthButton, useNeynarContext } from "@neynar/react";
import { useEnvironment } from './useEnvironment';

export function Header() {
  const location = useLocation();
  // Safe access to user context
  const { user } = useNeynarContext();
  const { isFarcaster } = useEnvironment();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/raffles', icon: Ticket, label: 'Raffles' },
    { path: '/create', icon: Plus, label: 'Host Raffle' },
    { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-white/5">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                <Ticket className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">NFT Raffle</h1>
              <p className="text-xs text-slate-400">Base Network</p>
            </div>
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Connect Wallet & Farcaster */}
          <div className="flex items-center space-x-4">
            {!isFarcaster && <NeynarAuthButton />}

            {/* INI BAGIAN YANG DIBENERIN: accountStatus JADI STRING */}
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
              accountStatus="address"
            />
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex justify-around mt-4 pt-4 border-t border-slate-200">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-200 ${isActive
                  ? 'text-blue-400'
                  : 'text-slate-400'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
