import React from 'react';
import { Zap, TrendingUp } from 'lucide-react';
import { AdminTransactionButton } from '../AdminTransactionButton';
import { formatUnits } from 'viem';

export function QuickSponsorPortalSection({
    sponsorTitle, onSponsorTitleChange,
    sponsorLink, onSponsorLinkChange,
    sponsorEmail, onSponsorEmailChange,
    sponsorTotalClaims, onSponsorTotalClaimsChange,
    sponsorRewardPerUser, onSponsorRewardPerUserChange,
    platformFee,
    minRewardUSD,
    minPoolUSD,
    totalPoolUSD,
    requiredTokens,
    buildSponsorCall,
    handleTxSuccess
}) {
    return (
        <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4 text-left">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-yellow-500" /> Sponsor-Grade Engagement
            </h3>
            <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-indigo-400" />
                    <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.15em]">Dynamic Profit & Loss Control</span>
                </div>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.1em] leading-relaxed">
                    Listing Fee: <span className="text-white">${formatUnits(platformFee || 1000000n, 6)} USDC</span>.
                    Min Reward $ / User: <span className="text-green-500">${formatUnits(minRewardUSD || 10000000000000000n, 18)}</span>.
                </p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                    <input placeholder="App/Community Name" value={sponsorTitle} onChange={e => onSponsorTitleChange(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-[13px] font-medium text-white outline-none focus:border-indigo-500/50" />
                    <input placeholder="Destination URL (Farcaster/X/App)" value={sponsorLink} onChange={e => onSponsorLinkChange(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-[13px] font-medium text-white outline-none focus:border-indigo-500/50" />
                    <input placeholder="Contact Email (Verification Only)" value={sponsorEmail} onChange={e => onSponsorEmailChange(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-[13px] font-medium text-white outline-none focus:border-indigo-500/50" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-[0.2em] px-1">Total Reward Slots</label>
                        <input type="number" value={sponsorTotalClaims} onChange={e => onSponsorTotalClaimsChange(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-[13px] text-white font-black outline-none" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-[0.2em] px-1">USD Value Per User</label>
                        <input type="number" step="0.01" value={sponsorRewardPerUser} onChange={e => onSponsorRewardPerUserChange(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-[13px] text-green-500 font-black outline-none" />
                    </div>
                </div>
            </div>

            <div className="p-4 bg-[#0a0a0c] rounded-xl border-2 border-indigo-500/30 flex justify-between items-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col relative z-10">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em]">Aggregate Reward Pool</span>
                    <span className="text-xl font-black text-white">${totalPoolUSD.toFixed(2)} USD</span>
                </div>
                <div className="flex flex-col items-end relative z-10">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em]">Token Requirement</span>
                    <span className="text-[13px] font-black text-indigo-400 font-mono">{formatUnits(requiredTokens, 18)} $DISCO</span>
                </div>
            </div>

            <AdminTransactionButton 
                disabled={totalPoolUSD < Number(formatUnits(minPoolUSD || 0n, 18))}
                calls={buildSponsorCall()} 
                onSuccess={handleTxSuccess}
                text={totalPoolUSD < Number(formatUnits(minPoolUSD || 0n, 18)) ? `MIN POOL $${formatUnits(minPoolUSD || 5000000000000000000n, 18)} REQUIRED` : `REQUEST SPONSORSHIP ($${totalPoolUSD.toFixed(2)})`}
                className="w-full py-4 bg-white hover:bg-slate-100 text-black rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl disabled:opacity-30 disabled:grayscale transition-all"
            />
        </div>
    );
}
