import { useMemo } from 'react';
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Shield, Wallet } from 'lucide-react';
import { baseSepolia } from 'wagmi/chains';
import { usePoints } from './shared/context/PointsContext';
import { useCMS } from './hooks/useCMS';
import { useFarcaster } from './shared/context/FarcasterContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import { ABIS, CONTRACTS } from './lib/contracts';

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
    return Boolean(isSBTAdmin || isCMSAdmin || canEditCMS);
  }, [isSBTAdmin, isCMSAdmin, canEditCMS]);

  const navItems = [
    { path: '/', label: 'HOME' },
    { path: '/tasks', label: 'TASKS' },
    { path: '/raffles', label: 'RAFFLES' },
    { path: '/leaderboard', label: 'LEADERBOARD' },
    { path: '/profile', label: 'PROFILE' },
  ];

  // Add admin links if user is admin
  if (isAdmin) {
    navItems.push({ path: '/admin', label: 'ADMIN HUB', isAdmin: true });
  }

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-[10000] pointer-events-auto bg-[#050505]/80 backdrop-blur-3xl border-b border-white/[0.05] active:z-[10001]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Left: Logo & Farcaster Welcome */}
          <div className="flex-1 flex flex-col justify-center">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-black text-xl text-white hover:text-[#0052FF] transition-colors group"
            >
              <div className="w-8 h-8 bg-[#0052FF] rounded-lg flex items-center justify-center group-hover:bg-[#0052FF]/80 transition-colors">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="inline lg:inline tracking-tighter text-[11px] lg:text-xl transform lg:scale-100 origin-left">
                CRYPTO <span className="text-[#0052FF]">DISCO</span>
              </span>
            </Link>
            {frameUser && (
              <p className="text-[11px] font-black text-indigo-400/80 uppercase tracking-widest mt-0.5 ml-1 truncate max-w-[120px]">
                @{frameUser.username}
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
                  className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${isActive
                    ? 'text-white bg-[#0052FF]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    {item.isAdmin && <Shield className="w-3 h-3 text-white/60" />}
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Right: RainbowKit ConnectButton - Responsive */}
          <div className="flex flex-1 justify-end items-center">
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
                            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#0052FF] hover:bg-[#0052FF]/90 transition-all rounded-xl min-h-[40px] active:scale-95"
                          >
                            <Wallet className="w-4 h-4 text-white" strokeWidth={2.5} />
                            <span className="text-[11px] font-black text-white uppercase tracking-widest hidden sm:inline">CONNECT</span>
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={() => switchChain({ chainId: baseSepolia.id })}
                            type="button"
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all min-h-[40px] active:scale-95"
                          >
                            <span className="hidden sm:inline">SWITCH NETWORK</span>
                            <span className="sm:hidden">SWITCH</span>
                          </button>
                        );
                      }

                      return (
                         <button
                          onClick={openAccountModal}
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all min-h-[40px] active:scale-95"
                        >
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] font-black text-white uppercase tracking-widest max-w-[80px] md:max-w-none truncate">{account.displayName}</span>
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
