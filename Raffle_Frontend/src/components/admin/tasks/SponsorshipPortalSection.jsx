import React from 'react';
import { Share2 } from 'lucide-react';

export function SponsorshipPortalSection({
    sponsorTitle, onSponsorTitleChange,
    sponsorLink, onSponsorLinkChange,
    sponsorEmail, onSponsorEmailChange,
    rewardPerUserUSD, onRewardPerUserUSDChange,
    targetClaims, onTargetClaimsChange,
    currentTokenPrice,
    currentPlatformFee,
    onCreateSponsorship,
    isSponsorSaving
}) {
    return (
        <div className="glass-card p-8 bg-indigo-950/10 border border-indigo-500/10 shadow-2xl relative rounded-3xl">
            <div className="mb-6">
                <h3 className="text-2xl font-black text-white flex items-center gap-2 uppercase">
                    <Share2 className="w-6 h-6 text-indigo-400" /> Sponsor Engagement Portal
                </h3>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold text-left">Paid campaigns using Creator Tokens</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-indigo-400 uppercase mb-1 block">Project / Campaign Name</label>
                        <input
                            value={sponsorTitle}
                            onChange={(e) => onSponsorTitleChange(e.target.value)}
                            placeholder="e.g. Disco Gacha Season 1"
                            className="w-full bg-slate-900/50 border border-white/10 p-4 rounded-2xl text-white font-bold focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-indigo-400 uppercase mb-1 block">Landing Link</label>
                        <input
                            value={sponsorLink}
                            onChange={(e) => onSponsorLinkChange(e.target.value)}
                            placeholder="https://"
                            className="w-full bg-slate-900/50 border border-white/10 p-4 rounded-2xl text-white font-mono text-sm focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-indigo-400 uppercase mb-1 block">Contact Email</label>
                        <input
                            value={sponsorEmail}
                            onChange={(e) => onSponsorEmailChange(e.target.value)}
                            placeholder="sponsor@example.com"
                            className="w-full bg-slate-900/50 border border-white/10 p-4 rounded-2xl text-white focus:border-indigo-500 outline-none"
                        />
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
