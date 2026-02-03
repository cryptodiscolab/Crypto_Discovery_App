import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './Web3Provider';
import { Header } from './Header'; // Adjusted path to match project structure
import { PointsProvider } from './shared/context/PointsContext';

// Import Halaman-Halaman
import { HomePage } from './pages/HomePage';
import { RafflesPage } from './pages/RafflesPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { CreateRafflePage } from './pages/CreateRafflePage';
import { TasksPage } from './pages/TasksPage';

function App() {
  return (
    <Web3Provider>
      <PointsProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-slate-950 selection:bg-blue-500/30">
            <Header />
            <main>
              <Routes>
                {/* Daftar Rute Aplikasi */}
                <Route path="/" element={<HomePage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/raffles" element={<RafflesPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/create" element={<CreateRafflePage />} />
              </Routes>
            </main>

            <Toaster
              position="bottom-right"
              toastOptions={{
                style: { background: '#1e293b', color: '#fff' },
              }}
            />
          </div>
        </BrowserRouter>
      </PointsProvider>
    </Web3Provider>
  );
}

export default App;
