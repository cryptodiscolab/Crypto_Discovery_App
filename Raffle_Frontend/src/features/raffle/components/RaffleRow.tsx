import { useState } from 'react';
import { Trophy, Timer, Gift, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useRaffleInfo } from '../hooks/useRaffleQueries';
import { useRaffle } from '../../../hooks/useRaffle';
import { useSocialGuard } from '../../../hooks/useSocialGuard';
import { CONTRACTS, MASTER_X_ABI } from '../../../lib/contracts';
import toast from 'react-hot-toast';
import { MouseEvent } from 'react';

interface RaffleRowProps {
  raffleId: number;
  filter?: 'all' | 'active' | 'completed' | string;
}

export function RaffleRow({ raffleId, filter = 'all' }: RaffleRowProps) {
  const { address } = useAccount();
  const { raffle, isLoading } = useRaffleInfo(raffleId);
  const { buyTickets, buyTicketsGasless, claimPrize, isGaslessSupported } = useRaffle();
  const { data: socialProfile } = useSocialGuard(address);
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketAmount, setTicketAmount] = useState(1);

  const { data: _ticketPriceETH } = useReadContract({
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

  const handleAction = async (e: MouseEvent<HTMLButtonElement>) => {
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
        if (isGaslessSupported) {
          await buyTicketsGasless(raffleId, ticketAmount);
        } else {
          await buyTickets(raffleId, ticketAmount);
        }
        toast.dismiss(tid);
      }
    } catch (e: any) {
      toast.error(e.shortMessage || e.message || "Action failed", { id: tid });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentTickets = Number(raffle.totalTickets || 0);
  const maxTickets = Number(raffle.maxTickets || 100);
  const progress = Math.min((currentTickets / maxTickets) * 100, 100);

  return (
    <div
        onClick={() => navigate(`/raffles/${raffle.id}`)}
        className="flex flex-col p-4 border-b border-white/5 active:bg-white/5 md:border md:rounded-2xl md:mb-4 hover:border-indigo-500/50 transition-all cursor-pointer group bg-zinc-900/20"
    >
      {/* Header Row */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-xl bg-zinc-950 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-xl overflow-hidden group-hover:border-indigo-500/50 transition-colors">
            {raffle.image_url ? (
                <img src={raffle.image_url} alt={raffle.title} className="w-full h-full object-cover" />
            ) : (
                <Trophy size={24} className="text-indigo-400" />
            )}
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-black text-white uppercase tracking-wider truncate max-w-[150px]">
                {raffle.title || (raffle.metadataURI?.includes('ipfs') ? "COMMUNITY PRIZE" : `ELITE RAFFLE #${raffle.id}`)}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border leading-none ${raffle.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                {raffle.isActive ? 'LIVE' : 'CLOSED'}
              </span>
              {raffle.category && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded border leading-none bg-blue-500/10 text-blue-400 border-blue-500/20">
                  {raffle.category.toUpperCase()}
                </span>
              )}
              {(raffle.min_sbt_level ?? 0) > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded border leading-none bg-purple-500/10 text-purple-400 border-purple-500/20">
                  LVL {raffle.min_sbt_level}+
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-[10px] font-black font-mono text-slate-500 justify-end uppercase tracking-widest">
            <Timer size={10} /> {isFinalized ? "FINALIZED" : timeLeft.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Progress Bar (Subtle) */}
      <div className="mt-1 mb-4 px-1">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">TICKETS SOLD</span>
          <span className="text-[11px] font-bold text-slate-400">{currentTickets} / {maxTickets}</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isFinalized ? 'bg-slate-600' : 'bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.4)]'}`}
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
        <div className="flex items-center gap-2 w-full">
           {!isFinalized && raffle.isActive && (
             <div className="flex items-center bg-zinc-900 rounded-xl border border-white/10 p-1 shrink-0">
                 <button onClick={(e) => { e.stopPropagation(); setTicketAmount(p => Math.max(1, p - 1))}} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded-lg disabled:opacity-50 transition-colors" disabled={ticketAmount <= 1 || isProcessing}>-</button>
                 <span className="w-6 text-center font-mono font-bold text-sm text-white">{ticketAmount}</span>
                 <button onClick={(e) => { e.stopPropagation(); setTicketAmount(p => p + 1)}} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded-lg disabled:opacity-50 transition-colors" disabled={isProcessing || ticketAmount >= (maxTickets - currentTickets)}>+</button>
             </div>
           )}
          <button
            onClick={handleAction}
            disabled={isProcessing || isFinalized || !raffle.isActive}
            className={`flex-1 py-2.5 rounded-xl label-native flex items-center justify-center gap-2 active:scale-95 transition-all ${isFinalized || !raffle.isActive ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50' : 'bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-400 hover:text-white'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : null}
            {isFinalized ? 'RESULTS OUT' : isGaslessSupported ? `⛽ BUY FREE` : 'BUY TICKET'}
          </button>
        </div>
      )}
    </div>
  );
}
