import React, { useMemo } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Home, Zap, Ticket, Trophy, ShieldAlert, Wallet, Megaphone } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';

const MASTER_ADMIN = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();

export function BottomNav() {
    const { address, isConnected } = useAccount();
    const { isAdmin: isCMSAdmin } = useCMS();
    const location = useLocation();

    const isAdmin = useMemo(() => {
        // First check CMS (Chain/DB/Env)
        if (isCMSAdmin) return true;

        if (!address) return false;
        const currentAddr = address.toLowerCase();

        // Master Admin Bypass (Hardcoded fallback)
        if (currentAddr === MASTER_ADMIN) return true;

        return false;
    }, [address, isCMSAdmin]);

    const navItems = [
        { path: '/', label: 'Home', icon: <Home className="w-5 h-5" /> },
        { path: '/tasks', label: 'Tasks', icon: <Zap className="w-5 h-5" /> },
        { path: '/campaigns', label: 'Offer', icon: <Megaphone className="w-5 h-5" /> },
        { path: '/raffles', label: 'Raffles', icon: <Ticket className="w-5 h-5" /> },
        { path: '/leaderboard', label: 'Rank', icon: <Trophy className="w-5 h-5" /> },
    ];

    const gridCols = isAdmin ? 'grid-cols-7' : 'grid-cols-6';

    return (
        <nav className="fixed bottom-0 left-0 right-0 w-full z-[9999] pointer-events-auto bg-[#0B0E14]/90 backdrop-blur-xl border-t border-white/5 pb-safe pt-2 px-2 shadow-2xl md:hidden">
            <div className={`grid ${gridCols} w-full items-end justify-items-center h-[60px] pb-2`}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 relative group ${isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {/* Active Glow Background */}
                                {isActive && (
                                    <div className="absolute top-0 w-8 h-8 rounded-full bg-indigo-500/10 blur-md -z-10" />
                                )}

                                <div className={`relative transition-transform duration-200 ${isActive ? '-translate-y-0.5' : ''}`}>
                                    {item.icon}
                                    {/* Active Dot Indicator */}
                                    {isActive && (
                                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                                    )}
                                </div>
                                <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                                    {item.label}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}

                {/* Admin Hub Link (Visible to all admins) */}
                {isAdmin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 relative ${isActive ? 'text-pink-400' : 'text-slate-500 hover:text-slate-300'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className={`relative transition-transform duration-200 ${isActive ? '-translate-y-0.5' : ''}`}>
                                    <ShieldAlert className="w-5 h-5" />
                                    {isActive && (
                                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-400 rounded-full shadow-[0_0_8px_rgba(244,114,182,0.8)]" />
                                    )}
                                </div>
                                <span className="text-[10px] font-medium tracking-wide">Admin</span>
                            </>
                        )}
                    </NavLink>
                )}

                {/* Wallet Section */}
                <div className="flex flex-col items-center justify-center w-full h-full pb-1 relative z-[9999]">
                    {isConnected ? (
                        <Link
                            to="/profile"
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 ${location.pathname.startsWith('/profile') ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <div className={`relative transition-transform duration-200 ${location.pathname.startsWith('/profile') ? '-translate-y-0.5' : ''}`}>
                                <Wallet className="w-5 h-5" />
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#0B0E14]" />
                                {location.pathname.startsWith('/profile') && (
                                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                )}
                            </div>
                            <span className="text-[10px] font-medium tracking-wide">Profile</span>
                        </Link>
                    ) : (
                        <Link
                            to="/login"
                            className={`flex flex-col items-center justify-center transition-all duration-200 group ${location.pathname === '/login' ? 'text-pink-500' : 'text-slate-400'
                                }`}
                        >
                            <div className="p-2 bg-white/5 rounded-xl border border-white/5 group-hover:bg-white/10 transition-colors">
                                <Wallet className={`w-5 h-5 ${location.pathname === '/login' ? 'text-pink-500' : 'text-slate-300'}`} />
                            </div>
                        </Link>
                    )}
                </div>
            </div>
        </nav >
    );
}
