import { useAccount } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { useFarcaster } from '../shared/context/FarcasterContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sparkles, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MobileTopBar() {
  const { isConnected } = useAccount();
  const { userPoints, profileData } = usePoints();
  const { frameUser } = useFarcaster();

  const typedProfile = profileData as {
    basename?: string | null;
    ens_name?: string | null;
    display_name?: string | null;
  } | null;

  const displayName = frameUser?.username 
    ? `@${frameUser.username}` 
    : typedProfile?.basename || typedProfile?.ens_name || typedProfile?.display_name || 'Nexus Agent';

  return (
    <div className="mobile-top-bar flex items-center justify-between w-full h-[60px] bg-[#050505]/90 border-b border-white/5 backdrop-blur-md sticky top-0 z-[99] px-4 md:hidden">
      {/* Brand logo & stats */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-sky-400 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.4)]">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-white uppercase tracking-widest leading-none">
              DISCO LAB
            </span>
            {isConnected && (
              <span className="text-[9px] font-bold text-indigo-400 mt-0.5 uppercase tracking-wider">
                {displayName.length > 15 ? `${displayName.slice(0, 12)}...` : displayName}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Wallet Connection / Profile info */}
      <div className="flex items-center gap-3">
        {isConnected && (
          <div className="flex flex-col items-end justify-center pr-2 border-r border-white/5">
            <span className="label-native text-[8px] leading-none" style={{ margin: 0 }}>XP Balance</span>
            <span className="value-native text-[11px] text-[#3b82f6] leading-none mt-0.5">{Number(userPoints).toLocaleString()} XP</span>
          </div>
        )}
        
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openConnectModal,
            mounted,
          }) => {
            const ready = mounted;
            const connected = ready && account && chain;

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
                        className="btn-cyber-primary py-2 px-3 h-8 text-[9px] font-black flex items-center gap-1.5 rounded-lg"
                      >
                        <Wallet size={12} className="text-white" strokeWidth={2.5} />
                        <span>CONNECT</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      onClick={openAccountModal}
                      type="button"
                      className="btn-cyber-native-action py-1 px-2.5 h-8 text-[9px] font-black flex items-center gap-1.5 rounded-lg"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="max-w-[70px] truncate">{account.displayName}</span>
                    </button>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </div>
  );
}
