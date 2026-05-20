import { useState, useEffect } from 'react';
import { X, Loader2, Calculator, Info } from 'lucide-react';
import { useAccount, useSignMessage, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { useUserInfo } from '../../../../hooks/useContract';
import { usePoints } from '../../../../shared/context/PointsContext';
import { usePriceOracle } from '../../../../hooks/usePriceOracle';
import { DAILY_APP_ABI, CONTRACTS, ERC20_ABI } from '../../../../lib/contracts';

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

interface ContractCall {
    address: `0x${string}`;
    abi: unknown[];
    functionName: string;
    args?: unknown[];
    value?: bigint;
}

interface PayAndCreateMissionButtonProps {
    calls: ContractCall[];
    ethReward: string;
    address?: `0x${string}`;
    tasksBatch: TaskBatchItem[];
    selectedTokenAddr: string;
    selectedTokenBalance: bigint;
    usdcBalance: bigint;
    platformFee: bigint;
    rewardAmount: bigint;
    selectedTokenSymbol: string;
    onSuccess: (_hash: `0x${string}`) => Promise<void>;
    onInsufficientBalance?: () => void;
}

/**
 * PayAndCreateMissionButton Component
 * Internal to CreateTaskModal for now.
 */
function PayAndCreateMissionButton({
    calls,
    address,
    onSuccess,
    selectedTokenBalance,
    usdcBalance,
    platformFee,
    rewardAmount,
    selectedTokenAddr,
    selectedTokenSymbol,
    onInsufficientBalance
}: PayAndCreateMissionButtonProps) {
    const { writeContractAsync } = useWriteContract();
    const [isCreating, setIsCreating] = useState(false);
    const publicClient = usePublicClient();

    const handleCreate = async () => {
        if (!address) return toast.error("Connect wallet!");
        if (calls.length === 0) return toast.error("Batch is empty!");

        // 1. Check USDC Balance for Platform Listing Fee
        if (usdcBalance < platformFee) {
            toast.error(`Insufficient USDC balance for listing fee. Required: ${formatUnits(platformFee, 6)} USDC. Available: ${formatUnits(usdcBalance, 6)} USDC.`);
            if (onInsufficientBalance) {
                toast.loading("Opening swap modal...", { duration: 2000 });
                setTimeout(() => onInsufficientBalance(), 1000);
            }
            return;
        }

        // 2. Check Selected Token Balance for Reward Pool
        const isNativeETH = selectedTokenAddr === "0x0000000000000000000000000000000000000000";
        if (isNativeETH) {
            if (selectedTokenBalance < rewardAmount) {
                toast.error(`Insufficient ETH balance for reward pool. Required: ${formatUnits(rewardAmount, 18)} ETH. Available: ${formatUnits(selectedTokenBalance, 18)} ETH.`);
                if (onInsufficientBalance) {
                    toast.loading("Opening swap modal...", { duration: 2000 });
                    setTimeout(() => onInsufficientBalance(), 1000);
                }
                return;
            }
        } else {
            const isUsdc = selectedTokenAddr.toLowerCase() === (CONTRACTS.USDC || "").toLowerCase();
            const totalRequired = isUsdc ? (platformFee + rewardAmount) : rewardAmount;
            const currentBalance = isUsdc ? usdcBalance : selectedTokenBalance;
            const decimals = isUsdc ? 6 : 18;

            if (currentBalance < totalRequired) {
                toast.error(`Insufficient ${selectedTokenSymbol} balance for reward pool. Required: ${formatUnits(totalRequired, decimals)} ${selectedTokenSymbol}. Available: ${formatUnits(currentBalance, decimals)} ${selectedTokenSymbol}.`);
                if (onInsufficientBalance) {
                    toast.loading("Opening swap modal...", { duration: 2000 });
                    setTimeout(() => onInsufficientBalance(), 1000);
                }
                return;
            }
        }

        setIsCreating(true);
        const tid = toast.loading("Processing Mission Batch...");
        try {
            const mainCall = calls.find(c => c.functionName === 'buySponsorshipWithToken');
            const approveCalls = calls.filter(c => c.functionName === 'approve');
            for (const appCall of approveCalls) {
                toast.loading(`Approving ${appCall.address === CONTRACTS.USDC ? 'USDC' : 'Reward Token'}...`, { id: tid });
                const appHash = await writeContractAsync(appCall as Parameters<typeof writeContractAsync>[0]);
                await publicClient!.waitForTransactionReceipt({ hash: appHash });
            }
            toast.loading("Creating Mission Batch on-chain...", { id: tid });
            const hash = await writeContractAsync(mainCall as Parameters<typeof writeContractAsync>[0]);
            const receipt = await publicClient!.waitForTransactionReceipt({ hash });
            if (receipt.status === 'success') {
                await onSuccess(hash);
            } else {
                throw new Error("Transaction failed");
            }
        } catch (err: unknown) {
            const e = err as { shortMessage?: string; message?: string };
            toast.error(e.shortMessage || e.message || "Action failed", { id: tid });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <button onClick={handleCreate} disabled={isCreating} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
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
export function CreateTaskModal({ onClose, onRequestSwap }: CreateTaskModalProps) {
    const [tasksBatch, setTasksBatch] = useState<TaskBatchItem[]>([
        { platform: 'farcaster', action_type: 'follow', title: '', link: '' },
        { platform: 'x', action_type: 'follow', title: '', link: '' },
        { platform: 'base', action_type: 'follow', title: '', link: '' }
    ]);
    const [email, _setEmail] = useState('');
    const [_showAdvanced, _setShowAdvanced] = useState(false);
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { refetch: refetchStats } = useUserInfo(address);
    const { ecosystemSettings } = usePoints();

    const allowedTokens = ((ecosystemSettings as { allowed_tokens?: AllowedToken[]; whitelisted_tokens?: AllowedToken[] })?.allowed_tokens
        || (ecosystemSettings as { allowed_tokens?: AllowedToken[]; whitelisted_tokens?: AllowedToken[] })?.whitelisted_tokens
        || []) as AllowedToken[];
    const ethToken = allowedTokens.find((t) => t.symbol === 'ETH') || allowedTokens[0];
    const usdcToken = allowedTokens.find((t) => t.symbol === 'USDC');

    const [selectedTokenAddr, setSelectedTokenAddr] = useState<string>(ethToken?.address || "0x0000000000000000000000000000000000000000");
    const selectedToken = allowedTokens.find((t) => t.address?.toLowerCase() === selectedTokenAddr?.toLowerCase()) || ethToken;

    const [selectedTokenBalance, setSelectedTokenBalance] = useState<bigint>(0n);
    const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
    const publicClient = usePublicClient();

    const fetchBalances = async () => {
        if (!address || !publicClient) return;
        try {
            // 1. Fetch Selected Token Balance
            if (selectedTokenAddr === '0x0000000000000000000000000000000000000000') {
                const bal = await publicClient.getBalance({ address });
                setSelectedTokenBalance(bal);
            } else {
                const bal = await publicClient.readContract({
                    address: selectedTokenAddr as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [address]
                });
                setSelectedTokenBalance(bal as bigint);
            }

            // 2. Fetch USDC Balance for platform fee validation
            if (CONTRACTS.USDC) {
                const uBal = await publicClient.readContract({
                    address: CONTRACTS.USDC as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [address]
                });
                setUsdcBalance(uBal as bigint);
            }
        } catch (err) {
            console.warn('[CreateTaskModal] Balance fetch lag:', err);
        }
    };

    useEffect(() => {
        fetchBalances();
        const interval = setInterval(fetchBalances, 10000);
        return () => clearInterval(interval);
    }, [address, selectedTokenAddr, publicClient]);

    const { data: qSponsorFee } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: qMinPool } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'minRewardPoolValue' });
    const { data: qRewardClaim } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'rewardPerClaim' });

    const [ethReward, setEthReward] = useState(() => {
        const rawValue = (ecosystemSettings as { ugc_config?: { min_reward_amount?: string } })?.ugc_config?.min_reward_amount || '0.1';
        return rawValue;
    });

    const [sybilFilters, _setSybilFilters] = useState({
        minNeynarScore: 0, minFollowers: 0, accountAgeDays: 0,
        powerBadge: false, requiresVerification: true, isBaseSocialRequired: false
    });

    useEffect(() => {
        if (qMinPool && (ethReward === '0.1' || ethReward === '0.01')) {
            setEthReward(formatUnits(qMinPool as bigint, 6));
        }
    }, [qMinPool, ethReward]);

    const feeUsd = qSponsorFee ? Number(formatUnits(qSponsorFee as bigint, 6)) : Number((ecosystemSettings as { ugc_config?: { listing_fee_usdc?: string } })?.ugc_config?.listing_fee_usdc || 0);
    const { prices } = usePriceOracle(allowedTokens.map((t) => t.address));
    const currentPrice = prices[selectedTokenAddr?.toLowerCase()] || 0;
    const _rewardUsdValue = currentPrice * parseFloat(ethReward || '0');

    const rewardPerClaimVal = qRewardClaim ? parseFloat(formatUnits(qRewardClaim as bigint, 6)) : 0.20;
    const _targetParticipants = Math.floor(parseFloat(ethReward || '0') / (rewardPerClaimVal || 1));

    const tokenDecimals = selectedToken?.decimals || 18;
    const rewardAmount = parseUnits(ethReward || '0', tokenDecimals);

    const usdcDecimals = usdcToken?.decimals || 6;
    const platformFee = qSponsorFee ? (qSponsorFee as bigint) : parseUnits(feeUsd.toString(), usdcDecimals);

    const buildCalls = (): ContractCall[] => {
        const titles = tasksBatch.filter(t => t.title && t.link).map(t => t.title);
        const links = tasksBatch.filter(t => t.title && t.link).map(t => t.link);
        if (titles.length === 0) return [];
        const calls: ContractCall[] = [];

        if (platformFee > 0n) {
            calls.push({ address: CONTRACTS.USDC as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.DAILY_APP, platformFee] });
        }

        const isNativeETH = selectedTokenAddr === "0x0000000000000000000000000000000000000000";
        if (!isNativeETH && rewardAmount > 0n) {
            calls.push({ address: selectedTokenAddr as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.DAILY_APP, rewardAmount] });
        }

        calls.push({
            address: CONTRACTS.DAILY_APP as `0x${string}`,
            abi: DAILY_APP_ABI,
            functionName: 'buySponsorshipWithToken',
            args: [0, titles, links, email, isNativeETH ? 0n : rewardAmount, selectedTokenAddr],
            value: isNativeETH ? rewardAmount : 0n,
        });

        return calls;
    };

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
                    calls={buildCalls()}
                    ethReward={ethReward}
                    address={address}
                    tasksBatch={tasksBatch}
                    selectedTokenAddr={selectedTokenAddr}
                    selectedTokenBalance={selectedTokenBalance}
                    usdcBalance={usdcBalance}
                    platformFee={platformFee}
                    rewardAmount={rewardAmount}
                    selectedTokenSymbol={selectedToken?.symbol || 'ETH'}
                    onInsufficientBalance={onRequestSwap}
                    onSuccess={async (hash) => {
                        toast.success("Missions Created Successfully! Syncing... 🚀");
                        try {
                            const timestamp = new Date().toISOString();
                            const taskCount = tasksBatch.filter(t => t.title && t.link).length;
                            const firstTask = tasksBatch.find(t => t.title && t.link) || { title: "New Missions", platform: "farcaster" };
                            const message = `Log activity for ${address}\nAction: UGC Mission Creation\nTimestamp: ${timestamp}`;
                            const signature = await signMessageAsync({ message });
                            await fetch('/api/user-bundle', {
                                method: 'POST',
                                headers: { 'content-type': 'application/json' },
                                body: JSON.stringify({
                                    action: 'sync-ugc-mission', wallet: address, signature, message,
                                    payload: {
                                        title: firstTask.title,
                                        description: `UGC Campaign with ${taskCount} missions on ${firstTask.platform}`,
                                        sponsor_address: address, platform_code: firstTask.platform,
                                        reward_amount_per_user: ethReward.toString(),
                                        max_participants: (ecosystemSettings as { ugc_config?: { default_participants?: number } })?.ugc_config?.default_participants || 100,
                                        txHash: hash, payment_token: selectedTokenAddr, // gitleaks:allow - token contract address field, not an API secret.
                                        reward_symbol: selectedToken?.symbol || 'ETH',
                                        is_base_social_required: sybilFilters.isBaseSocialRequired,
                                        tasks_batch: tasksBatch.filter(t => t.title && t.link)
                                    }
                                }),
                            });
                            toast.success("Campaign synced!");
                        } catch (logErr) {
                            console.warn('UGC Sync failed:', logErr);
                        }
                        await refetchStats();
                        onClose();
                    }}
                />
            </div>
        </div>
    );
}
