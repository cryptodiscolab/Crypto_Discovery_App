import { Web3Provider } from './Web3Provider';

function App() {
  return (
    <Web3Provider>
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <h1 className="text-4xl font-bold text-green-500">✅ SYSTEM CHECK</h1>
        <p className="mt-4 text-xl">Provider Loaded Successfully.</p>
        <p className="text-gray-500 mt-2">Kalau lu liat ini, berarti error #31 udah ilang.</p>
      </div>
    </Web3Provider>
  );
}

export default App;
