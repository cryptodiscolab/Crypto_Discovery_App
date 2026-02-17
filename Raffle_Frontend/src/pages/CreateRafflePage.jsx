import { useState, useMemo } from 'react';
import { Gift, Ticket, Calendar, Calculator, Info, CheckCircle2, ArrowRight, Loader2, DollarSign } from 'lucide-react';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { useRaffle } from '../hooks/useRaffle';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export function CreateRafflePage() {
    const { isConnected } = useAccount();
    const navigate = useNavigate();
    const { createSponsorshipRaffle } = useRaffle();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        prizeDeposit: '0.1',
        ticketPrice: '0.001',
        maxTickets: '200',
        winnerCount: '1',
        durationDays: '7',
        title: '',
        metadataURI: ''
    });

    // Calculator Logic
    const stats = useMemo(() => {
        const deposit = parseFloat(formData.prizeDeposit) || 0;
        const price = parseFloat(formData.ticketPrice) || 0;
        const tickets = parseInt(formData.maxTickets) || 0;

        const surcharge = deposit * 0.05;
        const totalPayment = deposit + surcharge;
        const totalRevenue = price * tickets;
        const projectRake = totalRevenue * 0.20;
        const sponsorPayback = totalRevenue * 0.80;

        return {
            surcharge: surcharge.toFixed(4),
            totalPayment: totalPayment.toFixed(4),
            totalRevenue: totalRevenue.toFixed(4),
            projectRake: projectRake.toFixed(4),
            sponsorPayback: sponsorPayback.toFixed(4),
            netReturn: (deposit + sponsorPayback).toFixed(4), // Fixed variable name
            profit: sponsorPayback.toFixed(4)
        };
    }, [formData]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.title) return toast.error("Please enter a title");

        setIsSubmitting(true);
        try {
            await createSponsorshipRaffle({
                winnerCount: formData.winnerCount,
                maxTickets: formData.maxTickets,
                durationDays: formData.durationDays,
                metadataURI: formData.metadataURI || `ipfs://raffle-${Date.now()}`,
                depositETH: parseEther(formData.prizeDeposit)
            });
            toast.success("Raffle Event Sponsored!");
            navigate('/raffles');
        } catch (err) {
            toast.error(err.shortMessage || "Creation failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
                <div className="text-center glass-card p-12 max-w-md w-full border border-white/5">
                    <Gift className="w-16 h-16 text-blue-500 mx-auto mb-6 opacity-20" />
                    <h2 className="text-2xl font-black text-white mb-2">Connect Wallet</h2>
                    <p className="text-slate-400 mb-8">You need to be connected to sponsor an event.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-20 px-4 bg-slate-950">
            <div className="container mx-auto max-w-5xl">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Form Section */}
                    <div className="flex-1 space-y-6">
                        <div className="mb-8">
                            <h1 className="text-3xl font-black text-white mb-2">Sponsor an Event</h1>
                            <p className="text-slate-400">Host your own NFT raffle and reach the community.</p>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="glass-card p-4 space-y-4 border-white/5">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Event Title</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Legendary CyberPunk Giveaway"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Prize Reward (ETH)</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                                                    value={formData.prizeDeposit}
                                                    onChange={e => setFormData({ ...formData, prizeDeposit: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Duration</label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                <select
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all appearance-none"
                                                    value={formData.durationDays}
                                                    onChange={e => setFormData({ ...formData, durationDays: e.target.value })}
                                                >
                                                    <option value="1">24 Hours</option>
                                                    <option value="3">3 Days</option>
                                                    <option value="7">7 Days</option>
                                                    <option value="14">14 Days</option>
                                                    <option value="25">25 Days (Max)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass-card p-4 space-y-4 border-white/5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Ticket Price (ETH)</label>
                                            <div className="relative">
                                                <Ticket className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                                                    value={formData.ticketPrice}
                                                    onChange={e => setFormData({ ...formData, ticketPrice: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Max Tickets</label>
                                            <input
                                                type="number"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                                                value={formData.maxTickets}
                                                onChange={e => setFormData({ ...formData, maxTickets: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full btn-primary py-4 text-lg font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    <>Sponsor Event Now <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Calculator Section */}
                    <div className="w-full md:w-[380px] space-y-4">
                        <div className="glass-card p-6 border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Calculator className="w-12 h-12 text-blue-400" />
                            </div>

                            <h3 className="text-xs font-black uppercase text-blue-400 tracking-[0.2em] mb-6 flex items-center gap-2">
                                <Info className="w-4 h-4" /> Earnings Calculator
                            </h3>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center group">
                                    <span className="text-slate-400 text-sm">Platform Fee (5%)</span>
                                    <span className="text-red-400 font-mono text-sm">+{stats.surcharge} ETH</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white font-bold text-sm">Initial Payment</span>
                                    <span className="text-white font-black font-mono">{stats.totalPayment} ETH</span>
                                </div>

                                <div className="h-px bg-white/10 my-4" />

                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-sm">Estimated Total Sales</span>
                                    <span className="text-emerald-400 font-mono text-sm">{stats.totalRevenue} ETH</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-sm">Project Rake (20%)</span>
                                    <span className="text-red-400 font-mono text-sm">-{stats.projectRake} ETH</span>
                                </div>

                                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 mt-4">
                                    <p className="text-[10px] font-black uppercase text-emerald-500 mb-1">Your Potential Profit</p>
                                    <p className="text-3xl font-black text-white font-mono">{stats.profit} <span className="text-xs text-slate-500 font-black">ETH</span></p>
                                    <p className="text-[9px] text-slate-500 mt-2 italic leading-tight">
                                        *You will receive your profit + original deposit ({formData.prizeDeposit} ETH) after the event ends.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Terms */}
                        <div className="glass-card p-4 border-white/5 bg-slate-900/40">
                            <ul className="space-y-3">
                                {[
                                    "English-speaking global audience support",
                                    "20% Service & Maintenance Fee applied",
                                    "Funds remain in contract until draw",
                                    "5% Transaction Fee applied at creation"
                                ].map((term, i) => (
                                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                        {term}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
