import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Power, Zap, TrendingUp, Info, DollarSign, Activity, ShieldCheck, Database, Link as LinkIcon } from 'lucide-react';
import { useNFTTiers } from '../../../hooks/useNFTTiers';
import { useSBT } from '../../../hooks/useSBT';
import { formatEther, parseEther } from 'viem';
import toast from 'react-hot-toast';

export function NFTConfigTab({ ethPrice }) {
    const { tiers, economy, updateTierConfig, updateBatchConfig, updateTierURI, toggleTier, updateEconomy, refetch } = useNFTTiers();
    const {
        totalPoolBalance,
        totalLockedRewards,
        refetchAll: refetchMaster,
        diamondWeight,
        platinumWeight,
        goldWeight,
        silverWeight,
        bronzeWeight,
        setTierWeights
    } = useSBT();

    const [localConfigs, setLocalConfigs] = useState([]);
    const [localEco, setLocalEco] = useState({ tokenP: "0", b: 0, s: 0, g: 0 });
    const [localWeights, setLocalWeights] = useState({ d: 0, p: 0, g: 0, s: 0, b: 0 });
    const [isSaving, setIsSaving] = useState(null);

    useEffect(() => {
        if (tiers && tiers.length > 0) {
            setLocalConfigs(tiers.map(t => ({
                ...t,
                mintPriceETH: formatEther(t.mintPrice || 0n),
                localURI: t.uri || ''
            })));
        }
        if (economy) {
            setLocalEco({
                tokenP: economy.tokenPriceUSD,
                b: economy.packs.bronze,
                s: economy.packs.silver,
                g: economy.packs.gold
            });
        }
        if (diamondWeight !== undefined) {
            setLocalWeights({
                d: diamondWeight,
                p: platinumWeight,
                g: goldWeight,
                s: silverWeight,
                b: bronzeWeight
            });
        }
    }, [tiers, economy, diamondWeight, platinumWeight, goldWeight, silverWeight, bronzeWeight]);

    const handleUpdate = async (tier) => {
        const tid = toast.loading(`Updating ${tier.name} Config...`);
        setIsSaving(tier.id);
        try {
            await updateTierConfig(
                tier.id,
                tier.pointsRequired,
                parseEther(tier.mintPriceETH),
                tier.multiplierBP,
                tier.dailyBonus,
                tier.maxSupply,
                tier.isOpen
            );
            toast.success(`${tier.name} Config Updated!`, { id: tid });
            refetch();
        } catch (e) {
            toast.error(e.shortMessage || "Update failed", { id: tid });
        } finally {
            setIsSaving(null);
        }
    };

    const handleUpdateURI = async (tier) => {
        const tid = toast.loading(`Updating ${tier.name} URI...`);
        try {
            await updateTierURI(tier.id, tier.localURI);
            toast.success(`${tier.name} Metadata URI Updated!`, { id: tid });
            refetch();
        } catch (e) {
            toast.error(e.shortMessage || "URI Update failed", { id: tid });
        }
    };

    const handleSaveBatch = async () => {
        const tid = toast.loading("Finalizing Master Parameters (Batch)...");
        try {
            const ids = localConfigs.map(t => t.id);
            const points = localConfigs.map(t => BigInt(t.pointsRequired));
            const prices = localConfigs.map(t => parseEther(t.mintPriceETH));
            const bonuses = localConfigs.map(t => BigInt(t.dailyBonus));
            const multipliers = localConfigs.map(t => BigInt(t.multiplierBP));
            const supplies = localConfigs.map(t => BigInt(t.maxSupply));
            const opens = localConfigs.map(t => t.isOpen);

            await updateBatchConfig(ids, points, prices, bonuses, multipliers, supplies, opens);
            toast.success("Master Economic Parameters Finalized!", { id: tid });
            refetch();
        } catch (e) {
            toast.error(e.shortMessage || "Batch update failed", { id: tid });
        }
    };

    const handleToggle = async (tier) => {
        const tid = toast.loading(`${tier.isOpen ? 'Closing' : 'Opening'} ${tier.name} Tier...`);
        try {
            await toggleTier(tier.id, !tier.isOpen);
            toast.success(`${tier.name} status updated!`, { id: tid });
            refetch();
        } catch (e) {
            toast.error(e.shortMessage || "Action failed", { id: tid });
        }
    };

    const getUSD = (eth) => {
        if (!ethPrice || isNaN(parseFloat(eth))) return "0.00";
        return (parseFloat(eth) * ethPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleSaveEconomy = async () => {
        const tid = toast.loading("Updating Global Economics...");
        try {
            await updateEconomy(localEco.tokenP, localEco.b, localEco.s, localEco.g);
            toast.success("Global Economics Updated!", { id: tid });
            refetch();
        } catch (e) {
            toast.error(e.shortMessage || "Update failed", { id: tid });
        }
    };

    const handleSaveWeights = async () => {
        const sum = localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b;
        if (sum !== 100) {
            return toast.error(`Total weight must be 100%! Current: ${sum}%`);
        }

        const tid = toast.loading("Updating Distribution Weights...");
        try {
            await setTierWeights(localWeights.d, localWeights.p, localWeights.g, localWeights.s, localWeights.b);
            toast.success("Revenue Weights Updated!", { id: tid });
            refetchMaster();
        } catch (e) {
            toast.error(e.shortMessage || "Weight update failed", { id: tid });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in text-left">
            {/* Header with ETH Price */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-indigo-500/10 p-6 rounded-2xl border border-indigo-500/20">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-400" /> NFT Economy & SBT Assets
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Manage economic parameters, metadata URIs, and global pool health.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => { refetch(); refetchMaster(); }} className="p-3 bg-black/40 border border-white/10 rounded-xl hover:bg-slate-800 transition-all text-white">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <div className="bg-black/40 px-4 py-2 rounded-xl border border-indigo-500/30 flex items-center gap-3">
                        <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Live ETH Price</p>
                            <p className="text-lg font-mono font-bold text-white">${ethPrice?.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Health Hub (Admin P&L) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <Database className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">SBT Reward Pool</span>
                    </div>
                    <div>
                        <p className="text-2xl font-mono font-bold text-white">{formatEther(totalPoolBalance)} ETH</p>
                        <p className="text-[10px] text-slate-500 font-bold">Total revenue collected from mints/upgrades.</p>
                    </div>
                </div>
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Locked Liabilities</span>
                    </div>
                    <div>
                        <p className="text-2xl font-mono font-bold text-white">{formatEther(totalLockedRewards)} ETH</p>
                        <p className="text-[10px] text-slate-500 font-bold">Reserved for outstanding user reward claims.</p>
                    </div>
                </div>
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <Activity className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Net Surplus</span>
                    </div>
                    <div>
                        <p className="text-2xl font-mono font-bold text-white">{formatEther(totalPoolBalance - totalLockedRewards)} ETH</p>
                        <p className="text-[10px] text-slate-500 font-bold">Unallocated funds available in treasury.</p>
                    </div>
                </div>
            </div>

            {/* Global Economy & Batch Save */}
            <div className="glass-card p-6 rounded-3xl border border-white/5 bg-slate-900/40 space-y-6">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Settings className="w-4 h-4 text-slate-400" /> Global Economic Core
                    </h4>
                    <button
                        onClick={handleSaveBatch}
                        className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl font-black text-[10px] text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                    >
                        <ShieldCheck className="w-4 h-4" /> FINAL SOURCE RUN (BATCH SAVE ALL TIERS)
                    </button>
                </div>
                <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Token Price (USD)</label>
                            <input
                                type="number"
                                value={localEco.tokenP}
                                step="0.0001"
                                onChange={e => setLocalEco({ ...localEco, tokenP: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sponsor: Bronze (USD)</label>
                            <input
                                type="number"
                                value={localEco.b}
                                onChange={e => setLocalEco({ ...localEco, b: parseInt(e.target.value) })}
                                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sponsor: Silver (USD)</label>
                            <input
                                type="number"
                                value={localEco.s}
                                onChange={e => setLocalEco({ ...localEco, s: parseInt(e.target.value) })}
                                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sponsor: Gold (USD)</label>
                            <input
                                type="number"
                                value={localEco.g}
                                onChange={e => setLocalEco({ ...localEco, g: parseInt(e.target.value) })}
                                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSaveEconomy}
                        className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-xl font-black text-xs text-white transition-all shadow-lg shadow-emerald-600/20"
                    >
                        Save Economy
                    </button>
                </div>
            </div>

            {/* SBT REVENUE DISTRIBUTION (WEIGHTS) */}
            <div className="glass-card p-6 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 space-y-6">
                <div className="flex justify-between items-center border-b border-indigo-500/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                            <Layers className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-widest">SBT Shared Weights</h4>
                            <p className="text-[10px] text-slate-500 font-bold">% Share of SBT Reward Pool per Tier</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveWeights}
                        className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl font-black text-[10px] text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> SAVE REVENUE SPLIT
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                            Diamond (Lv5) (%)
                        </label>
                        <input
                            type="number"
                            value={localWeights.d}
                            onChange={e => setLocalWeights({ ...localWeights, d: parseInt(e.target.value) || 0 })}
                            className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Platinum (Lv4) (%)</label>
                        <input
                            type="number"
                            value={localWeights.p}
                            onChange={e => setLocalWeights({ ...localWeights, p: parseInt(e.target.value) || 0 })}
                            className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-400 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Gold (Lv3) (%)</label>
                        <input
                            type="number"
                            value={localWeights.g}
                            onChange={e => setLocalWeights({ ...localWeights, g: parseInt(e.target.value) || 0 })}
                            className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-yellow-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Silver (Lv2) (%)</label>
                        <input
                            type="number"
                            value={localWeights.s}
                            onChange={e => setLocalWeights({ ...localWeights, s: parseInt(e.target.value) || 0 })}
                            className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-slate-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Bronze (Lv1) (%)</label>
                        <input
                            type="number"
                            value={localWeights.b}
                            onChange={e => setLocalWeights({ ...localWeights, b: parseInt(e.target.value) || 0 })}
                            className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-orange-500 outline-none"
                        />
                    </div>
                </div>

                <div className={`p-4 rounded-2xl flex items-center justify-between border ${localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <div className="flex items-center gap-2">
                        <Info className={`w-4 h-4 ${localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? 'text-emerald-400' : 'text-red-400'}`} />
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                            Current Total: {localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b}%
                        </span>
                    </div>
                    <span className={`text-[10px] font-black uppercase ${localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? 'text-emerald-400' : 'text-red-400 animation-pulse'}`}>
                        {localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? '✅ Valid Ratio' : '❌ Total must be 100%'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {localConfigs.map((tier, idx) => (
                    <div key={tier.id} className={`glass-card p-8 rounded-3xl border transition-all ${tier.isOpen ? 'border-white/5 bg-slate-900/40' : 'border-red-500/20 bg-red-950/5 grayscale-[0.5]'}`}>
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Left: Branding & Status */}
                            <div className="lg:w-1/4 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${tier.name === 'Diamond' ? 'bg-blue-500/20 text-blue-400 shadow-blue-500/10' :
                                        tier.name === 'Platinum' ? 'bg-indigo-300/20 text-indigo-300' :
                                            tier.name === 'Gold' ? 'bg-yellow-400/20 text-yellow-500 shadow-yellow-500/10' :
                                                tier.name === 'Silver' ? 'bg-slate-300/20 text-slate-300' : 'bg-orange-400/20 text-orange-400'
                                        }`}>
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-black text-white">{tier.name}</h4>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Level {tier.id}</p>
                                    </div>
                                </div>

                                <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${tier.isOpen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {tier.isOpen ? 'Active' : 'Disabled'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Supply</span>
                                        <span className="text-xs font-mono text-white font-bold">{tier.currentSupply} / {tier.maxSupply}</span>
                                    </div>

                                    <button
                                        onClick={() => handleToggle(tier)}
                                        className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-xs transition-all ${tier.isOpen
                                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                            }`}
                                    >
                                        <Power className="w-3 h-3" /> {tier.isOpen ? 'Turn OFF' : 'Turn ON'}
                                    </button>
                                </div>
                            </div>

                            {/* Center: Main Settings */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    {/* Price Config */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            <DollarSign className="w-3 h-3" /> Minting Price (ETH)
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                value={tier.mintPriceETH}
                                                step="0.001"
                                                onChange={(e) => {
                                                    const updated = [...localConfigs];
                                                    updated[idx].mintPriceETH = e.target.value;
                                                    setLocalConfigs(updated);
                                                }}
                                                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-lg focus:border-indigo-500 outline-none transition-all"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold">ETH</div>
                                        </div>
                                        <div className="px-3 py-1 bg-indigo-500/5 rounded-lg border border-indigo-500/10 flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-indigo-400/50 uppercase">USD Est.</span>
                                            <span className="text-xs font-bold text-indigo-400 font-mono">${getUSD(tier.mintPriceETH)}</span>
                                        </div>
                                    </div>

                                    {/* Points Config */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            XP Required for Level Up
                                        </label>
                                        <input
                                            type="number"
                                            value={tier.pointsRequired}
                                            onChange={(e) => {
                                                const updated = [...localConfigs];
                                                updated[idx].pointsRequired = Math.max(0, parseInt(e.target.value) || 0);
                                                setLocalConfigs(updated);
                                            }}
                                            className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-mono text-lg focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Metadata URI */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            <LinkIcon className="w-3 h-3" /> Metadata URI (IPFS/JSON)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="https://ipfs.io/ipfs/..."
                                                value={tier.localURI}
                                                onChange={(e) => {
                                                    const updated = [...localConfigs];
                                                    updated[idx].localURI = e.target.value;
                                                    setLocalConfigs(updated);
                                                }}
                                                className="flex-1 bg-black/40 border border-white/10 p-2.5 rounded-xl text-white font-mono text-[10px] focus:border-indigo-500 outline-none transition-all"
                                            />
                                            <button
                                                onClick={() => handleUpdateURI(tier)}
                                                className="bg-slate-800 hover:bg-slate-700 p-2.5 rounded-xl text-indigo-400"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Multiplier BP</label>
                                            <input
                                                type="number"
                                                value={tier.multiplierBP}
                                                onChange={(e) => {
                                                    const updated = [...localConfigs];
                                                    updated[idx].multiplierBP = Math.max(10000, parseInt(e.target.value) || 10000);
                                                    setLocalConfigs(updated);
                                                }}
                                                className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-white font-mono text-xs focus:border-indigo-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Daily Bonus</label>
                                            <input
                                                type="number"
                                                value={tier.dailyBonus}
                                                onChange={(e) => {
                                                    const updated = [...localConfigs];
                                                    updated[idx].dailyBonus = Math.max(0, parseInt(e.target.value) || 0);
                                                    setLocalConfigs(updated);
                                                }}
                                                className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-white font-mono text-xs focus:border-indigo-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Max Supply Cap</label>
                                        <input
                                            type="number"
                                            value={tier.maxSupply}
                                            onChange={(e) => {
                                                const updated = [...localConfigs];
                                                updated[idx].maxSupply = Math.max(0, parseInt(e.target.value) || 0);
                                                setLocalConfigs(updated);
                                            }}
                                            className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-white font-mono text-xs focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="lg:w-auto flex items-end">
                                <button
                                    onClick={() => handleUpdate(tier)}
                                    disabled={isSaving === tier.id}
                                    className="w-full lg:w-32 h-14 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-2xl font-black text-xs text-white flex flex-col items-center justify-center gap-1 transition-all shadow-lg shadow-indigo-600/20"
                                >
                                    {isSaving === tier.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>Update Tech</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/5 flex gap-4 items-start">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-white uppercase tracking-tight">System Security Note</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                        Changes to Tier parameters are recorded on-chain. <span className="text-indigo-400 font-bold">Metadata URI</span> is what users see in Marketplaces (OpenSea). Use <span className="font-bold text-white">Batch Save</span> to finalize all tier economics in a single transaction before official launch.
                    </p>
                </div>
            </div>
        </div>
    );
}
