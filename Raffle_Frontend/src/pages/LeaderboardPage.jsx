import { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, Ticket, Loader2 } from 'lucide-react';
import { useRaffleList, useRaffleInfo } from '../hooks/useRaffle';

function WinnerRow({ raffleId, rank }) {
  const { raffle, isLoading } = useRaffleInfo(raffleId);

  if (isLoading || !raffle || !raffle.isCompleted) return null;

  return (
    <div
      className="glass-card p-5 flex items-center justify-between border border-white/5 hover:border-yellow-500/20 transition-all animate-slide-up"
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 flex items-center justify-center font-black rounded-xl shadow-lg
          ${rank === 1 ? 'bg-yellow-500 text-black shadow-yellow-500/20' :
            rank === 2 ? 'bg-slate-300 text-black shadow-slate-300/20' :
              rank === 3 ? 'bg-amber-600 text-black shadow-amber-600/20' : 'bg-slate-800 text-white'}`}>
          {rank}
        </div>
        <div>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Winner of Raffle #{raffle.id}</p>
          <span className="font-mono text-white text-sm break-all">{raffle.winner}</span>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <div className="flex items-center gap-2 text-yellow-400 font-black">
          <Trophy className="w-5 h-5" />
          <span className="text-xl">JACKPOT</span>
        </div>
        <p className="text-[10px] text-slate-500 uppercase font-black">Received 1 NFT</p>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const { raffleIds, count } = useRaffleList();

  // Get last 10 completed raffle IDs
  const displayIds = raffleIds ? raffleIds.slice().reverse().slice(0, 10) : [];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto max-w-4xl relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-4">
            <Crown className="w-10 h-10 text-yellow-500" />
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tight">Hall of <span className="text-yellow-500">Fame</span></h1>
          <p className="text-slate-400 font-medium max-w-lg mx-auto">Celebrating our most legendary winners on the blockchain. Every win is verifiable and eternal.</p>
        </div>

        <div className="space-y-4">
          {!raffleIds || raffleIds.length === 0 ? (
            <div className="text-center py-20 glass-card">
              <Loader2 className="w-10 h-10 text-yellow-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-500 font-bold">Scanning the blockchain for winners...</p>
            </div>
          ) : (
            displayIds.map((id, index) => (
              <WinnerRow
                key={id}
                raffleId={id}
                rank={index + 1}
              />
            ))
          )}
        </div>

        {count > 10 && (
          <p className="text-center mt-12 text-slate-600 text-xs font-bold uppercase tracking-widest">
            And {count - 10} other legendary winners...
          </p>
        )}
      </div>
    </div>
  );
}
