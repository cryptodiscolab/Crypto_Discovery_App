import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, Shield } from 'lucide-react';
import { usePoints } from './shared/context/PointsContext';
import { useCMS } from './hooks/useCMS';

export function Header() {
  const { address } = useAccount();
  const location = useLocation();
  const { isAdmin: isSBTAdmin } = usePoints();
  const { isAdmin: isCMSAdmin, canEdit: canEditCMS } = useCMS();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // User is admin if they're admin of either SBT or CMS contract
  // Fallback: check against hardcoded/env admin address if connected
  const hardcodedAdmin = import.meta.env.VITE_ADMIN_ADDRESS;
  const isAdmin =
    isSBTAdmin ||
    isCMSAdmin ||
    canEditCMS ||
    (address && hardcodedAdmin && address.toLowerCase() === hardcodedAdmin.toLowerCase());

  // DEBUG: Log admin status
  console.log('[Header] isSBTAdmin:', isSBTAdmin);
  console.log('[Header] isCMSAdmin:', isCMSAdmin);
  console.log('[Header] canEdit:', canEditCMS);
  console.log('[Header] Final isAdmin:', isAdmin);

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/raffles', label: 'Raffles' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/profile', label: 'Profile' },
  ];

  // Add admin link if user is admin
  if (isAdmin) {
    navItems.push({ path: '/admin', label: 'Admin', isAdmin: true });
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0E14]/70 backdrop-blur-xl border-b border-white/5">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">

          {/* Left: Logo */}
          <div className="flex-1 flex justify-start">
            <Link
              to="/"
              className="flex items-center gap-3 font-black text-2xl text-white hover:text-indigo-400 transition-all group"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="hidden lg:inline tracking-tighter">CRYPTO <span className="text-indigo-400">DISCO</span></span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-x-1 lg:gap-x-2 bg-white/5 p-1 rounded-2xl border border-white/5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-5 py-2 text-sm font-bold rounded-xl transition-all relative group ${isActive
                    ? item.isAdmin
                      ? 'text-yellow-400 bg-yellow-400/10'
                      : 'text-white bg-indigo-600 shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {item.isAdmin && <Shield className="w-3.5 h-3.5 text-yellow-500" />}
                    {item.label}
                  </div>
                  {!isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-indigo-500 group-hover:w-1/2 transition-all duration-300" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Wallet + Mobile Menu Button */}
          <div className="flex-1 flex justify-end items-center gap-4">
            <div className="hidden sm:block">
              <ConnectButton showBalance={false} chainStatus="icon" />
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-3 text-slate-400 hover:text-white bg-white/5 border border-white/5 rounded-xl transition-all active:scale-90"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Fragment (Improved styling) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[80px] bottom-0 bg-[#0B0E14]/95 backdrop-blur-2xl border-t border-white/5 z-40 overflow-y-auto">
          <nav className="container mx-auto px-6 py-8 flex flex-col gap-3">
            <div className="px-4 mb-4">
              <ConnectButton showBalance={true} />
            </div>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center justify-between p-4 rounded-2xl text-lg font-bold transition-all ${isActive
                    ? item.isAdmin
                      ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                      : 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20'
                    : 'text-slate-400 bg-white/5 hover:bg-white/10'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {item.isAdmin && <Shield className="w-5 h-5 text-yellow-500" />}
                    {item.label}
                  </div>
                  <div className="w-2 h-2 rounded-full bg-current opacity-20" />
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
