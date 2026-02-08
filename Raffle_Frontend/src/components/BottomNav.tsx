import React, { useMemo } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Home, Zap, Ticket, Trophy, ShieldAlert, Wallet, LayoutDashboard } from 'lucide-react';
import {
    ConnectWallet,
    Wallet as OnchainWallet,
    WalletDropdown,
    WalletDropdownDisconnect
} from '@coinbase/onchainkit/wallet';
import { Name, Address, Avatar, Identity } from '@coinbase/onchainkit/identity';

const MASTER_ADMIN = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

export function BottomNav() {
    const { address, isConnected } = useAccount();
    const location = useLocation();
    // const location = useLocation(); // Hook removed as it was unused

    const isAdmin = useMemo(() => {
        if (!address) return false;
        const currentAddr = address.toLowerCase();

        // Master Admin Bypass
        if (currentAddr === MASTER_ADMIN) return true;

        // Check additional admins from environment
        const envAdmin = (import.meta as any).env.VITE_ADMIN_ADDRESS || '';
        const envWallets = (import.meta as any).env.VITE_ADMIN_WALLETS || '';
        const adminList = `${envAdmin},${envWallets}`
            .split(',')
            .map(a => a.trim().toLowerCase())
            .filter(a => a.startsWith('0x'));

        return adminList.includes(currentAddr);
    }, [address]);

    const navItems = [
        { path: '/', label: 'Home', icon: <Home className="w-5 h-5" /> },
        { path: '/tasks', label: 'Tasks', icon: <Zap className="w-5 h-5" /> },
        { path: '/raffles', label: 'Raffles', icon: <Ticket className="w-5 h-5" /> },
        { path: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="w-5 h-5" /> },
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

                {/* Admin Menu (Only if connected and MASTER_ADMIN) */}
                {isAdmin && isConnected && address?.toLowerCase() === MASTER_ADMIN && (
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

                {/* Wallet Section (Icon Only - Forced Render) */}
                <div className="flex flex-col items-center gap-1 relative z-[9999]">
                    <OnchainWallet>
                        {projectId ? (
                            <ConnectWallet
                                className="!bg-white/10 !rounded-full !min-w-[44px] !min-h-[44px] !p-0 flex items-center justify-center !transition-all !opacity-100 !visible"
                            >
                                {isConnected ? (
                                    <Avatar address={address} className="h-8 w-8 !flex !opacity-100 !visible" />
                                ) : (
                                    <Wallet className="!w-7 !h-7 !text-white !block !opacity-100 !visible z-[9999]" />
                                )}
                            </ConnectWallet>
                        ) : null}
                        <WalletDropdown className="bottom-full mb-4">
                            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                                <Avatar />
                                <Name />
                                <Address />
                            </Identity>
                            {isAdmin && (
                                <Link
                                    to="/admin"
                                    className="flex items-center gap-3 mx-2 my-1 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-all group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <LayoutDashboard className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold uppercase tracking-wider">Admin Dashboard</span>
                                </Link>
                            )}
                            <WalletDropdownDisconnect />
                        </WalletDropdown>
                    </OnchainWallet>
                </div>
            </div>
        </nav >
    );
}
