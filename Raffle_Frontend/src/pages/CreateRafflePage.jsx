import { useState, useMemo, useEffect } from 'react';
import { Gift, Ticket, Calendar, Calculator, Info, CheckCircle2, ArrowRight, Loader2, DollarSign, Image as ImageIcon, Link as LinkIcon, Twitter, Tag, Shield, Clock } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useRaffle } from '../hooks/useRaffle';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { CONTRACTS, MASTER_X_ABI, RAFFLE_ABI, APP_CONFIG } from '../lib/contracts';
import { usePriceOracle } from '../hooks/usePriceOracle';

const RafflePreview = ({ data, stats }) => {
    return (
        <div className="glass-card overflow-hidden border-white/5 bg-slate-900/40 group">
            <div className="relative aspect-video bg-slate-800 flex items-center justify-center overflow-hidden">
                {data.imageUrl ? (
                    <img src={data.imageUrl} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                    <ImageIcon className="w-12 h-12 text-slate-700" />
                )}
                <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2 py-1 rounded bg-blue-500/80 backdrop-blur-md text-[8px] font-black text-white uppercase tracking-tighter shadow-lg">
                        {data.category}
                    </span>
                    <span className="px-2 py-1 rounded bg-indigo-500/80 backdrop-blur-md text-[8px] font-black text-white uppercase tracking-tighter shadow-lg">
                        LEVEL {data.minSbtLevel}+
                    </span>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                    <Clock className="w-2.5 h-2.5 text-blue-400" />
                    <span className="text-[9px] font-black text-white font-mono uppercase tracking-tighter">
                        {data.durationDays}D REMAINING
                    </span>
                </div>
            </div>
            <div className="p-4 space-y-3">
                <h3 className="text-lg font-black text-white truncate">{data.title || 'Your Event Title'}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                    {data.description || 'No description provided yet. Add a story to your raffle!'}
                </p>
                <div className="flex justify-between items-end pt-2 border-t border-white/5">
                    <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Prize Pool</p>
                        <p className="text-sm font-black text-blue-400 font-mono tracking-tighter">{parseFloat(data.prizeDeposit || 0).toFixed(2)} ETH</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Ticket Price</p>
                        <p className="text-sm font-black text-indigo-400 font-mono tracking-tighter">{parseFloat(data.ticketPrice || 0).toFixed(4)} ETH</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export function CreateRafflePage() {
    const { isConnected } = useAccount();
    const navigate = useNavigate();
    const { createSponsorshipRaffle } = useRaffle();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: globalTicketPrice } = useReadContract({
        address: CONTRACTS.MASTER_X,
        abi: MASTER_X_ABI,
        functionName: 'getTicketPriceInETH',
    });

    const { data: maintenanceFeeBP } = useReadContract({
        address: CONTRACTS.RAFFLE,
        abi: RAFFLE_ABI,
        functionName: 'maintenanceFeeBP',
    });

    const { data: surchargeBP } = useReadContract({
        address: CONTRACTS.RAFFLE,
        abi: RAFFLE_ABI,
        functionName: 'surchargeBP',
    });

    const { prices } = usePriceOracle(['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee']);
    const ethPrice = prices['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'] || prices['0x4200000000000000000000000000000000000006'] || 0;

    const [formData, setFormData] = useState({
        prizeDeposit: '0.1',
        ticketPrice: '0.001',
        maxTickets: '200',
        winnerCount: '1',
        durationDays: '7',
        title: '',
        description: '',
        imageUrl: '',
        category: 'NFT',
        twitterLink: '',
        externalLink: '',
        minSbtLevel: '0'
    });

    // Sync manual ticketPrice with global price when it loads
    useEffect(() => {
        if (globalTicketPrice) {
            setFormData(prev => ({ ...prev, ticketPrice: formatEther(globalTicketPrice) }));
        }
    }, [globalTicketPrice]);

    // Calculator Logic
    const stats = useMemo(() => {
        const deposit = parseFloat(formData.prizeDeposit) || 0;
        const price = globalTicketPrice ? parseFloat(formatEther(globalTicketPrice)) : (parseFloat(formData.ticketPrice) || 0);
        const tickets = parseInt(formData.maxTickets) || 0;

        const sBP = surchargeBP ? Number(surchargeBP) : 500;
        const rBP = maintenanceFeeBP ? Number(maintenanceFeeBP) : 2000;

        const surcharge = deposit * (sBP / 10000);
        const totalPayment = deposit + surcharge;
        const totalRevenue = price * tickets;
        const projectRake = totalRevenue * (rBP / 10000);
        const sponsorPayback = totalRevenue * (1 - (rBP / 10000));

        return {
            price: price, // actual price being used
            priceUsd: (price * ethPrice).toFixed(4),
            depositUsd: (deposit * ethPrice).toFixed(2),
            surcharge: surcharge.toFixed(4),
            surchargeUsd: (surcharge * ethPrice).toFixed(4),
            totalPayment: totalPayment.toFixed(4),
            totalPaymentUsd: (totalPayment * ethPrice).toFixed(2),
            totalRevenue: totalRevenue.toFixed(4),
            totalRevenueUsd: (totalRevenue * ethPrice).toFixed(2),
            projectRake: projectRake.toFixed(4),
            projectRakeUsd: (projectRake * ethPrice).toFixed(4),
            sponsorPayback: sponsorPayback.toFixed(4),
            sponsorPaybackUsd: (sponsorPayback * ethPrice).toFixed(2),
            netReturn: (deposit + sponsorPayback).toFixed(4),
            profit: sponsorPayback.toFixed(4),
            profitUsd: (sponsorPayback * ethPrice).toFixed(2)
        };
    }, [formData, globalTicketPrice, ethPrice, maintenanceFeeBP, surchargeBP]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.title) return toast.error("Please enter a title");

        setIsSubmitting(true);
        try {
            // Construct rich metadata
            const fullMetadata = {
                title: formData.title,
                description: formData.description,
                image: formData.imageUrl,
                category: formData.category,
                external_link: formData.externalLink,
                twitter: formData.twitterLink,
                min_sbt_level: parseInt(formData.minSbtLevel),
                created_at: new Date().toISOString()
            };

            // For now, we use a base64 encoded JSON as metadataURI to save on-chain 
            // and allow the backend to parse it during sync.
            const metadataStr = JSON.stringify(fullMetadata);
            const metadataURI = `data:application/json;base64,${btoa(unescape(encodeURIComponent(metadataStr)))}`;

            await createSponsorshipRaffle({
                winnerCount: formData.winnerCount,
                maxTickets: formData.maxTickets,
                durationDays: formData.durationDays,
                metadataURI: metadataURI,
                depositETH: parseEther(formData.prizeDeposit || '0'),
                // Pass extra metadata for backend sync
                extraMetadata: fullMetadata
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Image URL</label>
                                            <div className="relative">
                                                <ImageIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="url"
                                                    placeholder="https://example.com/image.png"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                                    value={formData.imageUrl}
                                                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Description</label>
                                        <textarea
                                            placeholder="Tell the community about this prize and any requirements..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium min-h-[100px] resize-none"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-indigo-400/60 tracking-widest mb-1.5 block">Prize Reward (ETH)</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <DollarSign className="w-4 h-4 text-indigo-500/50 group-focus-within:text-indigo-400 transition-colors" />
                                                </div>
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-10 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-mono text-lg"
                                                    value={formData.prizeDeposit}
                                                    onChange={e => setFormData({ ...formData, prizeDeposit: e.target.value })}
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    <span className="text-[10px] font-black text-indigo-300/40 uppercase tracking-tighter">
                                                        ≈ ${stats.depositUsd}
                                                    </span>
                                                </div>
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
                                            <label className="text-[10px] font-black uppercase text-indigo-400/60 tracking-widest mb-1.5 block">Ticket Price (ETH)</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Ticket className="w-4 h-4 text-indigo-500/50 group-focus-within:text-indigo-400 transition-colors" />
                                                </div>
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    readOnly
                                                    className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-10 pr-4 text-slate-400 focus:outline-none font-mono"
                                                    value={formData.ticketPrice}
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    <span className="text-[10px] font-black text-indigo-300/40 uppercase tracking-tighter">
                                                        FIXED
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Max Tickets</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                                                    value={formData.maxTickets}
                                                    onChange={e => setFormData({ ...formData, maxTickets: e.target.value })}
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                                                        CAP
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass-card p-4 space-y-4 border-white/5 bg-indigo-500/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="w-4 h-4 text-indigo-400" />
                                        <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Syarat & Kategorisasi</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Category</label>
                                            <div className="relative">
                                                <Tag className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                <select
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all appearance-none"
                                                    value={formData.category}
                                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                >
                                                    <option value="NFT">NFT</option>
                                                    <option value="Gaming">Gaming</option>
                                                    <option value="DeFi">DeFi</option>
                                                    <option value="Social">Social</option>
                                                    <option value="Event">Event</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Min SBT Level</label>
                                            <div className="relative">
                                                <Shield className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                <select
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all appearance-none"
                                                    value={formData.minSbtLevel}
                                                    onChange={e => setFormData({ ...formData, minSbtLevel: e.target.value })}
                                                >
                                                    <option value="0">Unrestricted</option>
                                                    <option value="1">Level 1+</option>
                                                    <option value="2">Level 2+</option>
                                                    <option value="3">Level 3+</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Twitter Link</label>
                                            <div className="relative">
                                                <Twitter className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="url"
                                                    placeholder="https://x.com/yourproject"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                                    value={formData.twitterLink}
                                                    onChange={e => setFormData({ ...formData, twitterLink: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">External Link</label>
                                            <div className="relative">
                                                <LinkIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="url"
                                                    placeholder="https://yourproject.com"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                                    value={formData.externalLink}
                                                    onChange={e => setFormData({ ...formData, externalLink: e.target.value })}
                                                />
                                            </div>
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

                    {/* Calculator & Preview Section */}
                    <div className="w-full md:w-[380px] space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1">Live Preview</h3>
                            <RafflePreview data={formData} stats={stats} />
                        </div>

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
                                    <div className="flex flex-col items-end">
                                        <span className="text-red-400 font-mono text-sm">+{stats.surcharge} ETH</span>
                                        <span className="text-[10px] text-red-400/50 font-mono">≈ ${stats.surchargeUsd}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white font-bold text-sm">Initial Payment</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-white font-black font-mono">{stats.totalPayment} ETH</span>
                                        <span className="text-[10px] text-indigo-400 font-black">≈ ${stats.totalPaymentUsd} USDC</span>
                                    </div>
                                </div>

                                <div className="h-px bg-white/10 my-4" />

                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-sm">Estimated Total Sales</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-emerald-400 font-mono text-sm">{stats.totalRevenue} ETH</span>
                                        <span className="text-[10px] text-emerald-400/50 font-mono">≈ ${stats.totalRevenueUsd}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-sm">Project Rake (20%)</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-red-400 font-mono text-sm">-{stats.projectRake} ETH</span>
                                        <span className="text-[10px] text-red-400/50 font-mono">≈ ${stats.projectRakeUsd}</span>
                                    </div>
                                </div>

                                <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 mt-4 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                                    <p className="text-[10px] font-black uppercase text-indigo-400 mb-1 relative z-10">Your Potential Profit</p>
                                    <div className="flex items-baseline gap-2 relative z-10">
                                        <p className="text-3xl font-black text-white font-mono">{stats.profit}</p>
                                        <span className="text-xs text-slate-500 font-black">ETH</span>
                                    </div>
                                    <p className="text-sm font-black text-indigo-400 relative z-10">≈ ${stats.profitUsd} USDC</p>
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
                                    `Project Rake (${(maintenanceFeeBP ? Number(maintenanceFeeBP) : 2000) / 100}%) applied`,
                                    "Funds remain in contract until draw",
                                    `${(surchargeBP ? Number(surchargeBP) : 500) / 100}% Transaction Fee applied at creation`
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
