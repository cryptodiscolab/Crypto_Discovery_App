import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './Web3Provider';
import { Header } from './Header'; // Adjusted path to match project structure
import { HomePage } from './HomePage'; // Adjusted path to match project structure

function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 selection:bg-blue-500/30">
          <Header />
          <main>
            <Routes>
              {/* Balikin HomePage sebagai route utama */}
              <Route path="/" element={<HomePage />} />
            </Routes>
          </main>
          <Toaster position="bottom-right" toastOptions={{
            style: {
              background: '#1e293b',
              color: '#fff',
            },
          }} />
        </div>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
