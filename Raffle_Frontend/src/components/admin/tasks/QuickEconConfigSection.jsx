import React from 'react';
import { TrendingUp } from 'lucide-react';
import { Transaction, TransactionButton } from '@coinbase/onchainkit/transaction';

export function QuickEconConfigSection({
    configPlatformFee, onConfigPlatformFeeChange,
    configMinPool, onConfigMinPoolChange,
    configMinReward, onConfigMinRewardChange,
    buildConfigCall,
    handleTxSuccess
}) {
    return (
        <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4 text-left">
            <h3 className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" /> Economic Command Center
            </h3>
            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl mb-2">
                <p className="text-[8px] text-red-400 font-black uppercase leading-relaxed text-left">
                    Warning: Adjusting these parameters immediately affects all new sponsorship requests and operational profit margins.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Sponsorship Listing Fee (USDC)</label>
                    <input value={configPlatformFee} onChange={e => onConfigPlatformFeeChange(e.target.value)} placeholder="e.g. 1.00" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-500/30 transition-colors" />
                </div>
                <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Minimum Aggregate Pool (USD)</label>
                    <input value={configMinPool} onChange={e => onConfigMinPoolChange(e.target.value)} placeholder="e.g. 5.00" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-500/30 transition-colors" />
                </div>
                <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Minimum Reward Per User (USD)</label>
                    <input value={configMinReward} onChange={e => onConfigMinRewardChange(e.target.value)} placeholder="e.g. 0.01" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-500/30 transition-colors" />
                </div>
            </div>
            <Transaction calls={buildConfigCall()} onSuccess={handleTxSuccess}>
                <TransactionButton className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20" text="UPDATE PROTOCOL ECONOMICS" />
            </Transaction>
        </div>
    );
}
