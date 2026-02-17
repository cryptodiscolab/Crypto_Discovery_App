import { useState } from 'react';
import { Trophy, Users, Timer, Ticket, ArrowRight, Shield, AlertCircle, RefreshCw, Zap, TrendingUp, Calendar, ExternalLink, Loader2, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { useRaffleList, useRaffleInfo, useRaffle } from '../hooks/useRaffle';
import toast from 'react-hot-toast';

function RaffleCard({ raffleId }) {
  const { address } = useAccount();
  const { raffle, isLoading } = useRaffleInfo(raffleId);
  const { buyTickets, claimPrize } = useRaffle();
  const [isProcessing, setIsProcessing] = useState(false);

  if (isLoading || !raffle) {
    return (
      <div className="glass-card h-80 animate-pulse bg-white/5 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const isWinner = raffle.winners?.some(w => w.toLowerCase() === address?.toLowerCase());
  const isFinalized = raffle.isFinalized;

  // Hide completed or inactive raffles if needed, but let's show all for now
  const timeLeft = raffle.endTime > Date.now() / 1000
    ? Math.max(0, Math.floor((raffle.endTime - Date.now() / 1000) / 60)) + "m remaining"
    : "Ended";

  const handleAction = async () => {
    setIsProcessing(true);
    const tid = toast.loading(isFinalized ? "Claiming prize..." : "Processing purchase...");
    try {
      if (isFinalized) {
        await claimPrize(raffleId);
        toast.success("Prize claimed! Check your wallet.", { id: tid });
      } else {
        await buyTickets(raffleId, 1);
        toast.success("Ticket purchased! Good luck!", { id: tid });
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
    <div
      className="glass-card overflow-hidden group hover:border-blue-500/30 transition-all duration-300 animate-slide-up"
    >
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-indigo-900/40 to-slate-900 flex items-center justify-center">
        {/* NFT Placeholder or Image */}
        <div className="text-center px-4">
          <Trophy className="w-16 h-16 text-indigo-500/20 mx-auto" />
          <h4 className="text-white font-bold mt-2 truncate max-w-[200px]">
            {raffle.metadataURI?.includes('ipfs') ? "Community Prize" : `Elite Raffle #${raffle.id}`}
          </h4>
          <p className="text-[10px] text-slate-500 font-mono mt-1">PROUDLY SPONSORED</p>
        </div>

        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10 flex items-center gap-1">
          <Timer className="w-3 h-3 text-yellow-400" />
          {isFinalized ? "Finalized" : timeLeft}
        </div>

        {isFinalized && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
            <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
              {isWinner ? "YOU WON!" : "Ended"}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-white leading-tight truncate pr-2">Event #{raffle.id}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${raffle.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
            {raffle.isActive ? 'LIVE' : 'CLOSED'}
          </span>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <Ticket className="w-4 h-4" /> Participation
            </span>
            <span className="text-white font-medium">
              {currentTickets} / {maxTickets}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${isFinalized ? 'from-slate-600 to-slate-500' : 'from-blue-500 to-emerald-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <div className="text-sm">
            <p className="text-slate-400 font-mono uppercase text-[9px]">Entry Price</p>
            <p className="text-lg font-black text-blue-400">0.01 <span className="text-xs text-slate-500">ETH</span></p>
          </div>

          {isWinner && isFinalized ? (
            <button
              onClick={handleAction}
              disabled={isProcessing}
              className="btn-primary px-6 py-2 text-sm flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 animate-bounce"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              Claim Prize
            </button>
          ) : (
            <button
              onClick={handleAction}
              disabled={isProcessing || isFinalized || !raffle.isActive}
              className={`btn-primary px-6 py-2 text-sm flex items-center gap-2 ${(isFinalized || !raffle.isActive) ? 'grayscale opacity-50' : ''}`}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {isFinalized ? 'Results Out' : 'Join Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RafflesPage() {
  const [filter, setFilter] = useState('all');
  const { raffleIds, count } = useRaffleList();

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">NFT <span className="text-blue-500">Raffles</span></h1>
            <p className="text-slate-500 font-medium max-w-md">Participate in community raffles or sponsor your own event to grow your project.</p>

            <Link to="/create-raffle" className="inline-flex items-center gap-2 mt-4 text-blue-400 hover:text-blue-300 font-bold transition-all group">
              <Gift className="w-5 h-5" />
              Sponsor an Event
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="flex gap-2 bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 shadow-2xl">
            {['all', 'active', 'completed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Raffles */}
        {!raffleIds || raffleIds.length === 0 ? (
          <div className="py-20 text-center glass-card">
            {/* Gue ganti animate-spin-slow jadi animate-spin biar aman di Vercel */}
            <RefreshCw className="w-12 h-12 text-slate-700 mx-auto mb-4 animate-spin" />
            <h3 className="text-2xl font-bold text-white mb-2">Syncing Data...</h3>
            <p className="text-slate-500 italic">Reading the latest raffles from the blockchain.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Sisanya aman */}
            {[...raffleIds].reverse().map((id) => (
              <RaffleCard
                key={id.toString()} // Pake toString() biar ID dari BigInt nggak bikin error
                raffleId={id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
