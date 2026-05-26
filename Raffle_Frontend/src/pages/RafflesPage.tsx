import { useState } from 'react';
import { useRaffleList } from '../features/raffle/hooks/useRaffleQueries';
import { GaslessBadge } from '../components/GaslessBadge';
import { SwapModal } from '../components/SwapModal';
import { RaffleWinnersSection } from '../components/home/RaffleWinnersSection';
import { RaffleRow } from '../features/raffle/components/RaffleRow';
import { Gift, Loader2, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

export function RafflesPage() {
  const [filter, setFilter] = useState('all');
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const { raffleIds, isLoading, refetch } = useRaffleList();

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden pb-28 md:pb-8">
      <div className="max-w-screen-lg mx-auto">
        {/* Midnight Cyber Header */}
        <div className="card-title-row mb-6">
          <h2 className="text-xl text-white" style={{ fontFamily: 'var(--typography-family-heading)' }}>On-Chain Raffles</h2>
          <span className="badge-cyber badge-cyber-blue">VRF Provably Fair</span>
        </div>

        <div className="flex justify-between items-end mb-6">
          <div>
            <span className="badge-cyber badge-cyber-green mb-2 inline-block">
              <i className="fa-solid fa-gas-pump mr-1"></i>
              <GaslessBadge />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSwapOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 label-native hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
            >
              GET USDC
            </button>
            <Link to="/create-raffle" className="p-2 rounded-full bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 active:scale-95 transition-transform">
              <Gift size={20} />
            </Link>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 mb-6">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full label-native transition-all border ${filter === f ? 'bg-white text-black border-white shadow-lg' : 'text-slate-500 border-white/10 hover:border-white/30'}`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Raffle Feed */}
        <div className="divide-y divide-white/5 md:divide-y-0 grid grid-cols-1 md:grid-cols-2 md:gap-4 md:px-4">
          {isLoading ? (
            <div className="py-20 text-center col-span-full">
              <Loader2 className="w-8 h-8 text-slate-700 mx-auto animate-spin mb-2" />
              <p className="label-native text-slate-500">LOADING RAFFLES...</p>
            </div>
          ) : !raffleIds || raffleIds.length === 0 ? (
            <div className="py-20 text-center col-span-full">
              <Ticket className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="label-native text-slate-500">NO ACTIVE RAFFLES</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 label-native text-slate-400 hover:bg-white/10 transition-all"
              >
                RETRY
              </button>
            </div>
          ) : (
            <>
              {[...raffleIds].reverse().map((id) => (
                <RaffleRow key={id.toString()} raffleId={id} filter={filter} />
              ))}
            </>
          )}
        </div>

        {/* Hall of Fame / Past Winners Section */}
        <div className="px-4">
          <RaffleWinnersSection />
        </div>
      </div>
      <SwapModal isOpen={isSwapOpen} onClose={() => setIsSwapOpen(false)} />
    </div>
  );
}