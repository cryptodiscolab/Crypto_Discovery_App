import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import {
  ConnectWallet,
  Wallet as OnchainWallet,
  WalletDropdown,
  WalletDropdownDisconnect
} from '@coinbase/onchainkit/wallet';
import { Name, Address, Avatar, Identity } from '@coinbase/onchainkit/identity';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Shield, Wallet } from 'lucide-react';
import { usePoints } from './shared/context/PointsContext';
import { useCMS } from './hooks/useCMS';

const MASTER_ADMIN = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

export function Header() {
  const { address, isConnected } = useAccount();
  const location = useLocation();
  const { isAdmin: isSBTAdmin } = usePoints();
  const { isAdmin: isCMSAdmin, canEdit: canEditCMS } = useCMS();

  const isAdmin = useMemo(() => {
    if (!address) return isSBTAdmin || isCMSAdmin || canEditCMS;

    const currentAddr = address.toLowerCase();

    // Master Admin Bypass
    if (currentAddr === MASTER_ADMIN) return true;

    const envAdmin = import.meta.env.VITE_ADMIN_ADDRESS || '';
    const envWallets = import.meta.env.VITE_ADMIN_WALLETS || '';
    const adminList = `${envAdmin},${envWallets}`
      .split(',')
      .map(a => a.trim().toLowerCase())
      .filter(a => a.startsWith('0x'));

    const isManualAdmin = adminList.includes(currentAddr);

    return isSBTAdmin || isCMSAdmin || canEditCMS || isManualAdmin;
  }, [address, isSBTAdmin, isCMSAdmin, canEditCMS]);

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/raffles', label: 'Raffles' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/profile', label: 'Profile' },
  ];

  // Add admin links if user is admin
  if (isAdmin) {
    navItems.push({ path: '/admin', label: 'Admin', isAdmin: true });
    navItems.push({ path: '/admin-sbt', label: 'Admin SBT', isAdmin: true });
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
                  {/* Premium Hover Border Effect */}
                  {!isActive && (
                    <div className="absolute inset-0 border border-transparent group-hover:border-indigo-500/50 rounded-xl transition-all duration-300 pointer-events-none" />
                  )}
                  {!isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-indigo-500 group-hover:w-1/2 transition-all duration-300" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Wallet (Icon Only) */}
          <div className="flex-1 flex justify-end items-center">
            <OnchainWallet>
              {projectId ? (
                <ConnectWallet
                  text=""
                  className="!min-w-[44px] !min-h-[44px] !bg-indigo-500/20 !border !border-indigo-500/50 !rounded-xl !flex !items-center !justify-center"
                >
                  {isConnected ? (
                    <Identity className="!bg-transparent !p-0" address={address}>
                      <Avatar className="!w-8 !h-8" />
                    </Identity>
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white">
                      <Wallet className="w-5 h-5" />
                    </div>
                  )}
                </ConnectWallet>
              ) : null}
              <WalletDropdown className="mt-4">
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </OnchainWallet>
          </div>
        </div>
      </div>
    </header>
  );
}
