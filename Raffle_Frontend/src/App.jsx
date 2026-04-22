import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './Web3Provider';
import { Header } from './Header';
import { BottomNav } from './components/BottomNav';
import { PointsProvider } from './shared/context/PointsContext';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SkeletonLoader } from './components/SkeletonLoader';
import { ReferralTracker } from './components/ReferralTracker';

// Lazy Load Pages (Non-critical components)
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.default || m.HomePage })));
const RafflesPage = lazy(() => import('./pages/RafflesPage').then(m => ({ default: m.default || m.RafflesPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then(m => ({ default: m.default || m.LeaderboardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.default || m.ProfilePage })));
const CreateRafflePage = lazy(() => import('./pages/CreateRafflePage').then(m => ({ default: m.default || m.CreateRafflePage })));
const TasksPage = lazy(() => import('./pages/TasksPage').then(m => ({ default: m.default || m.TasksPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.default || m.AdminPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.default || m.LoginPage })));
const CreateMissionPage = lazy(() => import('./pages/CreateMissionPage').then(m => ({ default: m.default || m.CreateMissionPage })));
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage').then(m => ({ default: m.default || m.OAuthCallbackPage })));

const AdminDashboard = lazy(() => import('./pages/admin/dashboard.jsx').then(m => ({ default: m.default || m.AdminDashboard })));
const AdminGuard = lazy(() => import('./components/admin/AdminGuard.jsx').then(m => ({ default: m.default || m.AdminGuard })));
const SignatureGuard = lazy(() => import('./components/SignatureGuard.jsx').then(m => ({ default: m.default || m.SignatureGuard })));

const ProtectedLayout = () => (
  <SignatureGuard>
    <Outlet />
  </SignatureGuard>
);

import { FarcasterProvider, useFarcaster } from './shared/context/FarcasterContext';

import { useConnect, useAccount } from 'wagmi';

function DebugMockConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  
  // Only show in dev and when not connected
  if (import.meta.env.MODE !== 'development' || isConnected) return null;

  const mockConnector = connectors.find(c => c.id === 'mock');

  return (
    <button
      id="debug-mock-connect"
      onClick={() => {
        console.log('🚀 Debug: Connecting Mock Wallet...');
        connect({ connector: mockConnector });
      }}
      style={{
        position: 'fixed',
        bottom: '100px',
        right: '20px',
        zIndex: 99999,
        background: 'linear-gradient(135deg, #FF3D00 0%, #D50000 100%)',
        color: 'white',
        padding: '10px 16px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        border: '1px solid rgba(255,255,255,0.2)',
        cursor: 'pointer',
        boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      DEBUG: MOCK CONNECT
    </button>
  );
}

function AppContent() {
  const { isFrame, safeAreaInsets, client } = useFarcaster();

  // Dynamic padding based on Farcaster Safe Area Insets
  const safePaddingTop = isFrame ? (safeAreaInsets?.top || 0) : 0;
  const safePaddingBottom = isFrame ? (safeAreaInsets?.bottom || 0) : 0;

  // Sync theme with Farcaster
  const theme = client?.config?.theme === 'light' ? 'light' : 'dark';

  return (
    <BrowserRouter>
      <ReferralTracker />
      <DebugMockConnect />
      <div className={`${theme} min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col overflow-x-hidden w-full max-w-[100vw] relative`}>
        {!isFrame && <Header />}
        
        <main 
          className={`flex-1 ${!isFrame ? 'pt-16 pb-20 md:pb-6' : ''}`}
          style={isFrame ? { 
            paddingTop: `${safePaddingTop}px`,
            paddingBottom: `calc(58px + ${safePaddingBottom}px)` // Keep BottomNav space
          } : {
            paddingBottom: 'max(80px, calc(58px + env(safe-area-inset-bottom, 0px)))'
          }}
        >
          <ErrorBoundary>
            <Suspense fallback={
              <div className="min-h-[60vh] flex items-center justify-center">
                <SkeletonLoader />
              </div>
            }>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
                <Route path="/" element={<HomePage />} />
                <Route element={<ProtectedLayout />}>
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/raffles" element={<RafflesPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/:userAddress" element={<ProfilePage />} />
                  <Route path="/create-raffle" element={<CreateRafflePage />} />
                  <Route path="/create-mission" element={<CreateMissionPage />} />
                  <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        <BottomNav />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#161B22',
              color: '#e2e8f0',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }
          }}
        />
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <Web3Provider>
      <PointsProvider>
        <FarcasterProvider>
          <AppContent />
        </FarcasterProvider>
      </PointsProvider>
    </Web3Provider>
  );
}

export default App;

