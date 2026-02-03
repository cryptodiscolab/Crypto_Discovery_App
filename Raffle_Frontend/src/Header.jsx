import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, Shield } from 'lucide-react';
import { usePoints } from './shared/context/PointsContext';

export function Header() {
  const location = useLocation();
  const { isAdmin } = usePoints();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0E14]/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-xl text-white hover:text-indigo-400 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:inline">Crypto Disco</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-10">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${isActive
                      ? item.isAdmin
                        ? 'text-yellow-400'
                        : 'text-indigo-400'
                      : 'text-slate-400 hover:text-indigo-400'
                    }`}
                >
                  {item.isAdmin && <Shield className="w-4 h-4 inline mr-1 text-yellow-500" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side - Connect Wallet + Mobile Menu */}
          <div className="flex items-center gap-3">
            {/* Connect Button (Single for both Desktop & Mobile) */}
            <ConnectButton showBalance={false} chainStatus="icon" />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#0B0E14]">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm font-medium transition-colors ${isActive
                      ? item.isAdmin
                        ? 'text-yellow-400'
                        : 'text-indigo-400'
                      : 'text-slate-400 hover:text-indigo-400'
                    }`}
                >
                  {item.isAdmin && <Shield className="w-4 h-4 inline mr-2 text-yellow-500" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
