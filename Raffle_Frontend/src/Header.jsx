import { useMemo } from 'react';
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Shield, Wallet } from 'lucide-react';
import { baseSepolia } from 'wagmi/chains';
import { usePoints } from './shared/context/PointsContext';
import { useCMS } from './hooks/useCMS';
import { useFarcaster } from './shared/context/FarcasterContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const MASTER_ADMIN = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

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
    navItems.push({ path: '/admin', label: 'Admin Hub', isAdmin: true });
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] pointer-events-auto bg-[#0B0E14]/70 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-screen-lg mx-auto px-4">
        <div className="flex items-center justify-between h-20">

          {/* Left: Logo & Farcaster Welcome */}
          <div className="flex-1 flex flex-col justify-center">
            <Link
              to="/"
              className="flex items-center gap-3 font-black text-2xl text-white hover:text-indigo-400 transition-all group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
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
                            className="flex items-center gap-3 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 transition-all rounded-xl shadow-lg shadow-indigo-500/20 group"
                          >
                            <Wallet className="w-4 h-4 text-white group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                            <span className="text-xs font-black text-white uppercase tracking-widest">Connect Wallet</span>
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={() => switchChain({ chainId: baseSepolia.id })}
                            type="button"
                            className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
                          >
                            Switch to Base
                          </button>
                        );
                      }

                      return (
                        <button
                          onClick={openAccountModal}
                          type="button"
                          className="flex items-center gap-3 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                        >
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-bold text-white uppercase tracking-widest">{account.displayName}</span>
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
