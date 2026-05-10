import { TrendingUp, Gift, Sparkles } from 'lucide-react';
import { GridCard } from './GridCard';
import { useAccount } from 'wagmi';
import { usePoints } from '../../shared/context/PointsContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function AnalyticsCard() {
    const { isConnected } = useAccount();
    const { userPoints, unclaimedRewards } = usePoints();

    return (
        <GridCard delay={0.3} className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-green-500/20 rounded-2xl">
                    <span className="text-2xl">📊</span>
                </div>
                <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">YOUR STATS</span>
                </div>
            </div>

            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-2">Player Dashboard</h3>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-6 opacity-70">Track your points and claim your winnings instantly.</p>

            {!isConnected ? (
                <div className="flex-grow flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl border border-white/5 border-dashed mb-6">
                    <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-4">Connect wallet to view stats</p>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
                        THE FAIREST RAFFLE PLATFORM ON BASE. COMPLETE SOCIAL TASKS TO EARN FREE TICKETS,
                        OR BOOST YOUR CHANCES WITH PREMIUM ENTRIES. TRULY RANDOM, FULLY TRANSPARENT.
                    </p>
                    <div className="scale-90 origin-center">
                        <ConnectButton />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 mb-6 flex-grow">
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                        <div className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> POINTS
                        </div>
                        <div className="text-2xl font-black text-white italic tracking-tighter uppercase">{userPoints ? userPoints.toString() : '0'}</div>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                        <div className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Gift className="w-3 h-3" /> CLAIMS
                        </div>
                        <div className="text-2xl font-black text-white italic tracking-tighter uppercase">
                            {unclaimedRewards ? unclaimedRewards.length : '0'}
                        </div>
                    </div>
                </div>
            )}

            <button className="w-full py-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all mt-auto">
                VIEW FULL PROFILE
            </button>
        </GridCard>
    );
}
