import React, { useState, useEffect } from 'react';
import { Users, Award, Shield, Save, RefreshCw, Sliders } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { useSBT } from '../../../hooks/useSBT';
import { getSBTThresholds } from '../../../dailyAppLogic';
import toast from 'react-hot-toast';

export function TierTab({ onUpdate }) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const {
        diamondWeight, platinumWeight, goldWeight, silverWeight, bronzeWeight,
        setTierWeights, refetchAll
    } = useSBT();

    const [targetUser, setTargetUser] = useState('');
    const [selectedTier, setSelectedTier] = useState(1); // 1 = Bronze
    const [isUpdating, setIsUpdating] = useState(false);
    const [thresholds, setThresholds] = useState([]);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isSavingWeights, setIsSavingWeights] = useState(false);

    // Weight local state
    const [weights, setWeights] = useState({
        d: 0, p: 0, g: 0, s: 0, b: 0
    });

    const levels = ["None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];

    useEffect(() => {
        loadConfig();
    }, []);

    useEffect(() => {
        setWeights({
            d: diamondWeight,
            p: platinumWeight,
            g: goldWeight,
            s: silverWeight,
            b: bronzeWeight
        });
    }, [diamondWeight, platinumWeight, goldWeight, silverWeight, bronzeWeight]);

    const loadConfig = async () => {
        const data = await getSBTThresholds();
        if (data) setThresholds(data);
    };

    const handleTierUpdate = async () => {
        if (!targetUser.startsWith('0x')) return toast.error("Invalid address");

        setIsUpdating(true);
        const tid = toast.loading(`Updating to ${levels[selectedTier]}...`);
        try {
            await onUpdate(targetUser, selectedTier);
            toast.success("Tier updated!", { id: tid });
            setTargetUser('');
        } catch (e) {
            toast.error(e.shortMessage || "Update failed", { id: tid });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleWeightSave = async () => {
        const total = Number(weights.d) + Number(weights.p) + Number(weights.g) + Number(weights.s) + Number(weights.b);
        if (total !== 100) {
            return toast.error(`Total weights must be 100% (Current: ${total}%)`);
        }

        setIsSavingWeights(true);
        const tid = toast.loading("Updating Revenue Weights...");
        try {
            await setTierWeights(
                BigInt(weights.d),
                BigInt(weights.p),
                BigInt(weights.g),
                BigInt(weights.s),
                BigInt(weights.b)
            );
            toast.success("Weights Updated!", { id: tid });
            refetchAll();
        } catch (e) {
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSavingWeights(false);
        }
    };

    const handleConfigSave = async (id, min_xp) => {
        setIsSavingConfig(true);
        const tid = toast.loading("Requesting Admin Signature...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Update SBT Threshold: Tier ID ${id}\nNew Min XP: ${min_xp}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            toast.loading("Updating via secure API...", { id: tid });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'UPDATE_THRESHOLDS',
                    payload: [{ id, min_xp }]
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Update failed");

            toast.success("Threshold Updated!", { id: tid });
            loadConfig();
        } catch (e) {
            console.error(e);
            toast.error(e.message || "Update failed", { id: tid });
        } finally {
            setIsSavingConfig(false);
        }
    };

    return (
        <div className="space-y-8 text-left">
            {/* 1. Revenue Weight Distribution (NEW) */}
            <div className="glass-card p-8 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Sliders className="w-24 h-24 text-indigo-400 rotate-12" />
                </div>

                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-400" /> Revenue Distribution Weights
                </h3>
                <p className="text-xs text-slate-500 mb-8 max-w-xl">
                    Configure the percentage of the SBT Pool shared among each tier.
                    <span className="text-indigo-400 font-bold ml-1">Total must equal 100%.</span>
                </p>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    {[
                        { key: 'd', label: 'Diamond', color: 'text-blue-400' },
                        { key: 'p', label: 'Platinum', color: 'text-indigo-300' },
                        { key: 'g', label: 'Gold', color: 'text-yellow-400' },
                        { key: 's', label: 'Silver', color: 'text-slate-300' },
                        { key: 'b', label: 'Bronze', color: 'text-orange-400' },
                    ].map((t) => (
                        <div key={t.key} className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                            <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${t.color}`}>{t.label}</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={weights[t.key]}
                                    onChange={(e) => setWeights({ ...weights, [t.key]: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 p-3 pr-8 rounded-lg text-white font-mono text-lg focus:border-indigo-500/50 outline-none transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold">%</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-6 p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-lg font-black font-mono text-xl ${(Number(weights.d) + Number(weights.p) + Number(weights.g) + Number(weights.s) + Number(weights.b)) === 100
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-red-400 bg-red-500/10'
                            }`}>
                            {Number(weights.d) + Number(weights.p) + Number(weights.g) + Number(weights.s) + Number(weights.b)}%
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Calculated Total</p>
                    </div>

                    <button
                        onClick={handleWeightSave}
                        disabled={isSavingWeights || (Number(weights.d) + Number(weights.p) + Number(weights.g) + Number(weights.s) + Number(weights.b)) !== 100}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold transition-all flex items-center gap-2 text-white shadow-lg shadow-indigo-600/20"
                    >
                        <Save className="w-4 h-4" /> Save Weights
                    </button>
                </div>
            </div>

            {/* 2. On-Chain Assign (Manual Override) */}
            <div className="glass-card p-8 bg-slate-900/40 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-yellow-500" /> Soulbound Tier Management (Manual Override)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div className="md:col-span-1 text-left">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-tighter mb-2">User Wallet Address</label>
                        <input
                            value={targetUser}
                            onChange={(e) => setTargetUser(e.target.value)}
                            placeholder="0x..."
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-yellow-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="text-left">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-tighter mb-2">Assign Tier</label>
                        <select
                            value={selectedTier}
                            onChange={(e) => setSelectedTier(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-yellow-500/50 outline-none appearance-none cursor-pointer"
                        >
                            <option value={1}>Bronze (Tier 1)</option>
                            <option value={2}>Silver (Tier 2)</option>
                            <option value={3}>Gold (Tier 3)</option>
                            <option value={4}>Platinum (Tier 4)</option>
                            <option value={5}>Diamond (Tier 5)</option>
                        </select>
                    </div>

                    <button
                        onClick={handleTierUpdate}
                        disabled={isUpdating || !targetUser}
                        className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-800 disabled:text-slate-600 p-3 rounded-xl font-bold shadow-lg shadow-yellow-500/10 transition-all text-white"
                    >
                        {isUpdating ? "Processing..." : "Assign Soulbound"}
                    </button>
                </div>
            </div>

            {/* 3. SBT Point Thresholds (Anti-Halu Config) */}
            <div className="glass-card p-8 bg-yellow-900/10 border border-yellow-500/10 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" /> Point Threshold Configuration (SBT)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {thresholds.map((t) => (
                        <div key={t.id} className="bg-slate-900 p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-sm font-black uppercase tracking-widest ${t.tier_name === 'Diamond' ? 'text-blue-400' :
                                        t.tier_name === 'Platinum' ? 'text-indigo-300' :
                                            t.tier_name === 'Gold' ? 'text-yellow-400' :
                                                t.tier_name === 'Silver' ? 'text-slate-300' : 'text-orange-400'
                                    }`}>{t.tier_name} Tier</span>
                                <span className="text-xs text-slate-500">Level {t.level}</span>
                            </div>

                            <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Required XP</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    defaultValue={t.min_xp}
                                    onBlur={(e) => {
                                        if (Number(e.target.value) !== t.min_xp) {
                                            handleConfigSave(t.id, Number(e.target.value));
                                        }
                                    }}
                                    className="w-full bg-black/40 border border-white/10 p-2 rounded-lg text-white font-mono text-sm focus:border-yellow-500/50 outline-none"
                                />
                                <div className="flex items-center justify-center w-8 bg-slate-800 rounded-lg">
                                    {isSavingConfig ? <RefreshCw className="w-3 h-3 animate-spin text-slate-400" /> : <Save className="w-3 h-3 text-slate-500" />}
                                </div>
                            </div>
                        </div>
                    ))}
                    {thresholds.length === 0 && <p className="text-slate-500 italic">No thresholds found in Supabase.</p>}
                </div>
                <p className="mt-4 text-xs text-slate-500 flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    Changes are auto-saved when you click away from the input.
                </p>
            </div>
        </div>
    );
}
