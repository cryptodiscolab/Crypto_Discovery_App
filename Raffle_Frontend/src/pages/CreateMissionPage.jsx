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
        isBaseSocialRequired: false,
        minFollowers: '0',
        minAccountAge: '0',
        minNeynarScore: '0'
    });

    useEffect(() => {
        fetchUgcConfig();
    }, []);

    const fetchUgcConfig = async () => {
        try {
            const { data } = await supabase.from('system_settings').select('value').eq('key', 'ugc_config').maybeSingle();
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
                is_base_social_required: formData.isBaseSocialRequired,
                min_followers: parseInt(formData.minFollowers) || 0,
                account_age_requirement: parseInt(formData.minAccountAge) || 0,
                min_neynar_score: parseInt(formData.minNeynarScore) || 0
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
                <div className="text-center glass-card p-12 max-w-md w-full border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Shield className="w-20 h-20 text-indigo-500 mx-auto mb-6 opacity-40 animate-pulse" />
                    <h2 className="text-[12px] font-black text-white uppercase tracking-[0.3em] mb-3">IDENTITY REQUIRED</h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">AUTHENTICATE YOUR WALLET TO ACCESS SPONSORSHIP PORTAL.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-28 md:pb-20 px-4 bg-[#050505] selection:bg-indigo-500/30">
            {/* Background Glows */}
            <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto max-w-6xl relative">
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Main Form Section */}
                    <div className="flex-1 space-y-8">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                                    <Zap className="w-6 h-6 text-indigo-400 fill-indigo-400/20" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">CREATE <span className="text-indigo-500">MISSION</span></h1>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 italic">DISCOVERY ENGINE v3.50.0</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-6">
                            {/* Core Details */}
                            <div className="glass-card p-8 bg-slate-900/20 border-white/5 space-y-8 rounded-[2.5rem] relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                                
                                <div className="grid grid-cols-1 gap-6 relative">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> MISSION TITLE
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Follow Crypto Disco on Warpcast"
                                            className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-white font-black uppercase tracking-tight focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-700"
                                            value={formData.title}
                                            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" /> DESCRIPTION (OPTIONAL)
                                        </label>
                                        <textarea
                                            placeholder="Enter additional details or requirements..."
                                            className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-white font-medium text-sm h-32 resize-none focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-700"
                                            value={formData.description}
                                            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> PLATFORM
                                            </label>
                                            <div className="relative group">
                                                <select
                                                    className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-white font-black uppercase tracking-widest outline-none appearance-none focus:border-blue-500/50 transition-all cursor-pointer"
                                                    value={formData.platform}
                                                    onChange={e => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                                                >
                                                    <option value="farcaster">Farcaster</option>
                                                    <option value="twitter">X / Twitter</option>
                                                    <option value="tiktok">TikTok</option>
                                                    <option value="instagram">Instagram</option>
                                                    <option value="onchain">On-Chain Action</option>
                                                </select>
                                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-white transition-colors" />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> TARGET LINK
                                            </label>
                                            <div className="relative group">
                                                <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                                                <input
                                                    type="url"
                                                    required
                                                    placeholder="https://..."
                                                    className="w-full bg-white/5 border border-white/5 p-5 pl-12 rounded-2xl text-white font-mono text-sm focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-700"
                                                    value={formData.link}
                                                    onChange={e => setFormData(prev => ({ ...prev, link: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Anti-Sybil Guards */}
                            <div className="glass-card p-8 bg-slate-900/20 border-white/5 space-y-6 rounded-[2.5rem]">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30 text-blue-400">
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">ANTI-SYBIL <span className="text-blue-500">GUARDS</span></h3>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">PROTECT YOUR BUDGET FROM BOTS</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Identity Guard Toggle */}
                                    <div className={`p-5 rounded-[2rem] border transition-all cursor-pointer flex items-center justify-between group ${formData.isBaseSocialRequired ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                                         onClick={() => setFormData(prev => ({ ...prev, isBaseSocialRequired: !prev.isBaseSocialRequired }))}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${formData.isBaseSocialRequired ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${formData.isBaseSocialRequired ? 'text-blue-400' : 'text-slate-500'}`}>Basenames Only</span>
                                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Verified identities only</span>
                                            </div>
                                        </div>
                                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.isBaseSocialRequired ? 'bg-blue-600' : 'bg-slate-800'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full transition-transform transform ${formData.isBaseSocialRequired ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </div>
                                    </div>

                                    {/* Min Followers */}
                                    <div className="bg-white/5 border border-white/5 p-5 rounded-[2rem] space-y-2 group focus-within:border-indigo-500/30 transition-all">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Users size={12} className="text-slate-600 group-focus-within:text-indigo-400" /> MIN FOLLOWERS
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full bg-transparent text-white font-black text-lg outline-none placeholder:text-slate-800"
                                            placeholder="0"
                                            value={formData.minFollowers}
                                            onChange={e => setFormData(prev => ({ ...prev, minFollowers: e.target.value }))}
                                        />
                                    </div>

                                    {/* Account Age */}
                                    <div className="bg-white/5 border border-white/5 p-5 rounded-[2rem] space-y-2 group focus-within:border-indigo-500/30 transition-all">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Calculator size={12} className="text-slate-600 group-focus-within:text-indigo-400" /> MIN AGE (DAYS)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full bg-transparent text-white font-black text-lg outline-none placeholder:text-slate-800"
                                            placeholder="0"
                                            value={formData.minAccountAge}
                                            onChange={e => setFormData(prev => ({ ...prev, minAccountAge: e.target.value }))}
                                        />
                                    </div>

                                    {/* Neynar Score */}
                                    <div className="bg-white/5 border border-white/5 p-5 rounded-[2rem] space-y-2 group focus-within:border-indigo-500/30 transition-all">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Zap size={12} className="text-slate-600 group-focus-within:text-blue-400" /> NEYNAR SCORE (0-100)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            className="w-full bg-transparent text-white font-black text-lg outline-none placeholder:text-slate-800"
                                            placeholder="0"
                                            value={formData.minNeynarScore}
                                            onChange={e => setFormData(prev => ({ ...prev, minNeynarScore: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Budget Section */}
                            <div className="glass-card p-8 bg-slate-900/20 border-white/5 space-y-6 rounded-[2.5rem]">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <DollarSign className="w-4 h-4" /> REWARD PER USER (USDC)
                                        </label>
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-[2rem] group focus-within:border-emerald-500/30 transition-all">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                className="w-full bg-transparent text-white font-black text-3xl outline-none font-mono"
                                                value={formData.reward_amount_per_user}
                                                onChange={e => setFormData(prev => ({ ...prev, reward_amount_per_user: e.target.value }))}
                                            />
                                            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-2">Paid in USDC via Base</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Users className="w-4 h-4" /> MAX PARTICIPANTS
                                        </label>
                                        <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-[2rem] group focus-within:border-indigo-500/30 transition-all">
                                            <input
                                                type="number"
                                                min="10"
                                                className="w-full bg-transparent text-white font-black text-3xl outline-none font-mono"
                                                value={formData.max_participants}
                                                onChange={e => setFormData(prev => ({ ...prev, max_participants: e.target.value }))}
                                            />
                                            <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mt-2">Estimated reach</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !ugcConfig.is_active}
                                className={`w-full p-6 rounded-[2.5rem] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all transform active:scale-[0.98] ${
                                    isSubmitting || !ugcConfig.is_active 
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_40px_-10px_rgba(79,70,229,0.4)]'
                                }`}
                            >
                                {!ugcConfig.is_active ? (
                                    <>SYSTEM MAINTENANCE <Lock className="w-5 h-5" /></>
                                ) : isSubmitting ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    <>PAY & DEPLOY MISSION <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Settlement Quote Sidebar */}
                    <div className="w-full lg:w-[400px] space-y-6 sticky top-24">
                        <div className="glass-card p-10 border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden rounded-[3rem] group">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                                <Calculator className="w-32 h-32 text-indigo-400" />
                            </div>

                            <h3 className="text-[11px] font-black uppercase text-indigo-400 tracking-[0.4em] mb-10 flex items-center gap-3">
                                <Info className="w-4 h-4" /> SETTLEMENT QUOTE
                            </h3>

                            <div className="space-y-10 relative">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">REWARD POOL</span>
                                        <p className="text-[11px] text-slate-600 uppercase font-black tracking-widest">{formData.reward_amount_per_user} × {formData.max_participants} USERS</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-white font-mono tracking-tighter">{stats.rewardPool} <span className="text-xs text-slate-500 font-bold">USDC</span></p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className="text-indigo-400/60 text-[10px] font-black uppercase tracking-[0.2em]">PLATFORM FEE</span>
                                        <p className="text-[11px] text-slate-600 uppercase font-black tracking-widest italic">DYNAMIC LISTING FEE</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-indigo-400 font-mono tracking-tighter">{stats.listingFee} <span className="text-xs text-slate-500 font-bold">USDC</span></p>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                <div className="pt-2">
                                    <div className="flex justify-between items-end mb-6">
                                        <span className="text-white text-[12px] font-black uppercase tracking-[0.3em]">TOTAL DUE</span>
                                        <div className="text-right">
                                            <p className="text-5xl font-black text-white font-mono tracking-tighter mb-1">{stats.totalAmount}</p>
                                            <div className="flex items-center justify-end gap-2 text-indigo-500">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                <span className="text-[11px] font-black uppercase tracking-widest">USDC ON BASE</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-black/60 rounded-[2rem] border border-white/5 space-y-3 group/wallet overflow-hidden relative">
                                        <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover/wallet:opacity-100 transition-opacity" />
                                        <div className="flex items-start gap-3 relative">
                                            <Wallet className="w-4 h-4 text-indigo-500 mt-1 shrink-0" />
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">TARGET TREASURY</p>
                                                <p className="text-[10px] text-white font-mono break-all opacity-40 hover:opacity-100 transition-all uppercase leading-relaxed tracking-wider">
                                                    {ugcConfig.treasury_address}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Protocol Assurance */}
                        <div className="glass-card p-8 border-white/5 bg-slate-900/10 rounded-[2.5rem] space-y-6">
                            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">PROTOCOL ASSURANCE</h4>
                            <ul className="space-y-4">
                                {[
                                    { text: "Pending Manual Moderation", icon: <Clock className="w-3.5 h-3.5" /> },
                                    { text: "On-Chain Verification Required", icon: <Shield className="w-3.5 h-3.5" /> },
                                    { text: "Anti-Spam Filter Enabled", icon: <Zap className="w-3.5 h-3.5" /> },
                                    { text: "Automated Reward Payouts", icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
                                ].map((rule, i) => (
                                    <li key={i} className="flex items-center gap-3 text-[10px] text-slate-400 uppercase tracking-widest font-black group/item">
                                        <div className="text-indigo-500 group-hover/item:scale-110 transition-transform">
                                            {rule.icon}
                                        </div>
                                        {rule.text}
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
