import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import sdk from '@farcaster/miniapp-sdk';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './Web3Provider';
import { Header } from './Header';
import { HomePage } from './HomePage';
import { RafflesPage } from './RafflesPage';
import { LeaderboardPage } from './LeaderboardPage';
import { ProfilePage } from './ProfilePage';
import { CreateRafflePage } from './CreateRafflePage';

function App() {
  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
      } catch (err) {
        console.error('Error initializing Farcaster SDK:', err);
      }
    };
    init();
  }, []);

  return (
    <Web3Provider>
      <BrowserRouter>
        <div className="min-h-screen">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/raffles" element={<RafflesPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/create" element={<CreateRafflePage />} />
            </Routes>
          </main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#fff',
                borderRadius: '12px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </div>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
