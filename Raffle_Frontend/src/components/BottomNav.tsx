import { NavLink, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Home, Zap, Ticket, Images, LineChart, MoreHorizontal, X } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';
import { usePoints } from '../shared/context/PointsContext';
import { useFarcaster } from '../shared/context/FarcasterContext';

export function BottomNav() {
    const { isAdmin: isCMSAdmin, canEdit: canEditCMS } = useCMS();
    const { isAdmin: isSBTAdmin } = usePoints();
    const { isFrame, safeAreaInsets, client } = useFarcaster();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const isAdmin = useMemo(() => Boolean(isSBTAdmin || isCMSAdmin || canEditCMS), [isSBTAdmin, isCMSAdmin, canEditCMS]);
    const theme = client?.config?.theme || 'dark';
    const isLight = theme === 'light';

    // Core bottom nav items — max 6 including "More"
    const navItems = [
        { path: '/', label: 'HOME', icon: Home },
        { path: '/tasks', label: 'QUESTS', icon: Zap },
        { path: '/raffles', label: 'RAFFLE', icon: Ticket },
        { path: '/nft-gallery', label: 'GALLERY', icon: Images },
        { path: '/meteora', label: 'METEORA', icon: LineChart },
    ];

    // Total columns = navItems + More button
    const totalCols = navItems.length + 1;

    return (
        <>
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
                                                    className={`w-[20px] h-[20px] transition-all duration-150 ${isActive ? 'scale-110' : ''}`}
                                                    strokeWidth={isActive ? 2.5 : 1.75}
                                                />
                                                {isActive && (
                                                    <div className="w-4 h-0.5 bg-[#0052FF] rounded-full mx-auto mt-0.5" />
                                                )}
                                            </div>
                                            <span className={`text-[9px] font-black leading-none uppercase tracking-widest ${isActive ? 'text-[#0052FF]' : 'text-zinc-500'}`}>
                                                {item.label}
                                            </span>
                                        </>
                                    )}
                                </NavLink>
                            );
                        })}

                        {/* More Drawer Trigger */}
                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            type="button"
                            className={`flex flex-col items-center justify-center gap-[3px] w-full h-full transition-all duration-150 select-none touch-manipulation ${isDrawerOpen ? 'text-[#0052FF]' : 'text-zinc-600 active:text-zinc-300'}`}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                            <div className="relative flex items-center justify-center">
                                <MoreHorizontal
                                    className={`w-[20px] h-[20px] transition-all duration-150 ${isDrawerOpen ? 'scale-110' : ''}`}
                                    strokeWidth={isDrawerOpen ? 2.5 : 1.75}
                                />
                                {isDrawerOpen && (
                                    <div className="w-4 h-0.5 bg-[#0052FF] rounded-full mx-auto mt-0.5" />
                                )}
                            </div>
                            <span className={`text-[9px] font-black leading-none uppercase tracking-widest ${isDrawerOpen ? 'text-[#0052FF]' : 'text-zinc-500'}`}>
                                MORE
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile More Sliding Drawer Overlay */}
            <div className={`mobile-drawer-overlay ${isDrawerOpen ? 'active' : ''}`} onClick={() => setIsDrawerOpen(false)}>
                <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
                    <div className="drawer-header">
                        <span className="label-native">ADDITIONAL SECTIONS</span>
                        <button className="drawer-close" onClick={() => setIsDrawerOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>
                    <div className="drawer-menu">
                        <Link to="/ugc" onClick={() => setIsDrawerOpen(false)} className="drawer-menu-item">
                            <i className="fa-solid fa-rectangle-ad"></i>
                            <span>UGC Sponsor Hub</span>
                        </Link>
                        <Link to="/leaderboard" onClick={() => setIsDrawerOpen(false)} className="drawer-menu-item">
                            <i className="fa-solid fa-trophy"></i>
                            <span>Leaderboard Ranks</span>
                        </Link>
                        <Link to="/swap" onClick={() => setIsDrawerOpen(false)} className="drawer-menu-item">
                            <i className="fa-solid fa-rotate"></i>
                            <span>Swap & Bridge</span>
                        </Link>
                        <Link to="/sbt-mint" onClick={() => setIsDrawerOpen(false)} className="drawer-menu-item">
                            <i className="fa-solid fa-id-card"></i>
                            <span>SBT Identity Mint</span>
                        </Link>
                        {isAdmin && (
                            <Link to="/admin" onClick={() => setIsDrawerOpen(false)} className="drawer-menu-item">
                                <i className="fa-solid fa-user-gear"></i>
                                <span>Admin Control Panel</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
