import { useState, useMemo } from 'react';
import { Trophy, Ticket, ArrowRight, Timer, RefreshCw, Zap, Gift, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useRaffleList, useRaffleInfo, useRaffle } from '../hooks/useRaffle';
import { GaslessBadge } from '../components/GaslessBadge';
import toast from 'react-hot-toast';
import { useSocialGuard } from '../hooks/useSocialGuard';
import { formatEther } from 'viem';
import { CONTRACTS, MASTER_X_ABI } from '../lib/contracts';

function RaffleRow({ raffleId, filter = 'all' }) {
  const { address } = useAccount();
  const { raffle, isLoading } = useRaffleInfo(raffleId);
  const { buyTicketsGasless, claimPrize, isGaslessSupported } = useRaffle();
  const { data: socialProfile } = useSocialGuard(address);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: ticketPriceETH } = useReadContract({
    address: CONTRACTS.MASTER_X,
    abi: MASTER_X_ABI,
    functionName: 'getTicketPriceInETH',
  });

  if (isLoading || !raffle) return null;
  if (filter === 'active' && !raffle.isActive) return null;
  if (filter === 'completed' && !raffle.isFinalized) return null;

  const isWinner = raffle.winners?.some(w => w.toLowerCase() === address?.toLowerCase());
  const isFinalized = raffle.isFinalized;
  const timeLeft = raffle.endTime > Date.now() / 1000
    ? Math.max(0, Math.floor((raffle.endTime - Date.now() / 1000) / 60)) + "m left"
    : "Ended";

  const handleAction = async (e) => {
    e.stopPropagation();

    // 🛡️ ANTI-SYBIL GUARD: Requires Farcaster or Twitter Linkage for purchase
    if (!raffle?.isFinalized && !socialProfile?.isVerified) {
        toast.error("Social Identity Required. link Farcaster/Twitter in Profile.", { icon: '🛡️' });
        return;
    }

    setIsProcessing(true);
    const tid = toast.loading(isFinalized ? "Claiming prize..." : "Processing purchase...");
    try {
      if (isFinalized) {
        await claimPrize(raffleId);
        toast.success("Prize claimed!", { id: tid });
      } else {
        // Gunakan gasless jika Smart Wallet terdeteksi, fallback ke normal jika tidak
        await buyTicketsGasless(raffleId, 1);
        toast.dismiss(tid);
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
    <div className="flex flex-col p-4 border-b border-white/5 active:bg-white/5 transition-colors">
      {/* Header Row */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-lg bg-[#080808] flex items-center justify-center flex-shrink-0 border border-white/10 shadow-xl">
            <Trophy size={20} className="text-indigo-400" />
          </div>
          <div className="flex flex-col justify-center">
            <h3 className="label-native !mb-1 !tracking-widest">
              {raffle.metadataURI?.includes('ipfs') ? "COMMUNITY PRIZE" : `ELITE RAFFLE #${raffle.id}`}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`label-native px-2 py-0.5 rounded border leading-none ${raffle.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                {raffle.isActive ? 'LIVE' : 'CLOSED'}
              </span>
              <span className="value-native !text-slate-500 font-mono">
                {ticketPriceETH ? parseFloat(formatEther(ticketPriceETH)).toFixed(6) : '...'} ETH
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1 label-native font-mono text-slate-400 justify-end">
            <Timer size={10} /> {isFinalized ? "FINALIZED" : timeLeft.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Progress Bar (Subtle) */}
      <div className="mt-4 mb-3 px-1">
        <div className="flex justify-between items-center mb-2">
          <span className="label-native !mb-0 !text-slate-600">TICKETS SOLD</span>
          <span className="value-native !text-slate-400">{currentTickets} / {maxTickets}</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
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
          className="w-full py-2 rounded-lg bg-emerald-600 text-white label-native flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-emerald-900/20"
        >
          {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Gift size={16} />}
          CLAIM PRIZE
        </button>
      ) : (
        <button
          onClick={handleAction}
          disabled={isProcessing || isFinalized || !raffle.isActive}
          className={`w-full py-2.5 rounded-xl label-native flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg ${isFinalized || !raffle.isActive ? 'bg-zinc-800 text-zinc-500' : 'bg-[#0052FF] text-white font-black hover:bg-[#0042CC] shadow-blue-500/10'}`}
        >
          {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Ticket size={16} />}
          {isFinalized ? 'RESULTS OUT' : isGaslessSupported ? '⛽ BUY FREE' : 'BUY TICKET'}
        </button>
      )}
    </div>
  );
}

export function RafflesPage() {
  const [filter, setFilter] = useState('all');
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
      </div>
    </div>
  );
}
