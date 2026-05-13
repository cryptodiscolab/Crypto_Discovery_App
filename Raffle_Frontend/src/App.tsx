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
import { RaffleWinBanner } from './components/RaffleWinBanner';

// Lazy Load Pages (Non-critical components)
const HomePage = lazy(async () => {
  const { HomePage } = await import('./pages/HomePage');
  return { default: HomePage };
});
const RafflesPage = lazy(async () => {
  const { RafflesPage } = await import('./pages/RafflesPage');
  return { default: RafflesPage };
});
const LeaderboardPage = lazy(async () => {
  const { LeaderboardPage } = await import('./pages/LeaderboardPage');
  return { default: LeaderboardPage };
});
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CreateRafflePage = lazy(async () => {
  const { CreateRafflePage } = await import('./pages/CreateRafflePage');
  return { default: CreateRafflePage };
});
const TasksPage = lazy(async () => {
  const { TasksPage } = await import('./pages/TasksPage');
  return { default: TasksPage };
});
const AdminPage = lazy(async () => {
  const { AdminPage } = await import('./pages/AdminPage');
  return { default: AdminPage };
});
const LoginPage = lazy(async () => {
  const { LoginPage } = await import('./pages/LoginPage');
  return { default: LoginPage };
});
const CreateMissionPage = lazy(async () => {
  const { CreateMissionPage } = await import('./pages/CreateMissionPage');
  return { default: CreateMissionPage };
});
const OAuthCallbackPage = lazy(async () => {
  const { OAuthCallbackPage } = await import('./pages/OAuthCallbackPage');
  return { default: OAuthCallbackPage };
});
const RaffleDetailPage = lazy(() => import('./pages/raffle/RaffleDetailPage'));

const AdminGuard = lazy(async () => {
  const { default: AdminGuard } = await import('./features/admin/components/AdminGuard');
  return { default: AdminGuard };
});
const SignatureGuard = lazy(async () => {
  const { SignatureGuard } = await import('./components/SignatureGuard');
  return { default: SignatureGuard };
});

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
        
        if (mockConnector) connect({ connector: mockConnector });
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
        {!isFrame && <RaffleWinBanner />}
        
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
                <Route path="/profile/:userAddress" element={<ProfilePage />} />
                <Route element={<ProtectedLayout />}>
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/raffles" element={<RafflesPage />} />
                  <Route path="/raffles/:id" element={<RaffleDetailPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/create-raffle" element={<CreateRafflePage />} />
                  <Route path="/create-mission" element={<CreateMissionPage />} />
                  <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
                </Route>
                <Route path="*" element={<div className="min-h-screen flex items-center justify-center"><div className="text-center"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">404 — PAGE NOT FOUND</p><a href="/" className="mt-4 inline-block text-indigo-400 text-[11px] font-black uppercase tracking-widest">RETURN HOME</a></div></div>} />
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

