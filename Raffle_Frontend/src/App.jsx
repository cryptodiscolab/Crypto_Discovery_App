import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './Web3Provider';
import { Header } from './Header';
import { PointsProvider } from './shared/context/PointsContext';

// Import Pages
import { HomePage } from './pages/HomePage';
import { RafflesPage } from './pages/RafflesPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { CreateRafflePage } from './pages/CreateRafflePage';
import { TasksPage } from './pages/TasksPage';
import { AdminPage } from './pages/AdminPage';
import AdminPanel from './AdminPanel';

function App() {
  return (
    <Web3Provider>
      <PointsProvider>
        <BrowserRouter>
          <div className="dark min-h-screen bg-[#0B0E14] text-slate-100">
            <Header />
            <main className="pt-24">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/raffles" element={<RafflesPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/create" element={<CreateRafflePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin-sbt" element={<AdminPanel />} />
              </Routes>
            </main>

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
