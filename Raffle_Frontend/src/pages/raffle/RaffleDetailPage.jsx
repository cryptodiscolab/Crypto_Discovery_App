import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRaffleInfo, useRaffle } from '../../hooks/useRaffle';
import { useAccount } from 'wagmi';
import { usePoints } from '../../shared/context/PointsContext';
import { useSocialGuard } from '../../hooks/useSocialGuard';
import { formatEther } from 'viem';
import { 
    Calendar, 
    Users, 
    Trophy, 
    ChevronLeft, 
    ExternalLink, 
    Twitter, 
    Globe, 
    ShieldCheck,
    Ticket,
    Info,
    AlertCircle,
    ArrowRight,
    Loader2,
    Lock
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const RaffleDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { address } = useAccount();
    const { userTier } = usePoints();
    const { data: socialProfile } = useSocialGuard(address);
    const { raffle, isLoading, refetch } = useRaffleInfo(id);
    const { buyTickets, buyTicketsGasless, isGaslessSupported } = useRaffle();
    const [isBuying, setIsBuying] = useState(false);
    const [ticketAmount, setTicketAmount] = useState(1);
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!raffle?.endTime) return;
        
        const timer = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const diff = Number(raffle.endTime) - now;
            
            if (diff <= 0) {
                setTimeLeft('Ended');
                clearInterval(timer);
            } else {
                const days = Math.floor(diff / 86400);
                const hours = Math.floor((diff % 86400) / 3600);
                const mins = Math.floor((diff % 3600) / 60);
                const secs = diff % 60;
                setTimeLeft(`${days > 0 ? days + 'd ' : ''}${hours}h ${mins}m ${secs}s`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [raffle?.endTime]);

    const handleBuy = async () => {
        if (!raffle?.isActive) {
            toast.error("Raffle is not active");
            return;
        }

        // 🛡️ ANTI-SYBIL GUARD: Social Verification
        if (!socialProfile?.isVerified && raffle.is_base_social_required) {
            toast.error("Social Identity Required. Link Farcaster/Twitter in Profile.", { icon: '🛡️' });
            return;
        }

        // 🏆 REPUTATION GUARD: SBT Level
        if (userTier < (raffle.min_sbt_level || 0)) {
            toast.error(`SBT Level ${raffle.min_sbt_level}+ required to enter this raffle.`, { icon: '🏆' });
            return;
        }

        // 🎫 CAPACITY GUARD: Ticket availability
        const remaining = Number(raffle.maxTickets) - Number(raffle.totalTickets);
        if (ticketAmount > remaining) {
            toast.error(`Only ${remaining} ticket(s) left in this raffle.`, { icon: '🎫' });
            return;
        }

        setIsBuying(true);
        const tid = toast.loading(isGaslessSupported ? "Processing gasless purchase..." : "Preparing transaction...");
        
        try {
            if (isGaslessSupported) {
                await buyTicketsGasless(id, ticketAmount);
            } else {
                await buyTickets(id, ticketAmount);
            }
            toast.success(`Success! Purchased ${ticketAmount} entry(s)`, { id: tid });
            refetch();
        } catch (e) {
            toast.error(e.shortMessage || e.message || "Purchase failed", { id: tid });
        } finally {
            setIsBuying(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (!raffle) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Raffle Not Found</h1>
                <p className="text-zinc-400 mb-6">The raffle you are looking for doesn't exist or hasn't been synced yet.</p>
                <button 
                    onClick={() => navigate('/raffles')}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back to Raffles
                </button>
            </div>
        );
    }

    const progress = (raffle.totalTickets / raffle.maxTickets) * 100;
    const isEnded = timeLeft === 'Ended' || raffle.isFinalized;

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 pb-20">
            {/* Header / Navigation */}
            <div className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button 
                        onClick={() => navigate('/raffles')}
                        className="p-2 hover:bg-white/10 rounded-full transition-all group"
                    >
                        <ChevronLeft className="w-6 h-6 text-zinc-400 group-hover:text-white" />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            raffle.isActive ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                            {raffle.isFinalized ? 'Finalized' : (raffle.isActive ? 'Active' : 'Pending Approval')}
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 pt-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Column: Media & Content */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Image Hero */}
                        <div className="relative aspect-video rounded-3xl overflow-hidden bg-zinc-900 border border-white/10 group shadow-2xl">
                            {raffle.image_url ? (
                                <img 
                                    src={raffle.image_url} 
                                    alt={raffle.title} 
                                    className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
                                    <Trophy className="w-20 h-20 text-white/10 mb-4" />
                                    <span className="text-zinc-600 font-medium">No Preview Available</span>
                                </div>
                            )}
                            {/* Overlay info */}
                            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/60 to-transparent">
                                <h1 className="text-4xl font-extrabold text-white mb-2 leading-tight">
                                    {raffle.title || `Raffle #${raffle.id}`}
                                </h1>
                                <div className="flex flex-wrap gap-4 text-zinc-300">
                                    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                                        <Trophy className="w-4 h-4 text-yellow-400" />
                                        <span className="text-sm font-semibold">{raffle.winnerCount} Winners</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                                        <Users className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-semibold">{raffle.totalTickets} Participants</span>
                                    </div>
                                    {raffle.min_sbt_level > 0 && (
                                        <div className="flex items-center gap-2 bg-purple-500/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-purple-500/30">
                                            <ShieldCheck className="w-4 h-4 text-purple-400" />
                                            <span className="text-sm font-semibold">Tier {raffle.min_sbt_level}+ Required</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Description & Metadata */}
                        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 shadow-sm">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Info className="w-5 h-5 text-primary-400" />
                                About this Raffle
                            </h2>
                            <div className="prose prose-invert max-w-none">
                                <p className="text-zinc-400 leading-relaxed text-lg whitespace-pre-wrap">
                                    {raffle.description || "The sponsor hasn't provided a description for this raffle yet."}
                                </p>
                            </div>

                            {/* Social Links */}
                            <div className="mt-10 flex flex-wrap gap-4">
                                {raffle.twitter_link && (
                                    <a 
                                        href={raffle.twitter_link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] px-4 py-2 rounded-xl transition-all border border-[#1DA1F2]/20"
                                    >
                                        <Twitter className="w-4 h-4" />
                                        Twitter / X
                                    </a>
                                )}
                                {raffle.external_link && (
                                    <a 
                                        href={raffle.external_link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition-all border border-white/10"
                                    >
                                        <Globe className="w-4 h-4" />
                                        Official Website
                                        <ExternalLink className="w-3 h-3 opacity-50" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Action Card */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sticky top-24 shadow-2xl">
                            
                            {/* Prize Pool Display */}
                            <div className="text-center mb-8">
                                <span className="text-zinc-500 text-sm font-medium uppercase tracking-widest mb-1 block">Total Prize Pool</span>
                                <div className="flex items-center justify-center gap-2">
                                    <Trophy className="w-8 h-8 text-yellow-400" />
                                    <span className="text-4xl font-black text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                                        {raffle.prizePool ? formatEther(raffle.prizePool) : '0'} ETH
                                    </span>
                                </div>
                                <div className="mt-2 text-zinc-500 text-sm">
                                    ~ {raffle.prizePerWinner ? formatEther(raffle.prizePerWinner) : '0'} ETH per winner
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                    <span className="text-zinc-500 text-xs block mb-1">Time Left</span>
                                    <span className={`text-sm font-bold ${isEnded ? 'text-red-400' : 'text-white'}`}>
                                        {timeLeft}
                                    </span>
                                </div>
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                    <span className="text-zinc-500 text-xs block mb-1">Entry Limit</span>
                                    <span className="text-sm font-bold text-white">
                                        {raffle.maxTickets} Max
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-8">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-zinc-400 text-sm font-medium">Tickets Sold</span>
                                    <span className="text-white text-sm font-bold">{raffle.totalTickets} / {raffle.maxTickets}</span>
                                </div>
                                <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden border border-white/5 p-0.5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]"
                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Action Button & Quantity */}
                            {raffle.isFinalized ? (
                                <div className="space-y-4">
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
                                        <p className="text-green-400 font-bold mb-1">Raffle Finalized</p>
                                        <p className="text-green-400/70 text-xs">Winners have been drawn and prizes distributed.</p>
                                    </div>
                                    <button 
                                        onClick={() => navigate('/raffles')}
                                        className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition-all"
                                    >
                                        Back to Explore
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {raffle.isActive && !isEnded && (
                                        <div className="flex items-center justify-between bg-white/5 border border-white/10 p-2 rounded-2xl">
                                            <span className="text-zinc-400 text-sm font-bold ml-3 uppercase tracking-widest">Quantity</span>
                                            <div className="flex items-center bg-black/40 rounded-xl border border-white/5 p-1">
                                                <button 
                                                    onClick={() => setTicketAmount(p => Math.max(1, p - 1))}
                                                    disabled={ticketAmount <= 1 || isBuying}
                                                    className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-lg disabled:opacity-30 transition-all font-black text-xl"
                                                >
                                                    -
                                                </button>
                                                <span className="w-10 text-center font-mono font-black text-lg text-primary-400">
                                                    {ticketAmount}
                                                </span>
                                                <button 
                                                    onClick={() => setTicketAmount(p => p + 1)}
                                                    disabled={isBuying || ticketAmount >= (raffle.maxTickets - raffle.totalTickets)}
                                                    className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-lg disabled:opacity-30 transition-all font-black text-xl"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleBuy}
                                        disabled={isBuying || isEnded || !raffle.isActive}
                                        className={`w-full py-5 rounded-2xl font-black text-lg transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-3 ${
                                            isBuying 
                                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                                : isEnded
                                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 cursor-not-allowed'
                                                    : !raffle.isActive
                                                        ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 cursor-not-allowed'
                                                        : 'bg-primary-600 hover:bg-primary-500 text-white hover:shadow-primary-500/25'
                                        }`}
                                    >
                                        {isBuying ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                Processing...
                                            </>
                                        ) : isEnded ? (
                                            'Raffle Ended'
                                        ) : !raffle.isActive ? (
                                            'Awaiting Approval'
                                        ) : (
                                            <>
                                                <Ticket className="w-6 h-6" />
                                                Get {ticketAmount} Entries
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Footer info */}
                            <p className="mt-6 text-center text-zinc-500 text-xs px-4">
                                100% On-chain & Provably Fair. Results are powered by Chainlink VRF or Base QRNG.
                            </p>
                        </div>

                        {/* Requirements Card */}
                        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6">
                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4" /> Entry Requirements
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${raffle.min_sbt_level > 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-600'}`}>
                                            <Trophy className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-white uppercase tracking-wider">SBT Level {raffle.min_sbt_level || 0}+</p>
                                            <p className="text-[9px] text-zinc-500 font-bold uppercase">Reputation Check</p>
                                        </div>
                                    </div>
                                    <div className="text-zinc-600">
                                        <Lock className="w-3.5 h-3.5" />
                                    </div>
                                </div>

                                {raffle.is_base_social_required && (
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                                <Globe className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-blue-300 uppercase tracking-wider">Basenames Identity</p>
                                                <p className="text-[9px] text-blue-500/70 font-bold uppercase">Anti-Sybil Guard</p>
                                            </div>
                                        </div>
                                        {socialProfile?.isVerified ? (
                                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            </div>
                                        ) : (
                                            <div className="text-blue-500/40">
                                                <Lock className="w-3.5 h-3.5" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!socialProfile?.isVerified && raffle.is_base_social_required && (
                                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                        <p className="text-[9px] font-bold text-amber-500/80 leading-relaxed uppercase tracking-tight">
                                            You must link your Farcaster or Twitter account in your profile to participate.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sponsor Info Card */}
                        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6">
                            <span className="text-zinc-500 text-xs uppercase tracking-widest block mb-4">Presented By</span>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-black">
                                    {raffle.sponsor?.substring(2, 4).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold truncate">
                                        {raffle.sponsor}
                                    </p>
                                    <p className="text-zinc-500 text-sm">Raffle Sponsor</p>
                                </div>
                                <a 
                                    href={`https://sepolia.basescan.org/address/${raffle.sponsor}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default RaffleDetailPage;
