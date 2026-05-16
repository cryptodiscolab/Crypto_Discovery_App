import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
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
    onSuccess: (_hash: `0x${string}`) => Promise<void>;
    onInsufficientBalance?: () => void;
}

/**
 * PayAndCreateMissionButton Component
 * Internal to CreateTaskModal for now.
 */
function PayAndCreateMissionButton({ calls, _ethReward, address, _tasksBatch, _selectedTokenAddr, onSuccess, _onInsufficientBalance }: PayAndCreateMissionButtonProps) {
    const { writeContractAsync } = useWriteContract();
    const [isCreating, setIsCreating] = useState(false);
    const publicClient = usePublicClient();

    const handleCreate = async () => {
        if (!address) return toast.error("Connect wallet!");
        if (calls.length === 0) return toast.error("Batch is empty!");
        setIsCreating(true);
        const tid = toast.loading("Processing Mission Batch...");
        try {
            const mainCall = calls.find(c => c.functionName === 'buySponsorshipWithToken');
            const approveCalls = calls.filter(c => c.functionName === 'approve');
            for (const appCall of approveCalls) {
                toast.loading(`Approving ${appCall.address === CONTRACTS.USDC ? 'USDC' : 'Reward Token'}...`, { id: tid });
                const appHash = await writeContractAsync(appCall as unknown);
                await publicClient!.waitForTransactionReceipt({ hash: appHash });
            }
            toast.loading("Creating Mission Batch on-chain...", { id: tid });
            const hash = await writeContractAsync(mainCall as unknown);
            const receipt = await publicClient!.waitForTransactionReceipt({ hash });
            if (receipt.status === 'success') {
                await onSuccess(hash);
            } else {
                throw new Error("Transaction failed");
            }
        } catch (err: unknown) {
            toast.error(err.shortMessage || err.message || "Action failed", { id: tid });
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

    const { data: qSponsorFee } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: qMinPool } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'minRewardPoolValue' });
    const { data: qRewardClaim } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'rewardPerClaim' });

    const allowedTokens: unknown[] = (ecosystemSettings as unknown)?.allowed_tokens || (ecosystemSettings as unknown)?.whitelisted_tokens || [];
    const ethToken = allowedTokens.find((t: unknown) => t.symbol === 'ETH') || allowedTokens[0];
    const usdcToken = allowedTokens.find((t: unknown) => t.symbol === 'USDC');

    const [selectedTokenAddr, setSelectedTokenAddr] = useState<string>(ethToken?.address || "0x0000000000000000000000000000000000000000");
    const selectedToken = allowedTokens.find((t: unknown) => t.address?.toLowerCase() === selectedTokenAddr?.toLowerCase()) || ethToken;

    const [ethReward, setEthReward] = useState(() => {
        const rawValue = (ecosystemSettings as unknown)?.ugc_config?.min_reward_amount || '0.1';
        return rawValue;
    });

    const [sybilFilters, _setSybilFilters] = useState({
        minNeynarScore: 0, minFollowers: 0, accountAgeDays: 0,
        powerBadge: false, requiresVerification: true, isBaseSocialRequired: false
    });

    useEffect(() => {
        if (qMinPool && ethReward === '0.1') {
            setEthReward(formatUnits(qMinPool as bigint, 6));
        }
    }, [qMinPool, ethReward]);

    const feeUsd = qSponsorFee ? Number(formatUnits(qSponsorFee as bigint, 6)) : Number((ecosystemSettings as unknown)?.ugc_config?.listing_fee_usdc || 0);
    const { prices } = usePriceOracle(allowedTokens.map((t: unknown) => t.address));
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
                            {allowedTokens.map((t: unknown, i: number) => <option key={i} value={t.address || "0x0000000000000000000000000000000000000000"} className="bg-zinc-900">{t.symbol}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Reward Pool Amount ({selectedToken?.symbol})</label>
                        <input type="number" step="0.001" value={ethReward} onChange={(e) => setEthReward(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-lg font-mono font-black text-indigo-400 outline-none" placeholder="0.01" />
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
                                        max_participants: (ecosystemSettings as unknown)?.ugc_config?.default_participants || 100,
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
