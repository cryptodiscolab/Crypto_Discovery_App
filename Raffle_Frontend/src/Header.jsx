import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, useLocation } from 'react-router-dom';
import { Ticket, Trophy, User, Home, Plus, Sparkles, Shield, Menu, X } from 'lucide-react';
import { usePoints } from './shared/context/PointsContext';
import { motion, AnimatePresence } from 'framer-motion';

export function Header() {
  const location = useLocation();
  const { isAdmin } = usePoints();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/tasks', icon: Sparkles, label: 'Tasks' },
    { path: '/raffles', icon: Ticket, label: 'Raffles' },
    { path: '/create', icon: Plus, label: 'Host' },
    { path: '/leaderboard', icon: Trophy, label: 'Winners' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  // Dynamically add Admin menu if user is admin
  if (isAdmin) {
    navItems.push({ path: '/admin', icon: Shield, label: 'Admin', isAdminRoute: true });
  }

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-white/5 backdrop-blur-md bg-slate-950/80">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group z-50 relative" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-xl group-hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all duration-300">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">NFT Raffle</h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isSpecial = item.isAdminRoute;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 relative overflow-hidden group ${isActive
                      ? isSpecial ? 'bg-yellow-500/20 text-yellow-400' : 'text-white'
                      : isSpecial ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-slate-400 hover:text-white'
                    } ${isSpecial && !isActive ? 'border border-yellow-500/30 ml-2' : ''}`}
                >
                  {isActive && !isSpecial && (
                    <motion.div
                      layoutId="nav-bg"
                      className="absolute inset-0 bg-white/10 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform" />
                  <span className="font-medium relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center gap-4">
            {/* Connect Wallet */}
            <div className={`${isMobileMenuOpen ? 'hidden' : 'flex'} transition-all`}>
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors z-50 relative"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown / Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden h-screen"
            />

            {/* Menu Content */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full right-4 left-4 mt-2 p-2 bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 md:hidden overflow-hidden"
            >
              <nav className="flex flex-col space-y-1">
                {/* Connect Wallet inside Mobile Menu for better layout */}
                <div className="p-3 mb-2 flex justify-center border-b border-white/5">
                  <ConnectButton showBalance={{ smallScreen: false, largeScreen: true }} accountStatus="full" />
                </div>

                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  const isSpecial = item.isAdminRoute;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive
                          ? isSpecial ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                          : isSpecial ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        } ${isSpecial ? 'border border-yellow-500/20 mt-2' : ''}`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? isSpecial ? 'text-yellow-400' : 'text-blue-400' : ''}`} />
                      <span className="font-medium">{item.label}</span>
                      {isActive && !isSpecial && <motion.div layoutId="mobile-dot" className="w-1.5 h-1.5 bg-blue-400 rounded-full ml-auto" />}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
