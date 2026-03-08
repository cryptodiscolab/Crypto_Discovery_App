import React, { useMemo } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Home, Zap, Ticket, Trophy, ShieldAlert, Wallet, Megaphone } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';



export function BottomNav() {
    const { address, isConnected } = useAccount();
    const { isAdmin: isCMSAdmin } = useCMS();
    const location = useLocation();

    const isAdmin = isCMSAdmin;

    // Core nav items — max 5 untuk menghindari cramped layout di mobile
    const navItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/tasks', label: 'Tasks', icon: Zap },
        { path: '/campaigns', label: 'Offers', icon: Megaphone },
        { path: '/raffles', label: 'Raffles', icon: Ticket },
        { path: '/leaderboard', label: 'Rank', icon: Trophy },
    ];

    // Hitung total kolom: navItems + wallet + (admin jika ada)
    const totalCols = navItems.length + 1 + (isAdmin ? 1 : 0);

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 w-full z-[9999] pointer-events-auto md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            {/* Backdrop: bg opacity + blur — tidak gunakan border atas berat */}
            <div className="bg-[#0B0E14]/95 backdrop-blur-2xl">
                <div
                    className="w-full h-[60px] max-w-screen-sm mx-auto"
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
                                    `flex flex-col items-center justify-center gap-1 w-full h-full transition-colors duration-150 ${isActive ? 'text-indigo-400' : 'text-zinc-500 active:text-zinc-300'}`
                                }
                            // Pastikan hit area tidak pernah lebih kecil dari 44px (h-[60px] sudah cover)
                            >
                                {({ isActive }) => (
                                    <>
                                        <div className="relative flex items-center justify-center">
                                            <Icon
                                                className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}
                                                strokeWidth={isActive ? 2.5 : 1.75}
                                            />
                                            {/* Active indicator dot */}
                                            {isActive && (
                                                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full" />
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`}>
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
                                `flex flex-col items-center justify-center gap-1 w-full h-full transition-colors duration-150 ${isActive ? 'text-amber-400' : 'text-zinc-500 active:text-zinc-300'}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <ShieldAlert
                                        className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}
                                        strokeWidth={isActive ? 2.5 : 1.75}
                                    />
                                    <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-amber-400' : 'text-zinc-500'}`}>
                                        Admin
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
                                className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors duration-150 ${location.pathname.startsWith('/profile') ? 'text-emerald-400' : 'text-zinc-500 active:text-zinc-300'}`}
                            >
                                <div className="relative flex items-center justify-center">
                                    <Wallet
                                        className={`w-5 h-5 transition-transform duration-150 ${location.pathname.startsWith('/profile') ? 'scale-110' : ''}`}
                                        strokeWidth={location.pathname.startsWith('/profile') ? 2.5 : 1.75}
                                    />
                                    {/* Green dot = connected indicator */}
                                    <div className="absolute -top-0.5 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    {location.pathname.startsWith('/profile') && (
                                        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
                                    )}
                                </div>
                                <span className={`text-[10px] font-medium leading-none ${location.pathname.startsWith('/profile') ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                    Profile
                                </span>
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors duration-150 ${location.pathname === '/login' ? 'text-indigo-400' : 'text-zinc-500 active:text-zinc-300'}`}
                            >
                                {/* Tanpa border box — cukup icon + label */}
                                <Wallet className="w-5 h-5" strokeWidth={1.75} />
                                <span className="text-[10px] font-medium leading-none">Login</span>
                            </Link>
                        )}
                    </div>

                </div>
            </div>
        </nav>
    );
}
