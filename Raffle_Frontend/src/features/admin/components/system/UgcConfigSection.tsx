import { useState, useEffect } from 'react';
import { Shield, Save, Loader2, DollarSign, Wallet } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { useAccount, useSignMessage } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI, RAFFLE_ABI } from '../../../../lib/contracts';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
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
    const [drifts, setDrifts] = useState<Record<string, string>>({});

    // On-chain Data for Parity Audit
    const { data: minRewardPool } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'minRewardPoolValue',
    });

    const { data: maintenanceFee } = useReadContract({
        address: CONTRACTS.RAFFLE,
        abi: RAFFLE_ABI,
        functionName: 'maintenanceFeeBP',
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    async function fetchConfig() {
        setLoading(true);
        try {
            const { data, error: _error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'ugc_config')
                .maybeSingle();

            if (data && data.value) {
                setConfig(data.value);
                // Check for drift after fetching
                performAudit(data.value);
            }
        } catch (error) {
            console.error('Fetch UGC Config Error:', error);
        } finally {
            setLoading(false);
        }
    }

    function performAudit(currentConfig: { listing_fee_usdc?: string; is_active?: boolean; treasury_address?: string; sbt_pool_share_pct?: string }) {
        const newDrifts: Record<string, string> = {};

        // Audit Listing Fee vs Contract minRewardPool (assuming Listing Fee >= minRewardPool)
        if (minRewardPool) {
            const contractMin = parseFloat(formatUnits(minRewardPool, 6)); // Assuming 6 decimals for USDC/Points
            if (parseFloat(currentConfig.listing_fee_usdc || '0') < contractMin) {
                newDrifts.listing_fee = `Contract requires min ${contractMin} USDC`;
            }
        }

        // Audit SBT Share vs Raffle Maintenance Fee (if they should align)
        if (maintenanceFee) {
            const contractBP = Number(maintenanceFee) / 100; // BP to %
            if (parseFloat(currentConfig.sbt_pool_share_pct || '0') !== contractBP) {
                // Not necessarily an error, but worth flagging if they drift
                // newDrifts.sbt_share = `Contract BP is ${contractBP}%`;
            }
        }

        setDrifts(newDrifts);
    }

    async function handleEmergencySync() {
        if (!minRewardPool) return toast.error("Contract data not available");

        const contractMin = formatUnits(minRewardPool, 6);
        const updated = {
            ...config,
            listing_fee_usdc: contractMin
        };
        setConfig(updated);
        performAudit(updated);
        toast.success("Syncing with Blockchain Source of Truth...");
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

            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}: Failed to save`;
                try {
                    const errData = await response.json();
                    if (errData.error) errorMsg = errData.error;
                } catch(e) {
                    console.error('Failed to parse error response:', e);
                }
                throw new Error(errorMsg);
            }

            toast.success('UGC Configuration updated!', { id: tid });
        } catch (error: any) {
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
                            onChange={(e) => {
                                const val = e.target.value;
                                setConfig({ ...config, listing_fee_usdc: val });
                                performAudit({ ...config, listing_fee_usdc: val });
                            }}
                            className={`w-full bg-black/40 border ${drifts.listing_fee ? 'border-red-500/50 animate-pulse' : 'border-white/10'} rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none`}
                            placeholder="5.00"
                        />
                        {drifts.listing_fee && (
                            <div className="absolute right-3 top-3 text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-1 rounded-md uppercase tracking-tighter">
                                Drift Detected
                            </div>
                        )}
                    </div>
                    {drifts.listing_fee ? (
                        <p className="text-[9px] text-red-400 font-bold">{drifts.listing_fee}</p>
                    ) : (
                        <p className="text-[9px] text-slate-600 italic text-left">This fee is charged to sponsors for each Mission/Raffle created.</p>
                    )}
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

            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={handleEmergencySync}
                    className="bg-red-950/40 hover:bg-red-900/60 border border-red-500/20 py-4 rounded-2xl text-red-400 text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                >
                    Emergency Parity Sync
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-emerald-600 py-4 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "SAVING..." : "UPDATE UGC PROTOCOL"}
                </button>
            </div>
        </div>
    );
}
