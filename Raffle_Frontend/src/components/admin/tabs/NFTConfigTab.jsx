import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Power, Zap, TrendingUp, Info, DollarSign, Activity, ShieldCheck, Database, Layers, Link as LinkIcon } from 'lucide-react';
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
    const [localEco, setLocalEco] = useState({ 
        tokenP: "0",
        p1: "0",
        p2: "0",
        p3: "0",
        p4: "0",
        p5: "0"
    });
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
        if (economy && tiers.length >= 5) {
            setLocalEco({
                tokenP: economy.tokenPriceUSD,
                p1: getUSD(formatEther(tiers[0].mintPrice)),
                p2: getUSD(formatEther(tiers[1].mintPrice)),
                p3: getUSD(formatEther(tiers[2].mintPrice)),
                p4: getUSD(formatEther(tiers[3].mintPrice)),
                p5: getUSD(formatEther(tiers[4].mintPrice))
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
        if (Number(tier.multiplierBP) > 15000) {
            return toast.error("CRITICAL: Multiplier cannot exceed 1.5x (15000 BP) per V2 Economics");
        }

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
        const hasInvalidMultiplier = localConfigs.some(t => Number(t.multiplierBP) > 15000);
        if (hasInvalidMultiplier) {
            return toast.error("CRITICAL: One or more tiers exceed the 1.5x (15000 BP) max multiplier limit!");
        }

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
        const tid = toast.loading("Finalizing Global Economics & Tier Pricing...");
        try {
            // 1. Update Token Price
            await updateEconomy(localEco.tokenP);

            // 2. Prepare Batch Update for Mint Prices (converting USD -> ETH)
            if (ethPrice > 0) {
                const ids = [1, 2, 3, 4, 5];
                const points = localConfigs.map(t => BigInt(t.pointsRequired));
                
                // Inverse calculation: USD / ethPrice = ETH
                const prices = [
                    parseEther((parseFloat(localEco.p1.replace(/,/g, '')) / ethPrice).toFixed(6)),
                    parseEther((parseFloat(localEco.p2.replace(/,/g, '')) / ethPrice).toFixed(6)),
                    parseEther((parseFloat(localEco.p3.replace(/,/g, '')) / ethPrice).toFixed(6)),
                    parseEther((parseFloat(localEco.p4.replace(/,/g, '')) / ethPrice).toFixed(6)),
                    parseEther((parseFloat(localEco.p5.replace(/,/g, '')) / ethPrice).toFixed(6))
                ];
                
                const bonuses = localConfigs.map(t => BigInt(t.dailyBonus));
                const multipliers = localConfigs.map(t => BigInt(t.multiplierBP));
                const supplies = localConfigs.map(t => BigInt(t.maxSupply));
                const opens = localConfigs.map(t => t.isOpen);

                await updateBatchConfig(ids, points, prices, bonuses, multipliers, supplies, opens);
            }

            // 3. Sync Multipliers to DB for off-chain XP boosting
            const multiplierMap = {};
            localConfigs.forEach(t => {
                multiplierMap[t.id] = Number(t.multiplierBP);
            });

            const syncMsg = `Action: SYNC_MULTIPLIERS\nTimestamp: ${Date.now()}`;
            const sig = await window.ethereum.request({
                method: 'personal_sign',
                params: [syncMsg, address.toLowerCase()],
            });

            await axios.post('/api/admin-bundle', {
                action: 'SYNC_MULTIPLIERS',
                wallet_address: address,
                signature: sig,
                message: syncMsg,
                payload: multiplierMap
            });

            toast.success("Global Economics & SBT Multipliers Updated!", { id: tid });
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
            <div className="bg-[#0A0A0A] p-8 rounded-2xl border border-white/5 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-6">
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Settings className="w-4 h-4 text-indigo-400" /> Economic Core
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1">Global parameters affecting all tier logic.</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                        <button
                            onClick={async () => {
                                const tid = toast.loading("Syncing Multipliers...");
                                try {
                                    const multiplierMap = {};
                                    tiers.forEach(t => { multiplierMap[t.id] = Number(t.multiplierBP); });
                                    const syncMsg = `Action: SYNC_MULTIPLIERS\nTimestamp: ${Date.now()}`;
                                    const sig = await window.ethereum.request({ method: 'personal_sign', params: [syncMsg, address.toLowerCase()] });
                                    await axios.post('/api/admin-bundle', { action: 'SYNC_MULTIPLIERS', wallet_address: address, signature: sig, message: syncMsg, payload: multiplierMap });
                                    toast.success("Multipliers Synced to DB!", { id: tid });
                                } catch (e) { toast.error("Sync failed", { id: tid }); }
                            }}
                            className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-[10px] text-indigo-400 border border-indigo-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-3 h-3" /> SYNC MULTIPLIERS
                        </button>
                        <button
                            onClick={handleSaveBatch}
                            className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                        >
                            <ShieldCheck className="w-4 h-4" /> BATCH SAVE ALL TIERS
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Token Price ($DISCO)</label>
                        <input
                            type="number"
                            step="0.0001"
                            value={localEco.tokenP}
                            onChange={e => setLocalEco({ ...localEco, tokenP: e.target.value })}
                            className="w-full bg-[#111111] border border-white/5 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-500/50 outline-none transition-all"
                        />
                    </div>
                    {[
                        { label: 'Bronze SBT (USD)', key: 'p1' },
                        { label: 'Silver SBT (USD)', key: 'p2' },
                        { label: 'Gold SBT (USD)', key: 'p3' },
                        { label: 'Platinum SBT (USD)', key: 'p4' },
                        { label: 'Diamond SBT (USD)', key: 'p5' }
                    ].map((item) => (
                        <div key={item.key} className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</label>
                            <input
                                type="text"
                                value={localEco[item.key]}
                                onChange={e => setLocalEco({ ...localEco, [item.key]: e.target.value })}
                                className="w-full bg-[#111111] border border-white/5 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-500/50 outline-none transition-all"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSaveEconomy}
                        className="w-full md:w-auto bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-10 py-3 rounded-xl font-bold text-xs text-emerald-400 transition-all"
                    >
                        Save Economics & Prices
                    </button>
                </div>
            </div>

            {/* SBT REVENUE DISTRIBUTION (WEIGHTS) */}
            <div className="bg-[#0A0A0A] p-8 rounded-2xl border border-indigo-500/10 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                            <Layers className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-widest">Reward Weights</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">% Share of SBT Reward Pool per Tier</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveWeights}
                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" /> SAVE WEIGHTS
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                    {[
                        { label: 'Diamond', key: 'd', color: 'text-blue-400', border: 'focus:border-blue-500/50' },
                        { label: 'Platinum', key: 'p', color: 'text-indigo-400', border: 'focus:border-indigo-500/50' },
                        { label: 'Gold', key: 'g', color: 'text-amber-400', border: 'focus:border-amber-500/50' },
                        { label: 'Silver', key: 's', color: 'text-slate-400', border: 'focus:border-slate-500/50' },
                        { label: 'Bronze', key: 'b', color: 'text-orange-400', border: 'focus:border-orange-500/50' }
                    ].map((t) => (
                        <div key={t.key} className="space-y-2">
                            <label className={`text-[11px] font-bold uppercase tracking-wider ${t.color}`}>{t.label} (%)</label>
                            <input
                                type="number"
                                value={localWeights[t.key]}
                                onChange={e => setLocalWeights({ ...localWeights, [t.key]: parseInt(e.target.value) || 0 })}
                                className={`w-full bg-[#111111] border border-white/5 p-3 rounded-xl text-white font-mono text-sm outline-none transition-all ${t.border}`}
                            />
                        </div>
                    ))}
                </div>

                <div className={`p-4 rounded-xl flex items-center justify-between border ${localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                    <div className="flex items-center gap-3">
                        <Info className={`w-4 h-4 shrink-0 ${localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? 'text-emerald-400' : 'text-red-400'}`} />
                        <p className="text-[11px] font-bold text-slate-400">
                            CURRENT TOTAL: <span className={localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? 'text-emerald-400' : 'text-red-400'}>{localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b}%</span>
                        </p>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`}>
                        {localWeights.d + localWeights.p + localWeights.g + localWeights.s + localWeights.b === 100 ? '✓ Valid' : '× Error'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {localConfigs.map((tier, idx) => (
                    <div key={tier.id} className={`p-8 rounded-2xl border transition-all ${tier.isOpen ? 'border-white/5 bg-[#0A0A0A]' : 'border-red-500/10 bg-red-500/5 grayscale-[0.5]'}`}>
                        <div className="flex flex-col lg:flex-row gap-10">
                            {/* Left: Branding & Status */}
                            <div className="lg:w-48 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${tier.name === 'Diamond' ? 'bg-blue-500/10 text-blue-400' :
                                        tier.name === 'Platinum' ? 'bg-indigo-300/10 text-indigo-300' :
                                            tier.name === 'Gold' ? 'bg-yellow-400/10 text-yellow-500' :
                                                tier.name === 'Silver' ? 'bg-slate-300/10 text-slate-300' : 'bg-orange-400/10 text-orange-400'
                                        }`}>
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-white">{tier.name}</h4>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Level {tier.id}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Supply</span>
                                        <span className="text-xs font-mono text-white font-bold">{tier.currentSupply} / {tier.maxSupply}</span>
                                    </div>
                                    <button
                                        onClick={() => handleToggle(tier)}
                                        className={`w-full py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${tier.isOpen
                                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                            }`}
                                    >
                                        {tier.isOpen ? 'Disable Tier' : 'Enable Tier'}
                                    </button>
                                </div>
                            </div>

                            {/* Center: Main Settings */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    {/* Price Config */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Minting Price (ETH)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={tier.mintPriceETH}
                                                step="0.001"
                                                onChange={(e) => {
                                                    const updated = [...localConfigs];
                                                    updated[idx].mintPriceETH = e.target.value;
                                                    setLocalConfigs(updated);
                                                }}
                                                className="w-full bg-[#111111] border border-white/5 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-500/50 outline-none transition-all"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600 uppercase">ETH</div>
                                        </div>
                                        <p className="text-[10px] text-indigo-400 font-bold px-1">EST: ${getUSD(tier.mintPriceETH)} USD</p>
                                    </div>

                                    {/* Points Config */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">XP Threshold</label>
                                        <input
                                            type="number"
                                            value={tier.pointsRequired}
                                            onChange={(e) => {
                                                const updated = [...localConfigs];
                                                updated[idx].pointsRequired = Math.max(0, parseInt(e.target.value) || 0);
                                                setLocalConfigs(updated);
                                            }}
                                            className="w-full bg-[#111111] border border-white/5 p-3 rounded-xl text-white font-mono text-sm focus:border-indigo-500/50 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Metadata URI */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Metadata URI</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="ipfs://..."
                                                value={tier.localURI}
                                                onChange={(e) => {
                                                    const updated = [...localConfigs];
                                                    updated[idx].localURI = e.target.value;
                                                    setLocalConfigs(updated);
                                                }}
                                                className="flex-1 bg-[#111111] border border-white/5 p-3 rounded-xl text-white font-mono text-[10px] focus:border-indigo-500/50 outline-none transition-all"
                                            />
                                            <button
                                                onClick={() => handleUpdateURI(tier)}
                                                className="bg-white/5 hover:bg-white/10 p-3 rounded-xl text-indigo-400 border border-white/5"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Multiplier (BP)</label>
                                            <input
                                                type="number"
                                                value={tier.multiplierBP}
                                                className="w-full bg-[#111111] border border-white/5 p-3 rounded-xl text-white font-mono text-xs focus:border-indigo-500/50 outline-none transition-all"
                                                onChange={(e) => {
                                                    const updated = [...localConfigs];
                                                    updated[idx].multiplierBP = Math.max(10000, parseInt(e.target.value) || 10000);
                                                    setLocalConfigs(updated);
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Daily Bonus</label>
                                            <input
                                                type="number"
                                                value={tier.dailyBonus}
                                                className="w-full bg-[#111111] border border-white/5 p-3 rounded-xl text-white font-mono text-xs focus:border-indigo-500/50 outline-none transition-all"
                                                onChange={(e) => {
                                                    const updated = [...localConfigs];
                                                    updated[idx].dailyBonus = Math.max(0, parseInt(e.target.value) || 0);
                                                    setLocalConfigs(updated);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="lg:w-32 flex flex-col justify-end">
                                <button
                                    onClick={() => handleUpdate(tier)}
                                    disabled={isSaving === tier.id}
                                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all"
                                >
                                    {isSaving === tier.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Update
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
