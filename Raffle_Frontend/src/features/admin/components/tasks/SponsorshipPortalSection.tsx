import { Share2, RefreshCw } from 'lucide-react';
import { formatUnits } from 'viem';

interface SponsorshipPortalSectionProps {
    sponsorTitle: string;
    onSponsorTitleChange: (_val: string) => void;
    sponsorLink: string;
    onSponsorLinkChange: (_val: string) => void;
    sponsorEmail: string;
    onSponsorEmailChange: (_val: string) => void;
    rewardPerUserUSD: string;
    onRewardPerUserUSDChange: (_val: string) => void;
    targetClaims: string;
    onTargetClaimsChange: (_val: string) => void;
    isBaseSocialRequired: boolean;
    onIsBaseSocialRequiredChange: (_val: boolean) => void;
    currentPlatformFee?: bigint;
    currentTokenPrice?: bigint;
    whitelistedTokens: unknown[];
    selectedTokenAddr: string;
    onTokenChange: (_addr: string) => void;
    requiredTokens: bigint;
    selectedTokenUsdPrice: number;
    isPriceReady: boolean;
    onCreateSponsorship: () => void;
    isSponsorSaving: boolean;
}

export function SponsorshipPortalSection({
    sponsorTitle, onSponsorTitleChange,
    sponsorLink, onSponsorLinkChange,
    sponsorEmail, onSponsorEmailChange,
    rewardPerUserUSD, onRewardPerUserUSDChange,
    targetClaims, onTargetClaimsChange,
    isBaseSocialRequired, onIsBaseSocialRequiredChange,
    currentPlatformFee,
    whitelistedTokens,
    selectedTokenAddr,
    onTokenChange,
    requiredTokens,
    selectedTokenUsdPrice,
    isPriceReady,
    onCreateSponsorship,
    isSponsorSaving
}: SponsorshipPortalSectionProps) {
    const tokens = whitelistedTokens as Array<{ address: string; symbol: string; decimals?: number }>;
    const selectedToken = tokens.find((t) => t.address?.toLowerCase() === selectedTokenAddr.toLowerCase());
    return (
        <div className="glass-card p-10 bg-[#121214] border border-white/5 rounded-[3rem] relative overflow-hidden group/main">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-600/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all duration-1000 group-hover/main:bg-emerald-600/10" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/5 blur-[120px] rounded-full -ml-48 -mb-48" />

            <div className="flex flex-col md:flex-row items-center justify-between mb-12 relative">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
                        <Share2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-[0.2em] leading-none">SPONSOR <span className="text-emerald-500">HUB</span></h3>
                        <p className="label-native text-slate-500 mt-2">B2B Engagement Portal</p>
                    </div>
                </div>
                <div className="mt-6 md:mt-0 px-6 py-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="label-native text-slate-400">v3.42.0 HARDENED</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative">
                <div className="lg:col-span-7 space-y-8">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="block label-native text-slate-500 px-1 mb-1">Campaign Name</label>
                            <input value={sponsorTitle} onChange={(e) => onSponsorTitleChange(e.target.value)} placeholder="e.g. Disco Gacha Season 1" className="w-full bg-[#0a0a0c] border border-white/5 p-5 rounded-[1.5rem] text-white content-native placeholder:text-slate-850 focus:border-emerald-500/50 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="block label-native text-slate-500 px-1 mb-1">Landing Destination</label>
                            <input value={sponsorLink} onChange={(e) => onSponsorLinkChange(e.target.value)} placeholder="https://" className="w-full bg-[#0a0a0c] border border-white/5 p-5 rounded-[1.5rem] text-emerald-400 value-native font-mono focus:border-emerald-500/50 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="block label-native text-slate-500 px-1 mb-1">Internal Contact</label>
                            <input value={sponsorEmail} onChange={(e) => onSponsorEmailChange(e.target.value)} placeholder="sponsor@example.com" className="w-full bg-[#0a0a0c] border border-white/5 p-5 rounded-[1.5rem] text-white content-native focus:border-emerald-500/50 outline-none transition-all" />
                        </div>

                        {/* ASSET SELECTOR [v3.62.0] */}
                        <div className="space-y-2">
                            <label className="block label-native text-slate-500 px-1 mb-1">Payment Asset</label>
                            <select
                                value={selectedTokenAddr}
                                onChange={e => onTokenChange(e.target.value)}
                                className="w-full bg-[#0a0a0c] border border-white/5 p-5 rounded-[1.5rem] text-white content-native focus:border-emerald-500/50 outline-none cursor-pointer"
                            >
                                {tokens.map((t, i: number) => (
                                    <option key={i} value={t.address} className="bg-zinc-900">
                                        {t.symbol} ({t.address.slice(0,6)}...{t.address.slice(-4)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div
                        className={`p-6 rounded-[2rem] border transition-all duration-500 cursor-pointer select-none flex items-center justify-between group ${
                            isBaseSocialRequired
                            ? 'bg-blue-600/10 border-blue-500/40 shadow-2xl shadow-blue-500/10'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                        onClick={() => onIsBaseSocialRequiredChange(!isBaseSocialRequired)}
                    >
                        <div className="flex items-center gap-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                                isBaseSocialRequired
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/40 scale-110'
                                : 'bg-slate-900 text-slate-600'
                            }`}>
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            </div>
                            <div className="flex flex-col">
                                <span className={`label-native font-black uppercase tracking-[0.2em] ${isBaseSocialRequired ? 'text-blue-400' : 'text-slate-500'}`}>Identity Shield</span>
                                <span className="label-native text-slate-600 mt-1">Require Basenames / Social Linking</span>
                            </div>
                        </div>
                        <div className={`w-14 h-7 rounded-full p-1.5 transition-all duration-500 ${isBaseSocialRequired ? 'bg-blue-600' : 'bg-slate-800'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-lg ${isBaseSocialRequired ? 'translate-x-7' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                    <div className="glass-card bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-[2.5rem] relative overflow-hidden flex flex-col justify-between h-full min-h-[400px]">
                        <div className="space-y-8 relative">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="block label-native text-emerald-500/60 mb-1">Reward (USD)</label>
                                    <div className="flex items-center gap-3 bg-black/40 p-5 rounded-2xl border border-white/5 focus-within:border-emerald-500/50 transition-all">
                                        <span className="text-emerald-500 font-black text-xl">$</span>
                                        <input type="number" step="0.01" value={rewardPerUserUSD} onChange={(e) => onRewardPerUserUSDChange(e.target.value)} className="w-full bg-transparent text-white value-native font-black outline-none" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="block label-native text-emerald-500/60 mb-1">Total Claims</label>
                                    <div className="flex items-center gap-3 bg-black/40 p-5 rounded-2xl border border-white/5 focus-within:border-emerald-500/50 transition-all">
                                        <input type="number" value={targetClaims} onChange={(e) => onTargetClaimsChange(e.target.value)} className="w-full bg-transparent text-white value-native font-black outline-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 p-6 bg-black/60 rounded-[1.5rem] border border-white/5">
                                <div className="flex justify-between items-center">
                                    <span className="label-native text-slate-500">Total Pool Value</span>
                                    <span className="value-native text-white font-black">${((parseFloat(rewardPerUserUSD) || 0) * (parseFloat(targetClaims) || 0)).toLocaleString()} USD</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="label-native text-slate-500">Sponsorship Asset</span>
                                    <span className="value-native text-emerald-400 uppercase font-black">
                                        {selectedToken?.symbol || 'ETH'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="label-native text-slate-500">Asset Requirement</span>
                                    <div className="text-right">
                                        <span className="block value-native text-emerald-400 font-mono font-black">
                                            {formatUnits(requiredTokens, selectedToken?.decimals || 18)}
                                        </span>
                                        <span className="block label-native text-slate-500 mt-1">
                                            {isPriceReady ? `$${selectedTokenUsdPrice.toFixed(4)} / ${selectedToken?.symbol || 'ETH'}` : 'PRICE ORACLE PENDING'}
                                        </span>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                                    <span className="label-native text-slate-500">Platform Fee</span>
                                    <span className="value-native text-emerald-500 font-black">
                                        {currentPlatformFee ? (Number(currentPlatformFee) / 1e6).toFixed(2) : '1.00'} USDC
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onCreateSponsorship}
                            disabled={isSponsorSaving || !isPriceReady}
                            className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 disabled:bg-slate-800/20 disabled:border-slate-800/30 disabled:text-slate-600 py-6 rounded-[2rem] label-native transition-all"
                        >
                            {isSponsorSaving ? (
                                <div className="flex items-center justify-center gap-3">
                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                    <span>DEPLOYING...</span>
                                </div>
                            ) : isPriceReady ? 'DEPLOY SPONSORSHIP' : 'WAITING FOR PRICE ORACLE'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
