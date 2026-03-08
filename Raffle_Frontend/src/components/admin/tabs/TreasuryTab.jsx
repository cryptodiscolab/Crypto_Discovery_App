import React, { useState } from 'react';
import { Landmark, ArrowUpRight } from 'lucide-react';
import { parseEther } from 'viem';
import toast from 'react-hot-toast';

import { SAFE_MULTISIG } from '../../../lib/contracts';

export function TreasuryTab({ onWithdraw }) {
    const [amount, setAmount] = useState('0.1');
    const [isBusy, setIsBusy] = useState(false);

    const handleWithdraw = async () => {
        if (!window.confirm(`Withdraw ${amount} ETH to Safe Multisig (${SAFE_MULTISIG})?`)) return;

        setIsBusy(true);
        const tid = toast.loading("Processing treasury withdrawal...");
        try {
            await onWithdraw(parseEther(amount));
            toast.success("Treasury fueled!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || "Withdrawal failed", { id: tid });
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="glass-card p-10 bg-emerald-950/10 border border-emerald-500/10 rounded-3xl">
            <div className="flex flex-col md:flex-row gap-10 items-center">
                <div className="p-8 bg-emerald-500/10 rounded-3xl border border-emerald-500/20">
                    <Landmark className="w-20 h-20 text-emerald-400" />
                </div>

                <div className="flex-1 text-left">
                    <h3 className="text-2xl font-black text-white mb-2">Treasury Controls</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-md">
                        Accumulated reserve (10%) for long-term project stability.
                        Funds are sent directly to the specified **Safe Multisig** for maximum security.
                    </p>

                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-slate-900/50 border border-emerald-500/20 p-4 rounded-2xl text-white text-xl font-bold focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={handleWithdraw}
                            className="bg-emerald-600 hover:bg-emerald-500 p-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all"
                        >
                            <ArrowUpRight className="w-8 h-8 text-white" />
                        </button>
                    </div>

                    <div className="mt-4 p-3 bg-slate-900/50 rounded-xl border border-white/5">
                        <p className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                            Target SAFE: <span className="text-emerald-400 truncate">{SAFE_MULTISIG}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
