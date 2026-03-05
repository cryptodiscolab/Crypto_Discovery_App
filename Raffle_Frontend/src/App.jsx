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
const CampaignsPage = lazy(() => import('./pages/CampaignsPage').then(m => ({ default: m.default || m.CampaignsPage })));

const AdminDashboard = lazy(() => import('./pages/admin/dashboard.jsx').then(m => ({ default: m.default || m.AdminDashboard })));
const AdminGuard = lazy(() => import('./components/admin/AdminGuard.jsx').then(m => ({ default: m.default || m.AdminGuard })));
const SignatureGuard = lazy(() => import('./components/SignatureGuard.jsx').then(m => ({ default: m.default || m.SignatureGuard })));

const ProtectedLayout = () => (
  <SignatureGuard>
    <Outlet />
  </SignatureGuard>
);

import { FarcasterProvider } from './shared/context/FarcasterContext';

function App() {
  return (
    <Web3Provider>
      <PointsProvider>
        <FarcasterProvider>
          <BrowserRouter>
            <ReferralTracker />
            {/* Root wrapper: pointer-events-auto required — never set to none here */}
            <div className="dark min-h-screen bg-[#0B0E14] text-slate-100">
              <Header />
              {/* pt-16 = Header height (h-16). pb-20 = BottomNav safe area on mobile. md:pb-0 = no BottomNav on desktop */}
              <main className="pt-16 pb-20 md:pb-6 min-h-screen">
                <ErrorBoundary>
                  <Suspense fallback={
                    <div className="min-h-[60vh] flex items-center justify-center">
                      <SkeletonLoader />
                    </div>
                  }>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route element={<ProtectedLayout />}>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/tasks" element={<TasksPage />} />
                        <Route path="/raffles" element={<RafflesPage />} />
                        <Route path="/leaderboard" element={<LeaderboardPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/profile/:userAddress" element={<ProfilePage />} />
                        <Route path="/campaigns" element={<CampaignsPage />} />
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
                    fontSize: '13px',
                    fontWeight: 600,
                  }
                }}
              />
            </div>
          </BrowserRouter>
        </FarcasterProvider>
      </PointsProvider>
    </Web3Provider>
  );
}

export default App;

