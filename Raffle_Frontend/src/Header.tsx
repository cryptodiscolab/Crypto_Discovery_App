import { useMemo } from 'react';
import { useSwitchChain, useAccount } from 'wagmi';
import { Link } from 'react-router-dom';
import { Sparkles, Wallet, Fuel } from 'lucide-react';
import { baseSepolia } from 'wagmi/chains';
import { usePoints } from './shared/context/PointsContext';
import { useCMS } from './hooks/useCMS';
import { useFarcaster } from './shared/context/FarcasterContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';


interface NavItem {
  path: string;
  label: string;
  isAdmin?: boolean;
}

export function Header() {
  const { switchChain } = useSwitchChain();
  const { chain } = useAccount();
  const { frameUser } = useFarcaster();
  const { isAdmin: isSBTAdmin, gasTracker, userPoints } = usePoints();
  const { isAdmin: isCMSAdmin, canEdit: canEditCMS } = useCMS();

  // Gas indicator color mapping
  const gasIndicator = useMemo(() => {
    if (!gasTracker || gasTracker.isLoadingGas || gasTracker.gasCategory === 'Unknown') return null;
    const cat = gasTracker.gasCategory;
    const gwei = gasTracker.gasPriceGwei;
    const colorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
      'Cheap':     { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
      'Normal':    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
      'High':      { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
      'Very High': { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-400' },
      'Expensive': { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
    };
    return { colors: colorMap[cat] || colorMap['Normal'], category: cat, gwei: gwei.toFixed(4) };
  }, [gasTracker]);

  const isAdmin = useMemo(() => {
    return Boolean(isSBTAdmin || isCMSAdmin || canEditCMS);
  }, [isSBTAdmin, isCMSAdmin, canEditCMS]);

  const navItems: NavItem[] = [
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
      className="app-header-cyber"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left Area: Mobile Brand / Desktop Pipeline */}
      <div className="flex items-center gap-4">
        {/* Mobile Brand (Hidden on desktop) */}
        <div className="md:hidden flex flex-col justify-center">
          <Link
            to="/"
            className="flex items-center gap-2 font-black text-white hover:text-indigo-400 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-sky-400 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.4)]">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="tracking-tighter text-sm font-black uppercase tracking-wider">
              DISCO LAB
            </span>
          </Link>
          {frameUser && (
            <p className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest mt-0.5 ml-1 truncate max-w-[120px]">
              @{frameUser.username}
            </p>
          )}
        </div>

        {/* Desktop Pipeline Label & Network Badge (Hidden on mobile) */}
        <div className="hidden md:flex items-center gap-4">
          <span className="label-native mb-0">ECOSYSTEM PIPELINE</span>
          <span className="badge-cyber badge-cyber-blue">
            {chain?.name || 'BASE SEPOLIA'}
          </span>
        </div>
      </div>

      {/* Right Area: Gas, User stats, Connect wallet */}
      <div className="flex items-center gap-6">
        {/* Gas Indicator (Hidden on tiny screens) */}
        {gasIndicator && (
          <div
            className={`hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${gasIndicator.colors.bg} ${gasIndicator.colors.border} transition-all duration-500 shrink-0`}
            title={`Gas: ${gasIndicator.gwei} Gwei (${gasIndicator.category})`}
          >
            <Fuel className={`w-3 h-3 ${gasIndicator.colors.text}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${gasIndicator.colors.text}`}>
              {gasIndicator.gwei}
            </span>
            <div className={`w-1.5 h-1.5 rounded-full ${gasIndicator.colors.dot} ${gasIndicator.category === 'Expensive' ? 'animate-pulse' : ''}`} />
          </div>
        )}

        <ConnectButton.Custom>
          {({
            account,
            chain: rbChain,
            openAccountModal,
            openChainModal: _openChainModal,
            openConnectModal,
            authenticationStatus,
            mounted,
          }) => {
            const ready = mounted && authenticationStatus !== 'loading';
            const connected =
              ready &&
              account &&
              rbChain &&
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
                        className="btn-cyber-primary"
                      >
                        <Wallet className="w-4 h-4 text-white" strokeWidth={2.5} />
                        <span>CONNECT</span>
                      </button>
                    );
                  }

                  if (rbChain.unsupported) {
                    return (
                      <button
                        onClick={() => switchChain({ chainId: baseSepolia.id })}
                        type="button"
                        className="btn-cyber-primary bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/60 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                      >
                        <span>SWITCH NETWORK</span>
                      </button>
                    );
                  }

                  return (
                    <div className="flex items-center gap-4">
                      {/* User Stats Block (Hidden on mobile) */}
                      <div className="glass-card hidden sm:flex items-center gap-4 px-4 py-2 border border-white/5 rounded-xl bg-white/[0.01]">
                        <div className="text-right">
                          <div className="label-native text-[9px] mb-0" style={{ margin: 0 }}>Wallet Balance</div>
                          <div className="value-native text-white">{account.displayBalance ? `${account.displayBalance}` : '0 ETH'}</div>
                        </div>
                        <div className="w-[1px] h-6 bg-white/10" />
                        <div>
                          <div className="label-native text-[9px] mb-0" style={{ margin: 0 }}>Total XP</div>
                          <div className="value-native text-[#3b82f6] text-sm font-black">{Number(userPoints).toLocaleString()} XP</div>
                        </div>
                      </div>

                      {/* Wallet Connect Button */}
                      <button
                        onClick={openAccountModal}
                        type="button"
                        className="btn-cyber-native-action"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="max-w-[100px] truncate">{account.displayName}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}
