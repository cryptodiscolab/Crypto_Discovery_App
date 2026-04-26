import { Shield, Clock, Ticket, Loader2, Trophy, AlertCircle, Share2, Hash, ShieldCheck } from 'lucide-react';
import { GridCard } from './GridCard';
import { useRaffle, useRaffleList, useRaffleInfo } from '../../hooks/useRaffle';
import { useAccount } from 'wagmi';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { usePoints } from '../../shared/context/PointsContext';
import { useSocialGuard } from '../../hooks/useSocialGuard';

export function RaffleCard() {
    const { isConnected, address } = useAccount();
    const { ecosystemSettings, gasTracker } = usePoints();
    const { isGasExpensive, isGasHigh } = gasTracker || {};
    const { raffleIds } = useRaffleList();
    const latestId = raffleIds.length > 0 ? raffleIds[raffleIds.length - 1] : null;
    const { raffle, isLoading } = useRaffleInfo(latestId || 0);
    const { buyTickets, buyTicketsGasless, claimPrize, isGaslessSupported } = useRaffle();
    const { data: socialProfile, isLoading: isSocialLoading } = useSocialGuard(address);
    const [isBuying, setIsBuying] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);

    // Check if connected address is a winner
    const isWinner = address && raffle?.winners?.map(w => w.toLowerCase()).includes(address.toLowerCase());
    const alreadyFinalized = raffle?.isFinalized;

    const handleBuy = async () => {
        if (isGasExpensive) return toast.error("⛔ Transaction paused: network gas too high. Please wait.", { icon: '⛽' });
        if (!isConnected) return toast.error("Please connect wallet first");
        if (!raffle || !raffle.isActive) return toast.error("No active raffle");

        // 🛡️ ANTI-SYBIL GUARD: Requires Farcaster or Twitter Linkage
        if (!socialProfile?.isVerified) {
            toast.error("Social Identity Required. Please link Farcaster or Twitter in Profile.", {
                duration: 4000,
                icon: '🛡️'
            });
            return;
        }

        setIsBuying(true);
        try {
            const amount = 1; // Default buy 1 ticket
            if (isGaslessSupported) {
                await buyTicketsGasless(raffle.id, amount);
            } else {
                await buyTickets(raffle.id, amount);
            }
        } catch (err) {
            console.error("Purchase error", err);
        } finally {
            setIsBuying(false);
        }
    };

    const handleClaim = async () => {
        if (isGasExpensive) return toast.error("⛔ Transaction paused: network gas too high. Please wait.", { icon: '⛽' });
        if (!isConnected) return toast.error("Please connect wallet first");
        if (!isWinner) return toast.error("You are not a winner of this raffle");
        setIsClaiming(true);
        try {
            await claimPrize(raffle.id);
        } catch (err) {
            console.error("Claim error", err);
        } finally {
            setIsClaiming(false);
        }
    };

    if (isLoading) {
        return (
            <GridCard className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </GridCard>
        );
    }

    // Default if no raffle found
    const displayedRaffle = raffle || {
        title: "No Active Raffle",
        description: "Stay tuned for the next blue-chip NFT drop!",
        prizeName: "TBA",
        floorPrice: "0 ETH",
        endTime: 0,
        totalTickets: 0,
        maxTickets: 100,
        isActive: false
    };

    const progress = (displayedRaffle.totalTickets / (displayedRaffle.maxTickets || 1)) * 100;
    const timeLeft = displayedRaffle.endTime > 0
        ? Math.max(0, Math.floor((displayedRaffle.endTime * 1000 - Date.now()) / 1000))
        : 0;

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

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
                    <span className="label-native text-slate-300">API3 VERIFIED</span>
                </div>
            </div>

            <h3 className="text-xl font-black text-white mb-1 uppercase tracking-tighter italic leading-none">
                {displayedRaffle.id ? `EXCLUSIVE RAFFLE #${displayedRaffle.id}` : "UPCOMING RAFFLE"}
            </h3>
            <p className="label-native opacity-60 mb-3">WIN BLUE-CHIP NFTS. FAIR RANDOMNESS POWERED BY QUANTUM RNG.</p>

            {/* Metadata Stamps */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-6">
                <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-purple-400/50" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        ID: <span className="text-white">#{displayedRaffle.id}</span>
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Share2 className="w-3 h-3 text-purple-400/50" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        CREATOR: <span className="text-purple-400">{displayedRaffle.sponsor ? `${displayedRaffle.sponsor.slice(0, 6)}...${displayedRaffle.sponsor.slice(-4)}` : 'ADMIN'}</span>
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-purple-400/50" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        CREATED: <span className="text-slate-400">{displayedRaffle.created_at ? new Date(displayedRaffle.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'LEGACY'}</span>
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-purple-400/50" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        EXPIRES: <span className="text-slate-400">{displayedRaffle.endTime ? new Date(displayedRaffle.endTime * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</span>
                    </span>
                </div>
            </div>

            {/* Live Raffle Details */}
            <div className="bg-zinc-950/40 rounded-2xl p-4 border border-white/5 mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
                        <Ticket className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="label-native !mb-0.5">REWARD: NFT PRIZE</h4>
                        <p className="value-native !text-indigo-400">POOL: {(Number(displayedRaffle.prizePool || 0) / 1e18).toFixed(4)} ETH</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-end">
                        <span className="label-native !mb-0 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-600" /> {timeLeft > 0 ? "ENDS IN" : "STATUS"}
                        </span>
                        <span className={`value-native italic tracking-tighter ${timeLeft > 0 ? 'text-white' : 'text-red-400'}`}>
                            {timeLeft > 0 ? formatTime(timeLeft) : (displayedRaffle.isActive ? "ENDING SOON" : "ENDED")}
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(100, progress)}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className="label-native !mb-0 !text-slate-600 font-bold">{displayedRaffle.totalTickets} TICKETS SOLD</span>
                        <span className="label-native !mb-0 !text-slate-600 font-bold">{displayedRaffle.maxTickets} MAX</span>
                    </div>
                </div>
            </div>

            {/* Winner Banner — shown only if user is a winner */}
            {isWinner && alreadyFinalized && (
                <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl mb-3 animate-pulse">
                    <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <div>
                        <p className="label-native !text-yellow-500 !mb-0.5">🏆 YOU&apos;RE A WINNER!</p>
                        <p className="label-native !text-yellow-200/50">CLAIM YOUR NFT PRIZE BELOW.</p>
                    </div>
                </div>
            )}

            {/* Warning Banner for High Gas */}
            {isGasHigh && !isGasExpensive && displayedRaffle.isActive && timeLeft > 0 && (
                <div className="flex items-center justify-center gap-2 mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest text-center shadow-inner">
                    ⚠️ Network is busy, fee might be high
                </div>
            )}

            {/* Action Buttons */}
            {isWinner && alreadyFinalized ? (
                <button
                    onClick={handleClaim}
                    disabled={isClaiming || isGasExpensive}
                    className={`w-full min-h-[56px] py-3 rounded-xl label-native transition-all border flex flex-col items-center justify-center gap-1 mt-auto shadow-lg px-2 text-center
                        ${isGasExpensive
                            ? 'bg-red-900/20 text-red-500 border-red-500/30 cursor-not-allowed'
                            : isClaiming
                            ? 'bg-slate-800 text-slate-500 border-white/5 cursor-not-allowed'
                            : 'bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-400 shadow-yellow-500/20'
                        }`}
                >
                    {isGasExpensive ? (
                        <>
                            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> ⛔ GAS TOO HIGH</span>
                            <span className="text-[9px] opacity-70 normal-case font-medium tracking-normal">Please wait until network fees drop</span>
                        </>
                    ) : isClaiming ? (
                        <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> CLAIMING...</div>
                    ) : (
                        <div className="flex items-center gap-2"><Trophy className="w-4 h-4" /> CLAIM YOUR PRIZE</div>
                    )}
                </button>
            ) : (
                <button
                    onClick={handleBuy}
                    disabled={isBuying || !displayedRaffle.isActive || timeLeft <= 0 || isGasExpensive}
                    className={`w-full min-h-[56px] py-3 rounded-xl label-native transition-all border flex flex-col items-center justify-center gap-1 mt-auto shadow-lg px-2 text-center
                        ${isGasExpensive && displayedRaffle.isActive && timeLeft > 0
                            ? 'bg-red-900/20 text-red-500 border-red-500/30 cursor-not-allowed'
                            : isBuying
                            ? 'bg-slate-800 text-slate-500 border-white/5 cursor-not-allowed'
                            : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                        }`}
                >
                    {isGasExpensive && displayedRaffle.isActive && timeLeft > 0 ? (
                        <>
                            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> ⛔ GAS TOO HIGH</span>
                            <span className="text-[9px] opacity-70 normal-case font-medium tracking-normal">Please wait until network fees drop</span>
                        </>
                    ) : isBuying ? (
                        <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> PROCESSING...</div>
                    ) : (
                        <div className="flex items-center gap-2">
                            {isGaslessSupported && <span className="text-xs">⛽</span>}
                            {isGaslessSupported
                                ? "BUY FREE TICKET"
                                : `BUY TICKET (${ecosystemSettings?.raffle_ticket_price_usdc || 0.15} USDC)`}
                        </div>
                    )}
                </button>
            )}
        </GridCard>
    );
}
