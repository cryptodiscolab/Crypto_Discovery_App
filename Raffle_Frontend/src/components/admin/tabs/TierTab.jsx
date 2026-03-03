import React, { useState, useEffect } from 'react';
import { Users, Award, Shield, Save, RefreshCw } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { getSBTThresholds } from '../../../dailyAppLogic';
import toast from 'react-hot-toast';

export function TierTab({ onUpdate }) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [targetUser, setTargetUser] = useState('');
    const [selectedTier, setSelectedTier] = useState(1); // 1 = Bronze
    const [isUpdating, setIsUpdating] = useState(false);
    const [thresholds, setThresholds] = useState([]);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    const levels = ["None", "Bronze", "Silver", "Gold"];

    useEffect(() => {
        loadConfig();
    }, []);

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

    const handleConfigSave = async (id, min_xp) => {
        setIsSavingConfig(true);
        const tid = toast.loading("Requesting Admin Signature...");
        try {
            // 1. Signature for Zero-Trust
            const timestamp = new Date().toISOString();
            const message = `Update SBT Threshold: Tier ID ${id}\nNew Min XP: ${min_xp}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            toast.loading("Updating via secure API...", { id: tid });

            // 2. Call Secure API
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
            {/* 1. On-Chain Assign (Manual Override) */}
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
                            <option value={1}>Bronze (20% share)</option>
                            <option value={2}>Silver (30% share)</option>
                            <option value={3}>Gold (50% share)</option>
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

            {/* 2. SBT Point Thresholds (Anti-Halu Config) */}
            <div className="glass-card p-8 bg-yellow-900/10 border border-yellow-500/10 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" /> Point Threshold Configuration
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {thresholds.map((t) => (
                        <div key={t.id} className="bg-slate-900 p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-sm font-black uppercase tracking-widest ${t.tier_name === 'Gold' ? 'text-yellow-400' :
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
