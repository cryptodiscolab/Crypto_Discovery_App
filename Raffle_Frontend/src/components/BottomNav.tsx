import React, { useMemo } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Home, Zap, Ticket, Trophy, ShieldAlert, Wallet, LayoutDashboard, Loader2, RefreshCw } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';

const MASTER_ADMIN = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

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
        { path: '/', label: 'Home', icon: <Home className="w-6 h-6" /> },
        { path: '/tasks', label: 'Tasks', icon: <Zap className="w-6 h-6" /> },
        { path: '/raffles', label: 'Raffles', icon: <Ticket className="w-6 h-6" /> },
        { path: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="w-6 h-6" /> },
    ];

    const gridCols = isAdmin ? 'grid-cols-6' : 'grid-cols-5';

    return (
        <nav className="fixed bottom-0 left-0 right-0 w-full z-[9999] pointer-events-auto bg-black/95 backdrop-blur-lg border-t border-white/5 pb-8 pt-4 px-2 shadow-2xl md:hidden">
            <div className={`grid ${gridCols} w-full items-center justify-items-center`}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex flex-col items-center transition-all duration-300 ${isActive ? 'text-pink-500 scale-125' : 'text-slate-500 hover:text-white'
                            }`
                        }
                    >
                        {item.icon}
                    </NavLink>
                ))}

                {/* Admin Hub Link (Visible to all admins) */}
                {isAdmin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                            `flex flex-col items-center transition-all duration-300 ${isActive ? 'text-indigo-400 scale-125' : 'text-slate-500 hover:text-white'
                            }`
                        }
                    >
                        <ShieldAlert className="w-6 h-6 text-indigo-500" />
                    </NavLink>
                )}

                {/* Wallet Section (Icon Only - Forced Render) */}
                <div className="flex flex-col items-center relative z-[9999] pointer-events-auto cursor-pointer">
                    {isConnected ? (
                        <Link
                            to="/profile"
                            className={`flex flex-col items-center transition-all duration-300 ${location.pathname.startsWith('/profile') ? 'text-indigo-400 scale-125' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <div className="relative">
                                <Wallet className="w-6 h-6" />
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-black" />
                            </div>
                        </Link>
                    ) : (
                        <Link
                            to="/login"
                            className={`flex flex-col items-center transition-all duration-300 ${location.pathname === '/login' ? 'text-pink-500 scale-125' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <div className="p-2 bg-pink-500/10 rounded-lg group-hover:bg-pink-500/20 transition-colors">
                                <Wallet className={`w-6 h-6 ${location.pathname === '/login' ? 'text-pink-500' : 'text-slate-400'}`} />
                            </div>
                        </Link>
                    )}
                </div>
            </div>
        </nav >
    );
}
