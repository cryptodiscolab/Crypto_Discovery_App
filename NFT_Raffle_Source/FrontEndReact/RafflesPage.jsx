import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Ticket, Clock, Users, Gift, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useTotalRaffles, useRaffleInfo, useBuyTickets, useDrawWinner, useClaimPrizes } from '../hooks/useContract';
import toast from 'react-hot-toast';

function RaffleCard({ raffleId }) {
  const { address } = useAccount();
  const { raffleInfo, isLoading } = useRaffleInfo(raffleId);
  const { buyTickets, isLoading: isBuying } = useBuyTickets();
  const { drawWinner, isLoading: isDrawing } = useDrawWinner();
  const { claimPrizes, isLoading: isClaiming } = useClaimPrizes();
  const [ticketAmount, setTicketAmount] = useState(1);

  if (isLoading || !raffleInfo) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-48 bg-slate-800 rounded-lg mb-4"></div>
        <div className="h-4 bg-slate-800 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-slate-800 rounded w-1/2"></div>
      </div>
    );
  }

  const endTime = new Date(Number(raffleInfo.endTime) * 1000);
  const now = new Date();
  const isEnded = now > endTime;
  const timeLeft = endTime - now;
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const daysLeft = Math.floor(hoursLeft / 24);

  const handleBuyTickets = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }
    await buyTickets(raffleId, ticketAmount, false);
  };

  const handleDrawWinner = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }
    await drawWinner(raffleId);
  };

  const handleClaimPrizes = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }
    await claimPrizes(raffleId, raffleInfo.paidTicketsSold);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 hover:scale-105 transition-transform duration-300"
    >
      {/* Status Badge */}
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${raffleInfo.isCompleted ? 'bg-green-400/10 text-green-400' :
          isEnded ? 'bg-yellow-400/10 text-yellow-400' :
            'bg-blue-400/10 text-blue-400'
          }`}>
          {raffleInfo.isCompleted ? 'Completed' : isEnded ? 'Ended' : 'Active'}
        </span>
        <span className="text-sm font-medium text-slate-400">Raffle #{Number(raffleId)}</span>
      </div>

      {/* NFT Preview */}
      <div className="relative h-48 bg-gradient-to-br from-blue-400 to-purple-400 rounded-xl mb-4 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Gift className="w-20 h-20 text-white/50" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-white font-semibold">{Number(raffleInfo.nftCount)} NFTs</p>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-600">
            <Users className="w-4 h-4" />
            <span className="text-sm">Tickets Sold</span>
          </div>
          <span className="font-bold text-slate-800">{Number(raffleInfo.ticketsSold)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Time Left</span>
          </div>
          <span className="font-bold text-slate-800">
            {isEnded ? 'Ended' : `${daysLeft}d ${hoursLeft % 24}h`}
          </span>
        </div>

        {raffleInfo.winner && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700 mb-1">Winner</p>
            <p className="text-sm font-mono text-green-800">
              {raffleInfo.winner.slice(0, 6)}...{raffleInfo.winner.slice(-4)}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {!raffleInfo.isCompleted && !isEnded && (
        <div className="space-y-3">
          <div className="flex space-x-2">
            <input
              type="number"
              min="1"
              max="100"
              value={ticketAmount}
              onChange={(e) => setTicketAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Amount"
            />
            <button
              onClick={handleBuyTickets}
              disabled={isBuying || !address}
              className="btn-primary flex items-center space-x-2"
            >
              {isBuying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Ticket className="w-4 h-4" />
                  <span>Buy</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-center text-slate-500">
            ${(0.15 * ticketAmount).toFixed(2)} + 5% fee
          </p>
        </div>
      )}

      {isEnded && !raffleInfo.isCompleted && Number(raffleInfo.ticketsSold) > 0 && (
        <button
          onClick={handleDrawWinner}
          disabled={isDrawing || !address}
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          {isDrawing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Gift className="w-4 h-4" />
              <span>Draw Winner</span>
            </>
          )}
        </button>
      )}

      {raffleInfo.isCompleted && raffleInfo.winner === address && (
        <button
          onClick={handleClaimPrizes}
          disabled={isClaiming}
          className="btn-primary w-full bg-green-600 hover:bg-green-700 mt-4 flex items-center justify-center space-x-2"
        >
          {isClaiming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Gift className="w-4 h-4" />
              <span>Claim Reward (Fee 5%)</span>
            </>
          )}
        </button>
      )}
    </motion.div>
  );
}

export function RafflesPage() {
  const { totalRaffles } = useTotalRaffles();
  const [filter, setFilter] = useState('active'); // active, ended, all

  const raffleIds = Array.from({ length: totalRaffles }, (_, i) => i);

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Active Raffles</h1>
          <p className="text-lg text-slate-600">Browse and participate in ongoing NFT raffles</p>
        </div>

        {/* Filters */}
        <div className="flex space-x-2 mb-8">
          {['active', 'ended', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-xl font-medium transition-all duration-200 ${filter === f
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-white/60 text-slate-600 hover:bg-white'
                }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Raffle Grid */}
        {totalRaffles === 0 ? (
          <div className="text-center py-20">
            <Gift className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-xl text-slate-500">No raffles available yet</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {raffleIds.map((id) => (
              <RaffleCard key={id} raffleId={id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
