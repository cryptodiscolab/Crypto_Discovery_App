import { useState } from 'react';
import { X, Loader2, Calculator, Info } from 'lucide-react';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { usePoints } from '../../../../shared/context/PointsContext';
import { usePriceOracle } from '../../../../hooks/usePriceOracle';

interface TaskBatchItem {
    platform: string;
    action_type: string;
    title: string;
    link: string;
}

interface AllowedToken {
    symbol: string;
    address: string;
    decimals?: number;
}

interface PayAndCreateMissionButtonProps {
    address?: `0x${string}`;
}

/**
 * PayAndCreateMissionButton Component
 * Internal to CreateTaskModal for now.
 */
function PayAndCreateMissionButton({
    address,
}: PayAndCreateMissionButtonProps) {
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!address) return toast.error("Connect wallet!");
        setIsCreating(true);
        toast.error("DailyApp V16 no longer supports legacy on-chain sponsorship creation. Use the raffle/UGC campaign flow.");
        setIsCreating(false);
    };

    return (
        <button onClick={handleCreate} disabled={isCreating || !address} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
            {isCreating ? <Loader2 className="animate-spin mx-auto" /> : `DEPLOY MISSION BATCH`}
        </button>
    );
}

interface CreateTaskModalProps {
    onClose: () => void;
    onRequestSwap?: () => void;
}

/**
 * CreateTaskModal Component
 * [v3.60.0] Modular Feature-Based Architecture
 */
export function CreateTaskModal({ onClose }: CreateTaskModalProps) {
    const [tasksBatch, setTasksBatch] = useState<TaskBatchItem[]>([
        { platform: 'farcaster', action_type: 'follow', title: '', link: '' },
        { platform: 'x', action_type: 'follow', title: '', link: '' },
        { platform: 'base', action_type: 'follow', title: '', link: '' }
    ]);
    const { address } = useAccount();
    const { ecosystemSettings } = usePoints();

    const allowedTokens = ((ecosystemSettings as { allowed_tokens?: AllowedToken[]; whitelisted_tokens?: AllowedToken[] })?.allowed_tokens
        || (ecosystemSettings as { allowed_tokens?: AllowedToken[]; whitelisted_tokens?: AllowedToken[] })?.whitelisted_tokens
        || []) as AllowedToken[];
    const ethToken = allowedTokens.find((t) => t.symbol === 'ETH') || allowedTokens[0];
    const [selectedTokenAddr, setSelectedTokenAddr] = useState<string>(ethToken?.address || "0x0000000000000000000000000000000000000000");
    const selectedToken = allowedTokens.find((t) => t.address?.toLowerCase() === selectedTokenAddr?.toLowerCase()) || ethToken;

    const [ethReward, setEthReward] = useState(() => {
        const rawValue = (ecosystemSettings as { ugc_config?: { min_reward_amount?: string } })?.ugc_config?.min_reward_amount || '0.1';
        return rawValue;
    });

    const feeUsd = Number((ecosystemSettings as { ugc_config?: { listing_fee_usdc?: string } })?.ugc_config?.listing_fee_usdc || 0);
    const { prices } = usePriceOracle(allowedTokens.map((t) => t.address));
    const currentPrice = prices[selectedTokenAddr?.toLowerCase()] || 0;
    const _rewardUsdValue = currentPrice * parseFloat(ethReward || '0');

    const rewardPerClaimVal = 0.20;
    const _targetParticipants = Math.floor(parseFloat(ethReward || '0') / (rewardPerClaimVal || 1));

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[10001] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-white/5">
                <h2 className="text-lg font-black text-white italic tracking-tighter">CREATE <span className="text-indigo-500">TASK BATCH</span></h2>
                <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="space-y-4">
                    {tasksBatch.map((task, idx) => (
                        <div key={idx} className="bg-zinc-900 border border-white/5 p-4 rounded-2xl space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[11px] font-black text-indigo-400">{idx + 1}</div>
                                <select
                                    value={task.platform}
                                    onChange={(e) => { const nb = [...tasksBatch]; nb[idx].platform = e.target.value; setTasksBatch(nb); }}
                                    className="bg-transparent text-[11px] font-black text-slate-400 outline-none uppercase tracking-widest cursor-pointer"
                                >
                                    <option value="farcaster">Farcaster</option>
                                    <option value="x">X (Twitter)</option>
                                    <option value="base">Base App</option>
                                    <option value="tiktok">TikTok</option>
                                    <option value="instagram">Instagram</option>
                                </select>
                            </div>
                            <input type="text" placeholder="Task Title (e.g. Follow @disco)" value={task.title} onChange={(e) => { const nb = [...tasksBatch]; nb[idx].title = e.target.value; setTasksBatch(nb); }} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white focus:border-indigo-500 outline-none" />
                            <input type="text" placeholder="Link URL" value={task.link} onChange={(e) => { const nb = [...tasksBatch]; nb[idx].link = e.target.value; setTasksBatch(nb); }} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-indigo-400 font-mono focus:border-indigo-500 outline-none" />
                        </div>
                    ))}
                </div>

                <div className="p-5 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 space-y-5">
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sponsorship Asset</label>
                        <select value={selectedTokenAddr} onChange={(e) => setSelectedTokenAddr(e.target.value)} className="w-full bg-zinc-900/50 border border-indigo-500/30 rounded-2xl px-4 py-4 text-[11px] font-black uppercase tracking-widest text-white outline-none">
                            {allowedTokens.map((t, i) => <option key={i} value={t.address || "0x0000000000000000000000000000000000000000"} className="bg-zinc-900">{t.symbol}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Reward Pool Amount ({selectedToken?.symbol})</label>
                        <input type="number" step="0.001" value={ethReward} onChange={(e) => setEthReward(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-lg font-mono font-black text-indigo-400 outline-none" placeholder="0.01" />
                        {selectedToken?.symbol !== 'USDC' && currentPrice > 0 && (
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1 text-right mt-1">
                                ≈ {_rewardUsdValue.toFixed(2)} USDC
                            </p>
                        )}
                    </div>
                </div>

                {/* 3. Cost Breakdown Panel [v3.64.0] */}
                <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <Calculator className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-[11px] font-black text-white uppercase tracking-widest">COST BREAKDOWN</h4>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                            <span>Campaign Reward Pool</span>
                            <div className="text-right">
                                <span className="text-white font-mono">{parseFloat(ethReward || '0').toFixed(selectedToken?.symbol === 'ETH' ? 6 : 2)} {selectedToken?.symbol || 'ETH'}</span>
                                {selectedToken?.symbol !== 'USDC' && currentPrice > 0 && (
                                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                        ≈ {_rewardUsdValue.toFixed(2)} USDC
                                    </span>
                                )}
                            </div>
                        </div>
                        {((selectedToken?.symbol === 'USDC' ? 1 : currentPrice) > 0) && (
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500 -mt-1.5 px-1">
                                <span>Token Price ({selectedToken?.symbol})</span>
                                <span className="font-mono">${(selectedToken?.symbol === 'USDC' ? 1 : currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                            <span>Platform Listing Fee</span>
                            <span className="text-indigo-400 font-mono">{feeUsd.toFixed(2)} USDC</span>
                        </div>
                        
                        <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Estimated Total Cost</span>
                            <div className="text-right">
                                <p className="text-xs font-black text-indigo-400 font-mono">
                                    {parseFloat(ethReward || '0').toFixed(selectedToken?.symbol === 'ETH' ? 4 : 2)} {selectedToken?.symbol || 'ETH'}
                                    {feeUsd > 0 && ` + ${feeUsd.toFixed(2)} USDC`}
                                </p>
                                {((selectedToken?.symbol === 'USDC' ? 1 : currentPrice) > 0) && (
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                        ≈ ${((selectedToken?.symbol === 'USDC' ? 1 : currentPrice) * parseFloat(ethReward || '0') + feeUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex gap-2">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tight leading-relaxed">
                            Listing Fee (${feeUsd.toFixed(2)} USDC) is required to prevent campaign spamming. Rewards are funded directly to the smart contract and distributed securely to verified participants.
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-black/50">
                <PayAndCreateMissionButton
                    address={address}
                />
            </div>
        </div>
    );
}
