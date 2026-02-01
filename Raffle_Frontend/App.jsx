import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './Web3Provider';
import { Header } from './Header'; // Adjusted from ./components/Header to match project structure

// Kita buat halaman sementara buat gantiin HomePage
function TempHome() {
  return (
    <div className="pt-20 flex flex-col items-center justify-center min-h-screen text-white text-center px-4">
      <h1 className="text-5xl font-bold mb-4">🚀 Header Berhasil!</h1>
      <p className="text-xl text-slate-400">
        Navigasi udah muncul. Provider udah stabil.<br />
        Langkah terakhir nanti tinggal balikin HomePage asli.
      </p>
    </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 selection:bg-blue-500/30">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<TempHome />} />
            </Routes>
          </main>
          <Toaster position="bottom-right" />
        </div>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
