import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
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
        } catch (error: unknown) {
            console.error('Save UGC Config Error:', error);
            const errMsg = error instanceof Error ? error.message : String(error);
            toast.error('Save failed: ' + errMsg, { id: tid });
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
        <div className="bg-[#121214] p-8 border border-white/5 space-y-6 rounded-3xl">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">
                        UGC PROTOCOL CONTROL
                    </h3>
                </div>
                <p className="label-native text-slate-500 mt-2">
                    Configure Platform fees & Treasury for User Missions
                </p>
            </div>

            <div className="space-y-4 text-left">
                <div className="space-y-2">
                    <label className="label-native text-indigo-400">
                        Listing Fee (USDC)
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
                            className={`w-full bg-black/40 border ${drifts.listing_fee ? 'border-red-500/50 animate-pulse' : 'border-white/10'} rounded-xl px-4 py-3 text-white font-mono value-native focus:border-indigo-500 outline-none`}
                            placeholder="5.00"
                        />
                        {drifts.listing_fee && (
                            <div className="absolute right-3 top-3 label-native text-red-500 bg-red-500/10 px-2 py-1 rounded-md">
                                Drift Detected
                            </div>
                        )}
                    </div>
                    {drifts.listing_fee ? (
                        <p className="label-native text-red-400 font-bold">{drifts.listing_fee}</p>
                    ) : (
                        <p className="label-native text-slate-600 italic">This fee is charged to sponsors for each Mission/Raffle created.</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="label-native text-indigo-400">
                        SBT Reward Portion (%)
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={config.sbt_pool_share_pct}
                            onChange={(e) => setConfig({ ...config, sbt_pool_share_pct: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono value-native focus:border-indigo-500 outline-none"
                            placeholder="10"
                        />
                    </div>
                    <p className="label-native text-slate-600 italic">The percentage of Listing Fee that will be allocated to SBT Pool Reward.</p>
                </div>

                <div className="space-y-2">
                    <label className="label-native text-indigo-400">
                        Treasury Address
                    </label>
                    <input
                        type="text"
                        value={config.treasury_address}
                        onChange={(e) => setConfig({ ...config, treasury_address: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono value-native focus:border-indigo-500 outline-none"
                        placeholder="0x..."
                    />
                    <p className="label-native text-slate-600 italic">Target wallet for all UGC listing fees and reward pools.</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                    <div>
                        <p className="label-native text-white">UGC Submissions</p>
                        <p className="label-native text-slate-500 mt-1">Enable or disable new user-generated missions.</p>
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
                    className="bg-red-950/40 hover:bg-red-900/60 border border-red-500/20 py-4 rounded-2xl text-red-400 label-native transition-all active:scale-[0.98]"
                >
                    Emergency Parity Sync
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-4 rounded-2xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
                >
                    {saving ? "SAVING..." : "UPDATE UGC PROTOCOL"}
                </button>
            </div>
        </div>
    );
}
