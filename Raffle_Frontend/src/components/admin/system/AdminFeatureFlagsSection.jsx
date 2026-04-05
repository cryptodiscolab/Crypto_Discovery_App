import React, { useState, useEffect } from 'react';
import { Power, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import toast from 'react-hot-toast';

export function AdminFeatureFlagsSection({ address, signMessageAsync }) {
    const [flags, setFlags] = useState({
        login_and_social: false,
        daily_claim: false,
        sbt_minting: false,
        ugc_payment: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchFlags();
    }, []);

    const fetchFlags = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'active_features').maybeSingle();
            if (error) throw error;
            if (data?.value) {
                setFlags(data.value);
            }
        } catch (err) {
            console.error('Failed to fetch flags:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleFlag = (key) => {
        setFlags(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        setSaving(true);
        const tid = toast.loading('Applying Phased Rollout configuration...');
        try {
            const timestamp = new Date().toISOString();
            const message = `Update Feature Flags (Phased Rollout)\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address, 
                    signature, 
                    message, 
                    action_type: 'UPDATE_FEATURE_FLAGS', 
                    payload: flags
                })
            });

            if (!response.ok) throw new Error("Failed to update feature flags");
            toast.success('Phased Rollout Updated! UI auto-locked on Mainnet.', { id: tid });
            fetchFlags();
        } catch (err) {
            toast.error('Failed to update: ' + err.message, { id: tid });
        } finally {
            setSaving(false);
        }
    };

    const flagDetails = [
        { key: 'login_and_social', label: 'Phase 1: Login & Social Sync', desc: 'Allows user creation & identity verification.', color: 'text-emerald-400' },
        { key: 'daily_claim', label: 'Phase 2: Task Claims', desc: 'Allows daily XP claims from Warpcast & Telegram.', color: 'text-blue-400' },
        { key: 'sbt_minting', label: 'Phase 3: SBT Upgrades', desc: 'Allows minting Tier Upgrade Badges via Master Contract.', color: 'text-indigo-400' },
        { key: 'ugc_payment', label: 'Phase 4: UGC Raffle Sponsoring', desc: 'Allows deploying independent raffle contracts.', color: 'text-purple-400' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 border border-white/5 rounded-3xl bg-white/[0.02]">
                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
            </div>
        );
    }

    return (
        <div className="glass-card p-6 md:p-8 space-y-6 relative overflow-hidden border border-rose-500/20 mt-8">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Power className="w-48 h-48 text-rose-500" />
            </div>

            <div className="relative z-10 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                        <ShieldAlert className="w-6 h-6 text-rose-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Mainnet Feature Flags</h2>
                        <p className="text-xs font-mono text-rose-300/80 mt-1 uppercase tracking-widest">Global Kill Switch & Phased Rollouts</p>
                    </div>
                </div>
            </div>

            <div className="relative z-10 p-4 border border-rose-500/30 bg-rose-500/10 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-200/80 leading-relaxed font-bold">
                    WARNING: Disabling a flag immediately locks out the feature on the React Client and rejects all Backend API requests. Only modify during governed Rollout Phases.
                </p>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                {flagDetails.map(({ key, label, desc, color }) => {
                    const isEnabled = flags[key];
                    return (
                        <div 
                            key={key} 
                            onClick={() => toggleFlag(key)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none group ${isEnabled ? 'bg-white/5 border-emerald-500/30 hover:border-emerald-500/60' : 'bg-black/50 border-red-500/30 hover:border-red-500/60 opacity-80'}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className={`text-sm font-black uppercase tracking-wide ${isEnabled ? color : 'text-slate-500'}`}>{label}</h3>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase leading-relaxed font-mono">{desc}</p>
                                </div>
                                <div className={`p-1.5 rounded-lg border transition-colors ${isEnabled ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400/50'}`}>
                                    {isEnabled ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="relative z-10 pt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-rose-500 hover:bg-rose-400 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    Broadcast Kill Switch Status
                </button>
            </div>
        </div>
    );
}
