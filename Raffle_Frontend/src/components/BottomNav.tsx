import React, { useMemo } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Home, Zap, Ticket, Trophy, ShieldAlert, Wallet, LayoutDashboard, Loader2, RefreshCw } from 'lucide-react';
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
    const { address, isConnected, isConnecting, isReconnecting } = useAccount();
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

                {/* Admin Hub Link (Visible to all admins) */}
                {isAdmin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-white'
                            }`
                        }
                    >
                        <ShieldAlert className="w-5 h-5 text-indigo-500" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">Admin</span>
                    </NavLink>
                )}

                {/* Wallet Section (Icon Only - Forced Render) */}
                <div className="flex flex-col items-center gap-1 relative z-[9999] pointer-events-auto">
                    <OnchainWallet>
                        {projectId ? (
                            <ConnectWallet
                                className="!bg-white/10 !rounded-full !min-w-[44px] !min-h-[44px] !p-0 flex items-center justify-center !transition-all !opacity-100 !visible relative overflow-hidden"
                            >
                                <div className="absolute inset-0 flex items-center justify-center z-[9999] pointer-events-none">
                                    {isConnecting || isReconnecting ? (
                                        <Loader2 className="!w-7 !h-7 !text-white animate-spin !opacity-100 !visible" />
                                    ) : (
                                        <div className="relative min-w-[44px] min-h-[44px] flex items-center justify-center">
                                            {/* Baseline Wallet Icon - Forced Indigo Fallback */}
                                            <Wallet className="!w-7 !h-7 !text-indigo-400 !opacity-100 !visible !block z-[9998] absolute" />

                                            {/* Avatar renders on top ONLY if connected and data exists */}
                                            {isConnected && (
                                                <Avatar address={address} className="h-8 w-8 !flex !opacity-100 !visible z-[9999] relative border-2 border-indigo-400/50" />
                                            )}

                                            {!isConnected && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.location.reload();
                                                    }}
                                                    className="absolute -top-1 -right-4 p-1 bg-indigo-500 rounded-full hover:rotate-180 transition-transform duration-500 shadow-lg pointer-events-auto z-[10000]"
                                                    title="Refresh Connection"
                                                >
                                                    <RefreshCw className="w-2 h-2 text-white" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </ConnectWallet>
                        ) : null}
                        <WalletDropdown className="bottom-full mb-4 bg-slate-900 border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
                            <Identity className="px-4 pt-4 pb-3 bg-gradient-to-b from-indigo-500/10 to-transparent" hasCopyAddressOnClick>
                                <div className="flex items-center gap-3 mb-2">
                                    <Avatar className="h-10 w-10 border-2 border-indigo-400 shadow-indigo-500/20 shadow-lg" />
                                    <div className="flex flex-col">
                                        <Name className="!text-white !font-bold !text-lg !opacity-100" />
                                        <Address className="!text-slate-400 !text-xs" />
                                    </div>
                                </div>
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
