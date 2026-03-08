import { useMemo } from 'react';
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Shield, Wallet } from 'lucide-react';
import { baseSepolia } from 'wagmi/chains';
import { usePoints } from './shared/context/PointsContext';
import { useCMS } from './hooks/useCMS';
import { useFarcaster } from './shared/context/FarcasterContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import { ABIS, CONTRACTS, ADMIN_WALLETS } from './lib/contracts';

export function Header() {
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { frameUser } = useFarcaster();
  const location = useLocation();
  const navigate = useNavigate();
  const { disconnect } = useDisconnect();
  const { isAdmin: isSBTAdmin } = usePoints();
  const { isAdmin: isCMSAdmin, canEdit: canEditCMS } = useCMS();

  const isAdmin = useMemo(() => {
    if (!address) return isSBTAdmin || isCMSAdmin || canEditCMS;
    const currentAddr = address.toLowerCase();

    // 🛡️ Zero-Hardcode Authority Check
    const isAuthorized = ADMIN_WALLETS.includes(currentAddr);

    return isSBTAdmin || isCMSAdmin || canEditCMS || isAuthorized;
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
    navItems.push({ path: '/admin', label: 'Admin Hub', isAdmin: true });
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] pointer-events-auto bg-[#0B0E14]/80 backdrop-blur-2xl">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Left: Logo & Farcaster Welcome */}
          <div className="flex-1 flex flex-col justify-center">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-black text-xl text-white hover:text-indigo-400 transition-colors group"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="hidden lg:inline tracking-tighter">CRYPTO <span className="text-indigo-400">DISCO</span></span>
            </Link>
            {frameUser && (
              <p className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest mt-1 ml-1 animate-pulse">
                Welcome, @{frameUser.username}
              </p>
            )}
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-x-1 bg-white/5 p-1 rounded-xl">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${isActive
                    ? item.isAdmin
                      ? 'text-yellow-400 bg-yellow-400/10'
                      : 'text-white bg-indigo-600'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    {item.isAdmin && <Shield className="w-3 h-3 text-yellow-500" />}
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Right: RainbowKit ConnectButton - Custom Styled */}
          <div className="hidden md:flex flex-1 justify-end items-center">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === 'authenticated');

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      'style': {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            type="button"
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-lg min-h-[44px]"
                          >
                            <Wallet className="w-4 h-4 text-white" strokeWidth={2.5} />
                            <span className="text-sm font-bold text-white">Connect</span>
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={() => switchChain({ chainId: baseSepolia.id })}
                            type="button"
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors min-h-[44px]"
                          >
                            Switch to Base
                          </button>
                        );
                      }

                      return (
                        <button
                          onClick={openAccountModal}
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors min-h-[44px]"
                        >
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-sm font-semibold text-white">{account.displayName}</span>
                        </button>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </div>
    </header>
  );
}
