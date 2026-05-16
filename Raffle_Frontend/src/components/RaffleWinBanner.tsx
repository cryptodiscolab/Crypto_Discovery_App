import { Trophy, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnclaimedRaffleWins } from '../hooks/useUnclaimedRaffleWins';

/**
 * RaffleWinBanner
 *
 * Persistent banner shown at the top of the app when user has unclaimed raffle prizes.
 * Dismissible per session but reappears on next visit if still unclaimed.
 */
export function RaffleWinBanner() {
    const { unclaimedWins, hasUnclaimedWins } = useUnclaimedRaffleWins();
    const [dismissed, setDismissed] = useState(false);
    const navigate = useNavigate();

    if (!hasUnclaimedWins || dismissed) return null;

    const totalPrize = unclaimedWins.reduce((sum, w) => sum + Number(w.prizePerWinner), 0) / 1e18;
    const count = unclaimedWins.length;

    return (
        <div className="w-full bg-gradient-to-r from-emerald-600/20 via-emerald-500/10 to-emerald-600/20 border-b border-emerald-500/30 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgxNiwxODUsMTI5LDAuMSkiLz48L3N2Zz4=')] opacity-50" />

            <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 animate-pulse">
                        <Trophy className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest truncate">
                            🎉 {count > 1 ? `${count} UNCLAIMED PRIZES` : 'YOU WON A RAFFLE!'}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-300/60 uppercase tracking-wider truncate">
                            {totalPrize.toFixed(4)} ETH waiting to be claimed
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => navigate('/raffles')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                    >
                        CLAIM NOW <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1.5 rounded-full hover:bg-white/10 text-emerald-400/60 hover:text-white transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
