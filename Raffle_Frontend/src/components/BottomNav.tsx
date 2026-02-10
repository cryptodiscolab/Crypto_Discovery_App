import React, { useMemo } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Home, Zap, Ticket, Trophy, ShieldAlert, Wallet, LayoutDashboard, Loader2, RefreshCw } from 'lucide-react';

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
                    {isConnected ? (
                        <Link
                            to="/profile"
                            className={`flex flex-col items-center gap-1 transition-all duration-300 ${location.pathname === '/profile' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <div className="relative">
                                <Wallet className="w-5 h-5" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-black" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Profile</span>
                        </Link>
                    ) : (
                        <Link
                            to="/login"
                            className={`flex flex-col items-center gap-1 transition-all duration-300 ${location.pathname === '/login' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <Wallet className="w-5 h-5" />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Connect</span>
                        </Link>
                    )}
                </div>
            </div>
        </nav >
    );
}
