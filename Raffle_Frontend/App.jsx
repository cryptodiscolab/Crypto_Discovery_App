import { useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './Web3Provider'; // Pastikan path ini benar

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
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-4">Tes Isolasi Error</h1>
        <p className="mb-4">Kalau tulisan ini muncul, berarti Web3Provider AMAN.</p>
        <div className="p-4 border border-green-500 rounded bg-green-900/20">
          Status: Provider Loaded
        </div>
      </div>
      <Toaster />
    </Web3Provider>
  );
}

export default App;
