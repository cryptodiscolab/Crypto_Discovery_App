import React from 'react';
import { Share2 } from 'lucide-react';

export function SponsorshipPortalSection({
    sponsorTitle, onSponsorTitleChange,
    sponsorLink, onSponsorLinkChange,
    sponsorEmail, onSponsorEmailChange,
    rewardPerUserUSD, onRewardPerUserUSDChange,
    targetClaims, onTargetClaimsChange,
    isBaseSocialRequired, onIsBaseSocialRequiredChange,
    currentTokenPrice,
    currentPlatformFee,
    onCreateSponsorship,
    isSponsorSaving
}) {
    return (
        <div className="glass-card p-8 bg-indigo-950/10 border border-indigo-500/10 shadow-2xl relative rounded-3xl overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-indigo-500 animate-pulse" />
            </div>

            <div className="mb-6">
                <h3 className="text-2xl font-black text-white flex items-center gap-2 uppercase italic">
                    <Share2 className="w-6 h-6 text-indigo-400" /> Sponsor Engagement <span className="text-indigo-500">Portal</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-[0.2em] font-black text-left italic">v3.42.0 Identity Hardened Interface</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-indigo-400 uppercase mb-2 block tracking-widest">Project / Campaign Name</label>
                            <input
                                value={sponsorTitle}
                                onChange={(e) => onSponsorTitleChange(e.target.value)}
                                placeholder="e.g. Disco Gacha Season 1"
                                className="w-full bg-slate-900/50 border border-white/5 p-4 rounded-2xl text-white font-black uppercase tracking-tight focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-indigo-400 uppercase mb-2 block tracking-widest">Landing Link</label>
                            <input
                                value={sponsorLink}
                                onChange={(e) => onSponsorLinkChange(e.target.value)}
                                placeholder="https://"
                                className="w-full bg-slate-900/50 border border-white/5 p-4 rounded-2xl text-white font-mono text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-indigo-400 uppercase mb-2 block tracking-widest">Contact Email (Internal)</label>
                            <input
                                value={sponsorEmail}
                                onChange={(e) => onSponsorEmailChange(e.target.value)}
                                placeholder="sponsor@example.com"
                                className="w-full bg-slate-900/50 border border-white/5 p-4 rounded-2xl text-white font-black uppercase tracking-tight focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* IDENTITY GUARD (v3.42.0) */}
                    <div className={`p-5 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between group ${isBaseSocialRequired ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}
                         onClick={() => onIsBaseSocialRequiredChange(!isBaseSocialRequired)}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isBaseSocialRequired ? 'bg-blue-500 text-white rotate-12 scale-110' : 'bg-slate-800 text-slate-500 shadow-inner'}`}>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-[11px] font-black uppercase tracking-widest ${isBaseSocialRequired ? 'text-blue-400' : 'text-slate-500'}`}>Identity Guard</span>
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Require Base Social (Basenames)</span>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isBaseSocialRequired ? 'bg-blue-600' : 'bg-slate-800'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform transform ${isBaseSocialRequired ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </div>

                <div className="glass-card bg-indigo-500/5 border border-indigo-500/20 p-6 flex flex-col justify-between rounded-2xl">
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-indigo-400 uppercase mb-1 block">Reward per User (USD)</label>
                                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-white/5">
                                    <span className="text-slate-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={rewardPerUserUSD}
                                        onChange={(e) => onRewardPerUserUSDChange(e.target.value)}
                                        className="w-full bg-transparent text-white font-black outline-none"
                                    />
                                </div>
                            </div>
                            <div className="px-4 text-slate-700 text-xl font-black">×</div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-indigo-400 uppercase mb-1 block">Target Claims</label>
                                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-white/5">
                                    <input
                                        type="number"
                                        value={targetClaims}
                                        onChange={(e) => onTargetClaimsChange(e.target.value)}
                                        className="w-full bg-transparent text-white font-black outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Total Reward Pool Value:</span>
                                <span className="text-white font-black">${(parseFloat(rewardPerUserUSD) * parseFloat(targetClaims)).toLocaleString()} USD</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Equivalent Tokens:</span>
                                <span className="text-indigo-400 font-black">
                                    {currentTokenPrice ? ((parseFloat(rewardPerUserUSD) * parseFloat(targetClaims) * 1e18) / Number(currentTokenPrice)).toFixed(2) : '0.00'} CT
                                </span>
                            </div>
                            <div className="flex justify-between text-xs pt-2 border-t border-white/5">
                                <span className="text-slate-500">Listing Platform Fee:</span>
                                <span className="text-emerald-400 font-black">
                                    {currentPlatformFee ? (Number(currentPlatformFee) / 1e6).toFixed(2) : '1.00'} USDC
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onCreateSponsorship}
                        disabled={isSponsorSaving}
                        className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 disabled:opacity-50 transition-all"
                    >
                        {isSponsorSaving ? 'Submitting to Base...' : 'Deploy Sponsorship'}
                    </button>
                </div>
            </div>
        </div>
    );
}
