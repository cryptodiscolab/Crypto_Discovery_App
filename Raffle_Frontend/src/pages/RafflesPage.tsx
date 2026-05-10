import { useState, useMemo } from 'react';
import { Trophy, Ticket, ArrowRight, Timer, RefreshCw, Zap, Gift, ExternalLink, Loader2, Share2, Clock, Hash, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRaffleList } from '../features/raffle/hooks/useRaffleQueries';
import { GaslessBadge } from '../components/GaslessBadge';
import { SwapModal } from '../components/SwapModal';
import { RaffleWinnersSection } from '../components/home/RaffleWinnersSection';
import { RaffleRow } from '../features/raffle/components/RaffleRow';
export function RafflesPage() {
  const [filter, setFilter] = useState('all');
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const { raffleIds } = useRaffleList();

  // Filter is applied via the RaffleRow's raffle data — we pass the active filter down
  // For accurate filtering we filter inside RaffleRow using raffle.isActive / isFinalized.
  // Here we just pass the filter prop so each row can hide itself.

  return (
    <div className="min-h-screen bg-[#050505] pb-28 md:pb-8 pt-safe">
      <div className="max-w-screen-lg mx-auto">
        {/* Header */}
        <div className="px-4 py-6 border-b border-white/5">
          <div className="flex justify-between items-end mb-6">
            <div>
                <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter italic leading-none">NFT RAFFLES</h1>
                <div className="flex items-center gap-3">
                  <p className="label-native !mb-0 !text-slate-600">WIN EXCLUSIVE PRIZES.</p>
                  <GaslessBadge />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsSwapOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 label-native hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                >
                  GET USDC
                </button>
                <Link to="/create-raffle" className="p-2 rounded-full bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 active:scale-95 transition-transform">
                  <Gift size={20} />
                </Link>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2">
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
        </div>

        {/* Raffle Feed */}
        <div className="divide-y divide-white/5 md:divide-y-0 grid grid-cols-1 md:grid-cols-2 md:gap-4 md:px-4">
          {!raffleIds || raffleIds.length === 0 ? (
            <div className="py-20 text-center col-span-full">
              <RefreshCw className="w-8 h-8 text-slate-700 mx-auto animate-spin mb-2" />
              <p className="label-native text-slate-500">SYNCING RAFFLES...</p>
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
