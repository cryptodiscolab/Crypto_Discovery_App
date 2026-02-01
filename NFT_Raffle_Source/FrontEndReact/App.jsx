import { Web3Provider } from './Web3Provider';

function App() {
  return (
    <Web3Provider>
      <div className="min-h-screen bg-black text-green-500 flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-4">✅ SYSTEM CHECK</h1>
        <p className="text-white text-xl text-center">
          Kalau lu bisa baca ini, berarti Web3Provider AMAN.<br />
          Masalahnya ada di Header.jsx atau HomePage.jsx!
        </p>
      </div>
    </Web3Provider>
  );
}

export default App;
