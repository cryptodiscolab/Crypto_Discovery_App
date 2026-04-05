import { useState, useMemo, useEffect } from 'react';
import { 
    Zap, Users, DollarSign, Calculator, Info, 
    CheckCircle2, ArrowRight, Loader2, 
    Link as LinkIcon, Shield, Wallet, ChevronDown, Lock
} from 'lucide-react';
import { useAccount, useWriteContract, usePublicClient, useSignMessage } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// USDC Address (Base Sepolia for testing, Base Mainnet for production)
const USDC_ADDRESS = import.meta.env.VITE_CHAIN_ID === '8453' 
    ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' 
    : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export function CreateMissionPage() {
    const { address, isConnected } = useAccount();
    const navigate = useNavigate();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { signMessageAsync } = useSignMessage();

    // System Config State
    const [ugcConfig, setUgcConfig] = useState({
        listing_fee_usdc: '5',
        treasury_address: '0x980770dace8f13e10632d3ec1410faa4c707076c',
        is_active: true
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        platform: 'farcaster',
        action_type: 'follow',
        link: '',
        reward_amount_per_user: '0.1', // USDC
        max_participants: '100',
        duration_days: '7',
        isBaseSocialRequired: false
    });

    useEffect(() => {
        fetchUgcConfig();
    }, []);

    const fetchUgcConfig = async () => {
        try {
            const { data } = await supabase.from('system_settings').select('value').eq('key', 'ugc_config').single();
            if (data?.value) setUgcConfig(data.value);
        } catch (e) {
            console.error('Failed to fetch UGC config:', e);
        }
    };

    // Calculator Logic
    const stats = useMemo(() => {
        const rewardPerUser = parseFloat(formData.reward_amount_per_user) || 0;
        const participants = parseInt(formData.max_participants) || 0;
        const listingFee = parseFloat(ugcConfig.listing_fee_usdc) || 0;

        const rewardPool = rewardPerUser * participants;
        const totalAmount = rewardPool + listingFee;

        return {
            rewardPool: rewardPool.toFixed(2),
            listingFee: listingFee.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            totalAmountRaw: parseUnits(totalAmount.toString(), 6)
        };
    }, [formData, ugcConfig]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!isConnected) return toast.error("Please connect wallet");
        if (!formData.title || !formData.link) return toast.error("Title and Link are required");

        setIsSubmitting(true);
        const tid = toast.loading("Processing USDC Payment...");

        try {
            // 1. USDC Payment (Transfer to Treasury)
            const txHash = await writeContractAsync({
                address: USDC_ADDRESS,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [ugcConfig.treasury_address, stats.totalAmountRaw]
            });

            toast.loading("Verifying transaction on blockchain...", { id: tid });
            
            // Wait for tx confirmation
            await publicClient.waitForTransactionReceipt({ hash: txHash });

            toast.loading("Synchronizing Mission with Discovery Engine...", { id: tid });

            // 2. Submit to Backend
            const timestamp = new Date().toISOString();
            const message = `Create UGC Mission: ${formData.title}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const payload = {
                title: formData.title,
                description: formData.description,
                platform_code: formData.platform,
                reward_amount_per_user: formData.reward_amount_per_user,
                total_reward_pool: stats.rewardPool,
                max_participants: parseInt(formData.max_participants),
                sponsor_address: address.toLowerCase(),
                duration_days: parseInt(formData.duration_days),
                status: 'pending', 
                reward_symbol: 'USDC',
                payment_tx_hash: txHash,
                is_active: false,
                is_verified_payment: false,
                is_base_social_required: formData.isBaseSocialRequired
            };

            const response = await fetch('/api/admin/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    action: 'CREATE_UGC_MISSION',
                    payload: payload,
                    message,
                    signature
                })
            });

            if (!response.ok) throw new Error("Failed to sync with backend");

            toast.success("Mission Created & Payment Verified! Pending Admin Approval.", { id: tid });
            navigate('/tasks');
        } catch (err) {
            console.error(err);
            toast.error(err.shortMessage || err.message || "Operation failed", { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-[#050505]">
                <div className="text-center glass-card p-12 max-w-md w-full border border-white/5">
                    <Shield className="w-16 h-16 text-indigo-500 mx-auto mb-6 opacity-20" />
                    <h2 className="text-[11px] font-black text-white uppercase tracking-widest mb-2">IDENTITY REQUIRED</h2>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8">CONNECT WALLET TO SPONSOR A MISSION.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-safe px-4 bg-[#050505]">
            <div className="container mx-auto max-w-5xl">
                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Form Section */}
                    <div className="flex-1 space-y-8 text-left">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Zap className="w-6 h-6 text-indigo-500 fill-indigo-500/20" />
                                <h1 className="text-2xl font-black text-white uppercase tracking-widest">CREATE <span className="text-indigo-500">MISSION</span></h1>
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">SPONSOR A TASK AND REWARD USERS WITH $USDC COMPLETED ACTIONS.</p>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-6">
                            <div className="glass-card p-6 bg-slate-900/40 border-white/5 space-y-6 rounded-3xl">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Mission Title</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Follow Crypto Disco on Warpcast"
                                            className="input-native"
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-[#00ff88]">Description (Optional)</label>
                                        <textarea
                                            placeholder="Enter additional details or requirements..."
                                            className="input-native h-24 resize-none"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-[#00ff88]">Platform</label>
                                            <div className="select-wrapper">
                                                <select
                                                    className="select-native"
                                                    value={formData.platform}
                                                    onChange={e => setFormData({ ...formData, platform: e.target.value })}
                                                >
                                                    <option value="farcaster">Farcaster</option>
                                                    <option value="twitter">X / Twitter</option>
                                                    <option value="tiktok">TikTok</option>
                                                    <option value="instagram">Instagram</option>
                                                    <option value="onchain">On-Chain Action</option>
                                                </select>
                                                <ChevronDown className="select-chevron w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-[#00ff88]">Target Link</label>
                                            <div className="relative">
                                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                                <input
                                                    type="url"
                                                    required
                                                    placeholder="https://..."
                                                    className="input-native pl-10"
                                                    value={formData.link}
                                                    onChange={e => setFormData({ ...formData, link: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* IDENTITY GUARD (v3.42.0) */}
                                <div className={`p-5 rounded-3xl border transition-all cursor-pointer select-none flex items-center justify-between group ${formData.isBaseSocialRequired ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-slate-950/40 border-white/5 hover:border-white/10'}`}
                                     onClick={() => setFormData(prev => ({ ...prev, isBaseSocialRequired: !prev.isBaseSocialRequired }))}>
                                    <div className="flex items-center gap-4 text-left">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${formData.isBaseSocialRequired ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-600'}`}>
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${formData.isBaseSocialRequired ? 'text-blue-400' : 'text-slate-500'}`}>Identity Guard</span>
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Require Basenames Verification</span>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.isBaseSocialRequired ? 'bg-blue-600' : 'bg-slate-800'}`}>
                                        <div className={`w-5 h-4 bg-white rounded-full transition-transform transform ${formData.isBaseSocialRequired ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                            <DollarSign className="w-3 h-3" /> REWARD PER USER (USDC)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            className="input-native font-mono text-lg"
                                            value={formData.reward_amount_per_user}
                                            onChange={e => setFormData({ ...formData, reward_amount_per_user: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            <Users className="w-3 h-3" /> MAX PARTICIPANTS
                                        </label>
                                        <input
                                            type="number"
                                            min="10"
                                            className="input-native font-mono text-lg"
                                            value={formData.max_participants}
                                            onChange={e => setFormData({ ...formData, max_participants: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !ugcConfig.is_active}
                                className="btn-native btn-primary w-full"
                            >
                                {!ugcConfig.is_active ? (
                                    <>System Maintenance <Lock className="w-5 h-5" /></>
                                ) : isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>Pay & Submit Mission <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Summary & Price Sidebar */}
                    <div className="w-full lg:w-[380px] space-y-6">
                        <div className="glass-card p-8 border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden rounded-3xl">
                            <div className="absolute top-0 right-0 p-6 opacity-5">
                                <Calculator className="w-20 h-20 text-indigo-400" />
                            </div>

                            <h3 className="text-[11px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-8 flex items-center gap-2">
                                <Info className="w-4 h-4" /> SETTLEMENT QUOTE
                            </h3>

                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">REWARD POOL</span>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-white font-mono uppercase tracking-widest">{stats.rewardPool} <span className="text-[11px] text-slate-500">USDC</span></p>
                                        <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest">{formData.reward_amount_per_user} × {formData.max_participants} USERS</p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">LISTING FEE</span>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-indigo-400 font-mono uppercase tracking-widest">{stats.listingFee} <span className="text-[11px] text-slate-500">USDC</span></p>
                                        <p className="text-[11px] text-slate-500 uppercase font-black italic tracking-widest">DYNAMIC PLATFORM FEE</p>
                                    </div>
                                </div>

                                <div className="h-px bg-white/10" />

                                <div className="pt-2">
                                    <div className="flex justify-between items-end mb-4">
                                        <span className="text-white text-[11px] font-black uppercase tracking-widest">TOTAL REQUIRED</span>
                                        <div className="text-right">
                                            <p className="text-4xl font-black text-white font-mono tracking-tighter uppercase tracking-widest">{stats.totalAmount}</p>
                                            <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">$USDC (BASE)</p>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                        <div className="flex items-start gap-2">
                                            <Wallet className="w-3 h-3 text-indigo-400 mt-1 shrink-0" />
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">TARGET TREASURY</p>
                                                <p className="text-[11px] text-white font-mono break-all opacity-60 hover:opacity-100 transition-opacity uppercase tracking-widest">
                                                    {ugcConfig.treasury_address}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rules */}
                        <div className="glass-card p-6 border-white/5 bg-slate-900/40 rounded-3xl space-y-4">
                            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">PROTOCOL RULES</h4>
                            <ul className="space-y-3">
                                {[
                                    "Missions are pending moderation",
                                    "Funds are verified onchain via TX Hash",
                                    "No refunds for rejected spammed content",
                                    "USDC rewards distributed automatically"
                                ].map((rule, i) => (
                                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-400 uppercase tracking-widest font-black">
                                        <CheckCircle2 className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                                        {rule}
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
