import { Shield, Clock } from 'lucide-react';
import { GridCard } from './GridCard';

export function RaffleCard() {
    return (
        <GridCard delay={0.2} className="h-full flex flex-col relative overflow-hidden group">
            {/* Background Gradient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/30 blur-[60px] rounded-full group-hover:bg-purple-600/40 transition-all" />

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="p-3 bg-purple-500/20 rounded-2xl">
                    <span className="text-2xl">💎</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-white/10">
                    <Shield className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs font-bold text-slate-300">API3 VERIFIED</span>
                </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">Featured Raffle</h3>
            <p className="text-slate-400 text-sm mb-6">Win blue-chip NFTs. Fair randomness powered by Quantum RNG.</p>

            {/* Mock Live Raffle Preview */}
            <div className="bg-slate-950/50 rounded-2xl p-4 border border-white/5 mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl" />
                    <div>
                        <h4 className="text-white font-bold text-sm">Milady Maker #8822</h4>
                        <p className="text-slate-500 text-xs">Floor: 3.5 ETH</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Ends in
                        </span>
                        <span className="text-white font-mono font-bold">04:22:15</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 w-[75%]" />
                    </div>
                </div>
            </div>

            <button className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all border border-white/10 flex items-center justify-center gap-2 mt-auto">
                Buy Tickets
            </button>
        </GridCard>
    );
}
