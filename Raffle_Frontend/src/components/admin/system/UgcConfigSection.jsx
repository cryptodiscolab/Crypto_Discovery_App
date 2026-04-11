import React, { useState, useEffect } from 'react';
import { Shield, Save, Loader2, DollarSign, Wallet } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useAccount, useSignMessage } from 'wagmi';
import { CONTRACTS } from '../../../lib/contracts';
import toast from 'react-hot-toast';

export function UgcConfigSection() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    
    const [config, setConfig] = useState({
        listing_fee_usdc: '5',
        sbt_pool_share_pct: '10',
        treasury_address: CONTRACTS.MASTER_X || '', // ✅ Resolved from canonical contracts lib, not hardcoded
        is_active: true
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    async function fetchConfig() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'ugc_config')
                .maybeSingle();

            if (data && data.value) {
                setConfig(data.value);
            }
        } catch (error) {
            console.error('Fetch UGC Config Error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        const tid = toast.loading('Saving UGC configuration...');
        try {
            const timestamp = new Date().toISOString();
            const message = `Update UGC Config\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'UPDATE_UGC_CONFIG',
                    payload: config
                })
            });

            if (!response.ok) throw new Error('Failed to save configuration');
            
            toast.success('UGC Configuration updated!', { id: tid });
        } catch (error) {
            toast.error('Save failed: ' + error.message, { id: tid });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return (
        <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
    );

    return (
        <div className="glass-card p-8 bg-slate-900/40 border border-white/5 space-y-6 rounded-3xl">
            <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-500" /> UGC PROTOCOL CONTROL
                </h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1 text-left">
                    Configure Platform fees & Treasury for User Missions
                </p>
            </div>

            <div className="space-y-4 text-left">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <DollarSign className="w-3 h-3" /> Listing Fee (USDC)
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={config.listing_fee_usdc}
                            onChange={(e) => setConfig({ ...config, listing_fee_usdc: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            placeholder="5.00"
                        />
                    </div>
                    <p className="text-[9px] text-slate-600 italic text-left">This fee is charged to sponsors for each Mission/Raffle created.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <DollarSign className="w-3 h-3" /> SBT Reward Portion (%)
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={config.sbt_pool_share_pct}
                            onChange={(e) => setConfig({ ...config, sbt_pool_share_pct: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            placeholder="10"
                        />
                    </div>
                    <p className="text-[9px] text-slate-600 italic text-left">The percentage of Listing Fee that will be allocated to SBT Pool Reward.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Wallet className="w-3 h-3" /> Treasury Address
                    </label>
                    <input
                        type="text"
                        value={config.treasury_address}
                        onChange={(e) => setConfig({ ...config, treasury_address: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none"
                        placeholder="0x..."
                    />
                    <p className="text-[9px] text-slate-600 italic">Target wallet for all UGC listing fees and reward pools.</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                    <div>
                        <p className="text-xs font-bold text-white uppercase">UGC Submissions</p>
                        <p className="text-[9px] text-slate-500">Enable or disable new user-generated missions.</p>
                    </div>
                    <button
                        onClick={() => setConfig({ ...config, is_active: !config.is_active })}
                        className={`w-12 h-6 rounded-full transition-all relative ${config.is_active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.is_active ? 'right-1' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-emerald-600 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "SAVING..." : "UPDATE UGC PROTOCOL"}
            </button>
        </div>
    );
}
