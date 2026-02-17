import { useState } from 'react';
import { Trophy, Ticket, ArrowRight, Timer, RefreshCw, Zap, Gift, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useRaffleList, useRaffleInfo, useRaffle } from '../hooks/useRaffle';
import toast from 'react-hot-toast';

function RaffleRow({ raffleId }) {
  const { address } = useAccount();
  const { raffle, isLoading } = useRaffleInfo(raffleId);
  const { buyTickets, claimPrize } = useRaffle();
  const [isProcessing, setIsProcessing] = useState(false);

  if (isLoading || !raffle) return null;

  const isWinner = raffle.winners?.some(w => w.toLowerCase() === address?.toLowerCase());
  const isFinalized = raffle.isFinalized;
  const timeLeft = raffle.endTime > Date.now() / 1000
    ? Math.max(0, Math.floor((raffle.endTime - Date.now() / 1000) / 60)) + "m left"
    : "Ended";

  const handleAction = async (e) => {
    e.stopPropagation();
    setIsProcessing(true);
    const tid = toast.loading(isFinalized ? "Claiming prize..." : "Processing purchase...");
    try {
      if (isFinalized) {
        await claimPrize(raffleId);
        toast.success("Prize claimed!", { id: tid });
      } else {
        await buyTickets(raffleId, 1);
        toast.success("Ticket purchased!", { id: tid });
      }
    } catch (e) {
      toast.error(e.shortMessage || "Action failed", { id: tid });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentTickets = Number(raffle.totalTickets || 0);
  const maxTickets = Number(raffle.maxTickets || 100);
  const progress = Math.min((currentTickets / maxTickets) * 100, 100);

  return (
    <div className="flex flex-col p-4 border-b-subtle active:bg-white/5 transition-colors">
      {/* Header Row */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <Trophy size={20} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-white leading-tight">
              {raffle.metadataURI?.includes('ipfs') ? "Community Prize" : `Elite Raffle #${raffle.id}`}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${raffle.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                {raffle.isActive ? 'LIVE' : 'CLOSED'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Entry: 0.01 ETH
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1 text-xs font-mono text-slate-400 justify-end">
            <Timer size={10} /> {isFinalized ? "Finalized" : timeLeft}
          </div>
        </div>
      </div>

      {/* Progress Bar (Subtle) */}
      <div className="mt-2 mb-3">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Tickets Sold</span>
          <span>{currentTickets}/{maxTickets}</span>
        </div>
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${isFinalized ? 'bg-slate-600' : 'bg-indigo-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Action Button (Full Width on Mobile) */}
      {isWinner && isFinalized ? (
        <button
          onClick={handleAction}
          disabled={isProcessing}
          className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Gift size={16} />}
          Claim Prize
        </button>
      ) : (
        <button
          onClick={handleAction}
          disabled={isProcessing || isFinalized || !raffle.isActive}
          className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform ${isFinalized || !raffle.isActive ? 'bg-slate-800 text-slate-500' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Ticket size={16} />}
          {isFinalized ? 'Results Out' : 'Buy Ticket'}
        </button>
      )}
    </div>
  );
}

export function RafflesPage() {
  const [filter, setFilter] = useState('all');
  const { raffleIds } = useRaffleList();

  return (
    <div className="min-h-screen bg-[#0B0E14] pb-24 pt-safe">
      {/* Header */}
      <div className="px-4 py-6 border-b-subtle">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-2xl font-black text-white mb-1">NFT Raffles</h1>
            <p className="text-slate-500 text-sm">Win exclusive prizes.</p>
          </div>
          <Link to="/create-raffle" className="p-2 rounded-full bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 active:scale-95 transition-transform">
            <Gift size={20} />
          </Link>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${filter === f ? 'bg-white text-black border-white' : 'text-slate-500 border-white/10 hover:border-white/30'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Raffle Feed */}
      <div className="divide-y divide-white/5">
        {!raffleIds || raffleIds.length === 0 ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-slate-700 mx-auto animate-spin mb-2" />
            <p className="text-sm text-slate-500">Syncing Raffles...</p>
          </div>
        ) : (
          <div>
            {[...raffleIds].reverse().map((id) => (
              <RaffleRow key={id.toString()} raffleId={id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
