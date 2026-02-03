import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, Shield } from 'lucide-react';
import { usePoints } from './shared/context/PointsContext';
import { motion, AnimatePresence } from 'framer-motion';

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-900 hover:text-blue-600 transition-colors">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:inline">Crypto Disco</span>
          </Link>

          {/* Desktop Navigation - Center */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                      ? item.isAdmin
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : 'bg-blue-50 text-blue-700'
                      : item.isAdmin
                        ? 'text-yellow-600 hover:bg-yellow-50'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {item.isAdmin && <Shield className="w-4 h-4 inline mr-1" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side - Connect Wallet + Mobile Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ConnectButton showBalance={false} chainStatus="icon" />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 z-40 md:hidden"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50 md:hidden"
            >
              <nav className="container mx-auto px-4 py-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
                          ? item.isAdmin
                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                            : 'bg-blue-50 text-blue-700'
                          : item.isAdmin
                            ? 'text-yellow-600 hover:bg-yellow-50'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      {item.isAdmin && <Shield className="w-4 h-4 inline mr-2" />}
                      {item.label}
                    </Link>
                  );
                })}

                {/* Connect Wallet in Mobile Menu */}
                <div className="pt-3 border-t border-slate-200">
                  <ConnectButton showBalance={false} />
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
