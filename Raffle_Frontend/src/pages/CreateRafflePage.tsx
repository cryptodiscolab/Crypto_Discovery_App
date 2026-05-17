import { useState, useMemo, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useRaffle } from '../hooks/useRaffle';
import { usePoints } from '../shared/context/PointsContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { CONTRACTS, MASTER_X_ABI, RAFFLE_ABI, WETH_ADDRESS } from '../lib/contracts';
import { usePriceOracle } from '../hooks/usePriceOracle';
import { ArrowRight, Calculator, CheckCircle2, ChevronDown, Clock, Gift, ImageIcon, Info, LinkIcon, Loader2, Lock, Shield, Tag, Twitter } from 'lucide-react';

const RafflePreview = ({ data }: { data: {
    imageUrl?: string;
    category: string;
    minSbtLevel: string;
    durationDays: string;
    title?: string;
    description?: string;
    twitterLink?: string;
    externalLink?: string;
    prizeDeposit?: string;
    ticketPrice?: string;
} }) => {
    return (
        <div className="glass-card overflow-hidden border-white/5 bg-slate-900/40 group">
            <div className="relative aspect-video bg-slate-800 flex items-center justify-center overflow-hidden">
                {data.imageUrl ? (
                    <img src={data.imageUrl} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                    <ImageIcon className="w-12 h-12 text-slate-700" />
                )}
                <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2 py-1 rounded bg-blue-500/80 backdrop-blur-md text-[11px] font-black text-white uppercase tracking-widest shadow-lg">
                        {data.category}
                    </span>
                    <span className="px-2 py-1 rounded bg-indigo-500/80 backdrop-blur-md text-[11px] font-black text-white uppercase tracking-widest shadow-lg">
                        LEVEL {data.minSbtLevel}+
                    </span>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                    <Clock className="w-2.5 h-2.5 text-blue-400" />
                    <span className="text-[11px] font-black text-white font-mono uppercase tracking-widest">
                        {data.durationDays}D REMAINING
                    </span>
                </div>
            </div>
            <div className="p-4 space-y-3">
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest truncate">{data.title || 'YOUR EVENT TITLE'}</h3>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest line-clamp-2 min-h-[32px]">
                    {data.description || 'ADD A STORY TO YOUR RAFFLE!'}
                </p>
                {(data.twitterLink || data.externalLink) && (
                    <div className="flex items-center gap-3 pt-1">
                        {data.twitterLink && (
                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest truncate max-w-[120px]">🐦 {data.twitterLink.replace(/https?:\/\/(www\.)?(x|twitter)\.com\/?/, '')}</span>
                        )}
                        {data.externalLink && (
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[120px]">🔗 LINK</span>
                        )}
                    </div>
                )}
                <div className="flex justify-between items-end pt-2 border-t border-white/5">
                    <div>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-0.5">PRIZE POOL</p>
                        <p className="text-[11px] font-black text-blue-400 font-mono tracking-widest">{parseFloat(data.prizeDeposit || '0').toFixed(2)} ETH</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-0.5">TICKET PRICE</p>
                        <p className="text-[11px] font-black text-indigo-400 font-mono tracking-widest">{parseFloat(data.ticketPrice || '0').toFixed(4)} ETH</p>
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
    const { ecosystemSettings } = usePoints();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Feature Flags Check
    const isMainnet = import.meta.env.VITE_CHAIN_ID === '8453';
    const isUgcFeatureEnabled = !isMainnet || (ecosystemSettings as { active_features?: { ugc_payment?: boolean } })?.active_features?.ugc_payment === true;

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

    const { prices } = usePriceOracle([WETH_ADDRESS]);
    const ethPrice = prices[WETH_ADDRESS] || 0;

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
        minSbtLevel: '0',
        isBaseSocialRequired: false
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
            price: price,
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

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title) return toast.error("Please enter a title");

        setIsSubmitting(true);
        const tid = toast.loading("Uploading metadata to IPFS...");
        try {
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

            // Upload to IPFS via backend API (Pinata JWT never exposed to client)
            let metadataURI = '';

            const res = await fetch("/api/pin-metadata", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metadata: fullMetadata,
                    name: `Raffle_${formData.title.replace(/\s+/g, '_')}.json`
                })
            });

            if (res.ok) {
                const data = await res.json();
                metadataURI = data.uri;
                toast.success("Metadata pinned to IPFS!", { id: tid });
            } else {
                // Pinata pin failed → block raffle creation rather than silently using non-permanent base64.
                // Inline base64 metadata is not durable and breaks on-chain NFT/raffle metadata expectations.
                console.error("[CreateRaffle] IPFS pin failed:", res.status, await res.text().catch(() => ''));
                toast.error("Metadata pin failed. Please retry or contact support.", { id: tid, duration: 8000 });
                setIsSubmitting(false);
                return;
            }

            toast.loading("Sending on-chain transaction...", { id: tid });
            await createSponsorshipRaffle({
                winnerCount: parseInt(formData.winnerCount),
                maxTickets: parseInt(formData.maxTickets),
                durationDays: parseInt(formData.durationDays),
                metadataURI: metadataURI,
                depositETH: parseEther(formData.prizeDeposit || '0'),
                extraMetadata: { ...fullMetadata, is_base_social_required: formData.isBaseSocialRequired }
            });
            toast.success("Raffle Event Sponsored! 🎲", { id: tid });
            navigate('/raffles');
        } catch (err: unknown) {
            const e = err as { shortMessage?: string; message?: string };
            toast.error(e.shortMessage || e.message || "Creation failed", { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
                <div className="text-center glass-card p-12 max-w-md w-full border border-white/5">
                    <Gift className="w-16 h-16 text-blue-500 mx-auto mb-6 opacity-20" />
                    <h2 className="text-[11px] font-black text-white uppercase tracking-widest mb-2">CONNECT WALLET</h2>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8">YOU NEED TO BE CONNECTED TO SPONSOR AN EVENT.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-28 md:pb-8 px-4 bg-slate-950">
            <div className="container mx-auto max-w-5xl">
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-6">
                        <div className="mb-8">
                            <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">SPONSOR AN EVENT</h1>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">HOST YOUR OWN NFT RAFFLE AND REACH THE DISCO COMMUNITY.</p>
                            {!isUgcFeatureEnabled && (
                                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-black uppercase text-[11px] tracking-widest flex items-center gap-2">
                                    <Shield className="w-5 h-5 font-black uppercase tracking-widest" />
                                    FEATURE ACCESSIBILITY: PHASE 4 MAINNET ROLLOUT ENFORCED.
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleCreate} className={`space-y-4 ${!isUgcFeatureEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="glass-card p-4 space-y-4 border-white/5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Event Title</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Legendary CyberPunk Giveaway"
                                                className="input-native"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="admin-label">Image URL</label>
                                            <div className="relative">
                                                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="url"
                                                    placeholder="https://example.com/image.png"
                                                    className="input-native pl-10"
                                                    value={formData.imageUrl}
                                                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-[#00ff88]">Description</label>
                                        <textarea
                                            placeholder="Tell the community about this prize and any requirements..."
                                            className="input-native min-h-[100px] resize-none"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-black text-indigo-400/60 uppercase tracking-widest">Prize Reward (ETH)</label>
                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    className="input-native font-mono text-base pr-4"
                                                    value={formData.prizeDeposit}
                                                    onChange={e => setFormData({ ...formData, prizeDeposit: e.target.value })}
                                                />
                                            </div>
                                            <p className="text-[10px] font-bold text-indigo-300/50 mt-1">≈ ${stats.depositUsd}</p>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Duration</label>
                                            <div className="select-wrapper">
                                                <select
                                                    className="select-native"
                                                    value={formData.durationDays}
                                                    onChange={e => setFormData({ ...formData, durationDays: e.target.value })}
                                                >
                                                    <option value="1">24 Hours</option>
                                                    <option value="3">3 Days</option>
                                                    <option value="7">7 Days</option>
                                                    <option value="14">14 Days</option>
                                                    <option value="25">25 Days (Max)</option>
                                                </select>
                                                <ChevronDown className="select-chevron w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass-card p-4 space-y-4 border-white/5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-indigo-400/60 tracking-widest mb-1.5 block">Ticket Price (ETH)</label>
                                            <input
                                                type="text"
                                                readOnly
                                                className="w-full bg-black/20 border border-white/5 rounded-2xl py-3 px-4 text-slate-400 focus:outline-none font-mono text-sm"
                                                value={formData.ticketPrice}
                                            />
                                            <p className="text-[10px] font-bold text-indigo-300/40 mt-1">FIXED BY ADMIN</p>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5 block">MAX TICKETS</label>
                                            <input
                                                type="number"
                                                className="input-native font-mono text-sm"
                                                value={formData.maxTickets}
                                                onChange={e => setFormData({ ...formData, maxTickets: e.target.value })}
                                            />
                                            <p className="text-[10px] font-bold text-slate-500/50 mt-1">CAP</p>
                                        </div>
                                    </div>

                                    {/* WINNER COUNT OPTION */}
                                    <div className="pt-4 border-t border-white/5">
                                        <label className="text-[11px] font-black uppercase text-amber-400/60 tracking-widest mb-1.5 block">Number of Winners</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            className="input-native font-mono text-base"
                                            value={formData.winnerCount}
                                            onChange={e => setFormData({ ...formData, winnerCount: e.target.value })}
                                        />
                                        <p className="text-[9px] font-bold text-slate-600 uppercase mt-2 tracking-tight">Prize pool will be split equally among all winners.</p>
                                    </div>
                                </div>

                                <div className="glass-card p-4 space-y-4 border-white/5 bg-indigo-500/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="w-4 h-4 text-indigo-400" />
                                        <h3 className="text-[11px] font-black uppercase text-indigo-400 tracking-widest">REQUIREMENTS & CATEGORY</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-[#00ff88]">Category</label>
                                            <div className="select-wrapper">
                                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" />
                                                <select
                                                    className="select-native pl-10"
                                                    value={formData.category}
                                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                >
                                                    <option value="NFT">NFT</option>
                                                    <option value="Gaming">Gaming</option>
                                                    <option value="DeFi">DeFi</option>
                                                    <option value="Social">Social</option>
                                                    <option value="Event">Event</option>
                                                </select>
                                                <ChevronDown className="select-chevron w-4 h-4" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-[#00ff88]">Min SBT Level</label>
                                            <div className="select-wrapper">
                                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" />
                                                <select
                                                    className="select-native pl-10"
                                                    value={formData.minSbtLevel}
                                                    onChange={e => setFormData({ ...formData, minSbtLevel: e.target.value })}
                                                >
                                                    <option value="0">Unrestricted</option>
                                                    <option value="1">Level 1+</option>
                                                    <option value="2">Level 2+</option>
                                                    <option value="3">Level 3+</option>
                                                </select>
                                                <ChevronDown className="select-chevron w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* IDENTITY GUARD (v3.42.0) */}
                                    <div className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between group ${formData.isBaseSocialRequired ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}
                                         onClick={() => setFormData(prev => ({ ...prev, isBaseSocialRequired: !prev.isBaseSocialRequired }))}>
                                        <div className="flex items-center gap-4 text-left">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${formData.isBaseSocialRequired ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-500'}`}>
                                                <Shield className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${formData.isBaseSocialRequired ? 'text-blue-400' : 'text-slate-500'}`}>Identity Guard</span>
                                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Require Basenames Verification</span>
                                            </div>
                                        </div>
                                        <div className={`w-10 h-5 rounded-full p-1 transition-colors ${formData.isBaseSocialRequired ? 'bg-blue-600' : 'bg-slate-800'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform transform ${formData.isBaseSocialRequired ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Twitter Link</label>
                                            <div className="relative">
                                                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="url"
                                                    placeholder="https://x.com/yourproject"
                                                    className="input-native pl-10"
                                                    value={formData.twitterLink}
                                                    onChange={e => setFormData({ ...formData, twitterLink: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">External Link</label>
                                            <div className="relative">
                                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="url"
                                                    placeholder="https://yourproject.com"
                                                    className="input-native pl-10"
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
                                disabled={isSubmitting || !isUgcFeatureEnabled}
                                className="btn-native btn-primary w-full"
                            >
                                {!isUgcFeatureEnabled ? (
                                    <>Feature Locked: Phase 4 <Lock className="w-5 h-5" /></>
                                ) : isSubmitting ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    <>Sponsor Event Now <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="w-full md:w-[380px] space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] px-1">LIVE PREVIEW</h3>
                            <RafflePreview data={formData} />
                        </div>

                        <div className="glass-card p-6 border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Calculator className="w-12 h-12 text-blue-400" />
                            </div>

                            <h3 className="text-[11px] font-black uppercase text-blue-400 tracking-[0.2em] mb-6 flex items-center gap-2">
                                <Info className="w-4 h-4 font-black uppercase tracking-widest" /> EARNINGS CALCULATOR
                            </h3>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center group">
                                    <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">GAS SURCHARGE ({(surchargeBP ? Number(surchargeBP)/100 : 5)}%)</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-red-400 font-mono text-[11px] font-black uppercase tracking-widest">+{stats.surcharge} ETH</span>
                                        <span className="text-[11px] text-red-400/50 font-mono font-black uppercase tracking-widest">≈ ${stats.surchargeUsd}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white font-black text-[11px] uppercase tracking-widest">INITIAL PAYMENT</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-white font-black font-mono text-[11px] uppercase tracking-widest">{stats.totalPayment} ETH</span>
                                        <span className="text-[11px] text-indigo-400 font-black uppercase tracking-widest">≈ ${stats.totalPaymentUsd} USDC</span>
                                    </div>
                                </div>

                                <div className="h-px bg-white/10 my-4" />

                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">ESTIMATED SALES</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-emerald-400 font-mono text-[11px] font-black uppercase tracking-widest">{stats.totalRevenue} ETH</span>
                                        <span className="text-[11px] text-emerald-400/50 font-mono font-black uppercase tracking-widest">≈ ${stats.totalRevenueUsd}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">PROJECT RAKE ({(maintenanceFeeBP ? Number(maintenanceFeeBP)/100 : 20)}%)</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-red-400 font-mono text-[11px] font-black uppercase tracking-widest">-{stats.projectRake} ETH</span>
                                        <span className="text-[11px] text-red-400/50 font-mono font-black uppercase tracking-widest">≈ ${stats.projectRakeUsd}</span>
                                    </div>
                                </div>

                                <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 mt-4 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                                    <p className="text-[11px] font-black uppercase text-indigo-400 mb-1 relative z-10 tracking-widest">YOUR POTENTIAL PROFIT</p>
                                    <div className="flex items-baseline gap-2 relative z-10">
                                        <p className="text-2xl font-black text-white font-mono uppercase tracking-widest">{stats.profit}</p>
                                        <span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">ETH</span>
                                    </div>
                                    <p className="text-[11px] font-black text-indigo-400 relative z-10 uppercase tracking-widest">≈ ${stats.profitUsd} USDC</p>
                                    <p className="text-[11px] font-black text-slate-500 mt-2 italic leading-tight uppercase tracking-widest">
                                        *YOU WILL RECEIVE YOUR PROFIT + ORIGINAL DEPOSIT ({formData.prizeDeposit} ETH) AFTER THE EVENT ENDS.
                                    </p>
                                </div>
                            </div>
                        </div>

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
