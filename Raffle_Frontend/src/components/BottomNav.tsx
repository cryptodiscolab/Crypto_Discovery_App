import React from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Home, Zap, Ticket, Trophy, ShieldAlert, Wallet, Megaphone } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';
import { useFarcaster } from '../shared/context/FarcasterContext';

export function BottomNav() {
    const { address, isConnected } = useAccount();
    const { isAdmin: isCMSAdmin } = useCMS();
    const location = useLocation();
    const { isFrame, safeAreaInsets, client } = useFarcaster();

    const isAdmin = isCMSAdmin;
    const theme = client?.config?.theme || 'dark';
    const isLight = theme === 'light';

    // Core nav items — max 5 untuk menghindari cramped layout di mobile
    const navItems = [
        { path: '/', label: 'HOME', icon: Home },
        { path: '/tasks', label: 'TASKS', icon: Zap },
        { path: '/raffles', label: 'RAFFLES', icon: Ticket },
        { path: '/leaderboard', label: 'RANK', icon: Trophy },
    ];

    // Hitung total kolom: navItems + wallet + (admin jika ada)
    const totalCols = navItems.length + 1 + (isAdmin ? 1 : 0);

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 w-full z-[10000] pointer-events-auto md:hidden pb-safe"
            style={{ 
                paddingBottom: isFrame ? `${safeAreaInsets?.bottom || 0}px` : 'env(safe-area-inset-bottom, 0px)' 
            }}
        >
            {/* Top border separator — subtle */}
            <div className={`h-px w-full ${isLight ? 'bg-black/[0.06]' : 'bg-white/[0.06]'}`} />

            {/* Backdrop */}
            <div className={`${isLight ? 'bg-white/97 text-zinc-900 border-t border-black/5' : 'bg-[#050505]/95 text-slate-100 border-t border-white/5'} backdrop-blur-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)]`}>
                <div
                    className="w-full h-[62px] px-1"
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                >
                    {/* Core Nav Links */}
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center gap-[3px] w-full h-full transition-all duration-150 select-none touch-manipulation
                                     ${isActive ? 'text-[#0052FF]' : 'text-zinc-600 active:text-zinc-300'}`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <div className="relative flex items-center justify-center">
                                            <Icon
                                                className={`w-[22px] h-[22px] transition-all duration-150 ${isActive ? 'scale-110' : ''}`}
                                                strokeWidth={isActive ? 2.5 : 1.75}
                                            />
                                            {isActive && (
                                                <div className="w-4 h-0.5 bg-[#0052FF] rounded-full mx-auto mt-0.5" />
                                            )}
                                        </div>
                                        <span className={`text-[11px] font-black leading-none uppercase tracking-widest ${isActive ? 'text-[#0052FF]' : 'text-zinc-500'}`}>
                                            {item.label}
                                        </span>
                                    </>
                                )}
                            </NavLink>
                        );
                    })}

                    {/* Admin Link — hanya jika admin */}
                    {isAdmin && (
                        <NavLink
                            to="/admin"
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center gap-[3px] w-full h-full transition-all duration-150 select-none touch-manipulation ${isActive ? 'text-amber-400' : 'text-zinc-600 active:text-zinc-300'}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <div className="relative flex items-center justify-center">
                                        <ShieldAlert
                                            className={`w-[22px] h-[22px] transition-all duration-150 ${isActive ? 'scale-110' : ''}`}
                                            strokeWidth={isActive ? 2.5 : 1.75}
                                        />
                                        {isActive && (
                                            <div className="w-4 h-0.5 bg-amber-400 rounded-full mx-auto mt-0.5" />
                                        )}
                                    </div>
                                    <span className={`text-[11px] font-black leading-none uppercase tracking-widest ${isActive ? 'text-amber-400' : 'text-zinc-500'}`}>
                                        ADMIN
                                    </span>
                                </>
                            )}
                        </NavLink>
                    )}

                    {/* Wallet / Profile */}
                    <div className="flex items-center justify-center w-full h-full">
                        {isConnected ? (
                            <Link
                                to="/profile"
                                className={`flex flex-col items-center justify-center gap-[3px] w-full h-full transition-all duration-150 select-none touch-manipulation ${location.pathname.startsWith('/profile') ? 'text-emerald-400' : 'text-zinc-600 active:text-zinc-300'}`}
                            >
                                <div className="relative flex items-center justify-center">
                                    <Wallet
                                        className={`w-[22px] h-[22px] transition-all duration-150 ${location.pathname.startsWith('/profile') ? 'scale-110' : ''}`}
                                        strokeWidth={location.pathname.startsWith('/profile') ? 2.5 : 1.75}
                                    />
                                    {/* Green dot = connected indicator */}
                                    <div className="absolute -top-0.5 -right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-[#050505]" />
                                    {location.pathname.startsWith('/profile') && (
                                        <div className="w-4 h-0.5 bg-emerald-400 rounded-full mx-auto mt-0.5" />
                                    )}
                                </div>
                                <span className={`text-[11px] font-black leading-none uppercase tracking-widest ${location.pathname.startsWith('/profile') ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                    PROFILE
                                </span>
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className={`flex flex-col items-center justify-center gap-[3px] w-full h-full transition-all duration-150 select-none ${location.pathname === '/login' ? 'text-[#0052FF]' : 'text-zinc-600 active:text-zinc-300'}`}
                            >
                                <Wallet className="w-[22px] h-[22px]" strokeWidth={1.75} />
                                <span className="text-[11px] font-black leading-none uppercase tracking-widest text-zinc-500">LOGIN</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
