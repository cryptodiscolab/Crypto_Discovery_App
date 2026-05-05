import { useRaffleList, useRaffleInfo } from '../../hooks/useRaffle';
import { Trophy, ExternalLink, Loader2, RefreshCw, Hash } from 'lucide-react';
import { useState } from 'react';

const EXPLORER = import.meta.env.VITE_EXPLORER_URL || 'https://sepolia.basescan.org';

// ─── Single finalized raffle row ─────────────────────────────────────────────
function FinalizedRaffleRow({ raffleId }) {
    const { raffle, isLoading } = useRaffleInfo(raffleId);

    if (isLoading) return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 animate-pulse">
            <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Loading Raffle #{raffleId}...</span>
        </div>
    );

    if (!raffle?.isFinalized) return null;

    const realWinners = (raffle.winners || []).filter(
        w => w && w !== '0x0000000000000000000000000000000000000000'
    );
    if (realWinners.length === 0) return null;

    const prizeETH = raffle.prizePool ? (Number(raffle.prizePool) / 1e18).toFixed(4) : '?';

    return (
        <div className="rounded-2xl border border-white/8 bg-zinc-950/60 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/3 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[0.2em]">
                        Raffle #{raffleId}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Prize: <span className="text-emerald-400">{prizeETH} ETH</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                        FINALIZED
                    </span>
                </div>
            </div>

            {/* Winners list */}
            <div className="divide-y divide-white/5">
                {realWinners.map((addr, i) => (
                    <div key={addr} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors group">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-[9px] font-black text-yellow-400">
                                #{i + 1}
                            </span>
                            <span className="font-mono text-[11px] text-slate-300 tracking-tight">
                                <span className="text-white">{addr.slice(0, 6)}</span>
                                <span className="text-slate-600">···</span>
                                <span className="text-white">{addr.slice(-6)}</span>
                            </span>
                        </div>
                        <a
                            href={`${EXPLORER}/address/${addr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300"
                        >
                            View <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main section ─────────────────────────────────────────────────────────────
export function RaffleWinnersSection() {
    const { raffleIds, count } = useRaffleList();
    const [refreshKey, setRefreshKey] = useState(0);

    // Only show finalized raffles (we try to render all, each row self-filters if not finalized)
    const sortedIds = [...raffleIds].reverse(); // newest first

    if (count === 0) return null;

    return (
        <section className="mt-8 mb-2">
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                        <Trophy className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-[0.15em]">
                            🏆 RAFFLE HALL OF FAME
                        </h2>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">
                            On-chain verified · API3 QRNG powered
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setRefreshKey(k => k + 1)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-500 hover:text-white transition-all"
                    title="Refresh"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Glowing divider */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent mb-5" />

            {/* Raffle rows (newest first, only finalized show) */}
            <div key={refreshKey} className="space-y-3">
                {sortedIds.map(id => (
                    <FinalizedRaffleRow key={id} raffleId={id} />
                ))}
            </div>

            {/* Chain badge */}
            <div className="flex items-center justify-center gap-2 mt-5">
                <Hash className="w-3 h-3 text-slate-700" />
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">
                    Results verifiable on Base {import.meta.env.VITE_CHAIN_ID === '8453' ? 'Mainnet' : 'Sepolia'}
                </span>
            </div>
        </section>
    );
}
