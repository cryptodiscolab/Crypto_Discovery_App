import { useLocation, useNavigate } from 'react-router-dom';
import { usePoints } from '../shared/context/PointsContext';
import { useCMS } from '../hooks/useCMS';
import { useMemo } from 'react';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  isAdmin?: boolean;
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin: isSBTAdmin, gasTracker } = usePoints();
  const { isAdmin: isCMSAdmin, canEdit: canEditCMS } = useCMS();

  const isAdmin = useMemo(() => Boolean(isSBTAdmin || isCMSAdmin || canEditCMS), [isSBTAdmin, isCMSAdmin, canEditCMS]);

  const navItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/tasks', label: 'Tasks & Quests', icon: 'fa-list-check' },
    { path: '/raffles', label: 'Raffles & Gacha', icon: 'fa-ticket' },
    { path: '/nft-gallery', label: 'NFT Gallery', icon: 'fa-images' },
    { path: '/ugc', label: 'UGC Sponsor Hub', icon: 'fa-rectangle-ad' },
    { path: '/meteora', label: 'Meteora LP Cockpit', icon: 'fa-chart-line' },
    { path: '/swap', label: 'Swap & Bridge', icon: 'fa-rotate' },
    { path: '/leaderboard', label: 'Leaderboard', icon: 'fa-trophy' },
    { path: '/sbt-mint', label: 'SBT Mint', icon: 'fa-id-card' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', label: 'Admin Panel', icon: 'fa-user-gear', isAdmin: true });
  }

  const gasIndicator = useMemo(() => {
    if (!gasTracker || gasTracker.isLoadingGas || gasTracker.gasCategory === 'Unknown') return null;
    const cat = gasTracker.gasCategory;
    const colorMap: Record<string, string> = {
      'Cheap': '#10b981',
      'Normal': '#10b981',
      'High': '#f59e0b',
      'Very High': '#f97316',
      'Expensive': '#ef4444',
    };
    return { color: colorMap[cat] || '#10b981', category: cat };
  }, [gasTracker]);

  return (
    <aside className="sidebar-desktop">
      {/* Brand Section */}
      <div className="sidebar-brand">
        <div className="sidebar-logo-icon">D</div>
        <h1 className="sidebar-brand-title">DISCO LAB</h1>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 mt-8 flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              <span>{item.label}</span>
              {item.isAdmin && <i className="fa-solid fa-shield-halved text-amber-400/60 ml-auto text-[10px]"></i>}
            </button>
          );
        })}
      </nav>

      {/* Footer: Sentinel Status + Gas */}
      <div className="sidebar-footer">
        <div className="glass-card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--colors-brand-success)', boxShadow: '0 0 10px var(--colors-brand-success-glow)' }}></div>
          <span className="label-native" style={{ color: '#64748b' }}>
            {gasIndicator ? `${gasIndicator.category} GAS` : 'SENTINEL: ONLINE'}
          </span>
        </div>
      </div>
    </aside>
  );
}