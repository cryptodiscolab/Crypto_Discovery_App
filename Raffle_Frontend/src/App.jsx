import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './Web3Provider';
import { Header } from './Header';
import { BottomNav } from './components/BottomNav';
import { PointsProvider } from './shared/context/PointsContext';

import { Suspense, lazy, useEffect } from 'react';
import { useAccount } from 'wagmi';

// Lazy Load Pages
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const RafflesPage = lazy(() => import('./pages/RafflesPage').then(m => ({ default: m.RafflesPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const CreateRafflePage = lazy(() => import('./pages/CreateRafflePage').then(m => ({ default: m.CreateRafflePage })));
const TasksPage = lazy(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const AdminPanel = lazy(() => import('./AdminPanel'));
const AdminDashboard = lazy(() => import('./pages/admin/dashboard.jsx'));
const AdminGuard = lazy(() => import('./components/admin/AdminGuard.jsx'));
const SignatureGuard = lazy(() => import('./components/SignatureGuard.jsx').then(m => ({ default: m.SignatureGuard })));

function App() {
  return (
    <Web3Provider>
      <PointsProvider>
        <BrowserRouter>
          <div className="dark min-h-screen bg-[#0B0E14] text-slate-100">
            <Header />
            <SignatureGuard>
              <main className="pt-24 pb-32 md:pb-0">
                <Suspense fallback={
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="w-10 h-10 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                  </div>
                }>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/tasks" element={<TasksPage />} />
                    <Route path="/raffles" element={<RafflesPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/profile/:userAddress" element={<ProfilePage />} />
                    <Route
                      path="/admin"
                      element={
                        <AdminGuard>
                          <AdminDashboard />
                        </AdminGuard>
                      }
                    />
                    <Route
                      path="/admin/legacy"
                      element={
                        <AdminGuard>
                          <AdminPage />
                        </AdminGuard>
                      }
                    />
                    <Route
                      path="/admin-sbt"
                      element={
                        <AdminGuard>
                          <AdminPanel />
                        </AdminGuard>
                      }
                    />
                    <Route
                      path="/create"
                      element={
                        <AdminGuard>
                          <CreateRafflePage />
                        </AdminGuard>
                      }
                    />
                  </Routes>
                </Suspense>
              </main>
            </SignatureGuard>

            <BottomNav />

            <Toaster
              position="bottom-right"
              toastOptions={{
                style: { background: '#161B22', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
              }}
            />
          </div>
        </BrowserRouter>
      </PointsProvider>
    </Web3Provider>
  );
}

export default App;
