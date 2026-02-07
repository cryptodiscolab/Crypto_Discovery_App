import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Home, Zap, Ticket, Trophy, User, ShieldAlert, Wallet } from 'lucide-react';
import {
    ConnectWallet,
    Wallet as OnchainWallet,
    ConnectAccount,
    WalletDropdown,
    WalletDropdownDisconnect
} from '@coinbase/onchainkit/wallet';
import { Name, Address, Avatar, Identity } from '@coinbase/onchainkit/identity';

const ADMIN_ADDRESS = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();

export function BottomNav() {
    const { address, isConnected } = useAccount();

    const isAdmin = useMemo(() => {
        return address?.toLowerCase() === ADMIN_ADDRESS;
    }, [address]);

    const navItems = [
        { path: '/', label: 'Home', icon: <Home className="w-5 h-5" /> },
        { path: '/tasks', label: 'Tasks', icon: <Zap className="w-5 h-5" /> },
        { path: '/raffles', label: 'Raffles', icon: <Ticket className="w-5 h-5" /> },
        { path: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="w-5 h-5" /> },
        // Profile/Wallet is handled separately at the end
    ];

    const gridCols = isAdmin ? 'grid-cols-6' : 'grid-cols-5';

    return (
        <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-[999] bg-black/95 backdrop-blur-lg border-t border-white/5 pb-6 pt-3 px-2 shadow-2xl`}>
            <div className={`grid ${gridCols} items-center justify-items-center`}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-pink-500 scale-110' : 'text-slate-500 hover:text-white'
                            }`
                        }
                    >
                        {item.icon}
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                    </NavLink>
                ))}

                {/* Admin Menu (Only if authorized) */}
                {isAdmin && (
                    <NavLink
                        to="/admin-sbt"
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-yellow-400 scale-110' : 'text-yellow-400/50 hover:text-yellow-400'
                            }`
                        }
                    >
                        <ShieldAlert className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">Admin</span>
                    </NavLink>
                )}

                {/* Profile / Wallet Section */}
                <div className="flex flex-col items-center gap-1">
                    <OnchainWallet>
                        <ConnectWallet className="!bg-transparent !p-0 !min-w-0 !h-auto !flex !flex-col !items-center !gap-1 !border-none !shadow-none hover:!bg-transparent active:!bg-transparent">
                            {isConnected ? (
                                <>
                                    <User className={`w-5 h-5 transition-all ${isConnected ? 'text-indigo-400' : 'text-slate-500'}`} />
                                    <span className="text-[10px] font-bold uppercase tracking-tighter text-indigo-400">Profile</span>
                                </>
                            ) : (
                                <>
                                    <Wallet className="w-5 h-5 text-slate-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">Sign-in</span>
                                </>
                            )}
                        </ConnectWallet>
                        <WalletDropdown className="bottom-full mb-4">
                            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                                <Avatar />
                                <Name />
                                <Address />
                            </Identity>
                            <WalletDropdownDisconnect />
                        </WalletDropdown>
                    </OnchainWallet>
                </div>
            </div>
        </nav>
    );
}
