import { useState, useEffect, useRef } from 'react';
import {
    _Plus, _Zap, _Calendar, Loader2, _CheckCircle2, AlertCircle,
    _Star, _Database, _RefreshCw, _Settings, _TrendingUp,
    _Share2, _List, _Clock, _Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabaseClient';
import { DAILY_APP_ABI, CONTRACTS } from '../../../lib/contracts';
import { TaskBatchItem } from '../types/tasks';

// Sub-sections
import { QuickTaskForgeSection } from './tasks/QuickTaskForgeSection';
import { QuickSponsorPortalSection } from './tasks/QuickSponsorPortalSection';
import { TaskBatchCreatorSection } from './tasks/TaskBatchCreatorSection';
import { SponsorshipPortalSection } from './tasks/SponsorshipPortalSection';
import { EconomyConfigSection } from './tasks/EconomyConfigSection';
import { ActiveCampaignsSection } from './tasks/ActiveCampaignsSection';
import { EconomyMetrics } from './EconomyMetrics';

const DAILY_APP_ADDRESS = CONTRACTS.DAILY_APP;

interface TaskManagerProps {
    initialMode?: 'batch' | 'quick';
}

interface PointSetting {
    id: string;
    activity_key: string;
    points_value: number;
    platform: string;
    action_type: string;
    is_active: boolean;
}

interface AllowedToken {
    id: string;
    symbol: string;
    address: string;
    decimals: number;
    chain_id: number;
    is_active: boolean;
}

export function TaskManager({ initialMode = 'quick' }: TaskManagerProps) {
    const { address, chainId } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync, data: hash, error: writeError } = useWriteContract();
    const { data: receipt, isLoading: isWaiting, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

    const [controlMode, setControlMode] = useState<'batch' | 'quick'>(initialMode);
    const [subTab, setSubTab] = useState('daily');
    const syncedHashes = useRef(new Set());

    // --- SHARED DATA ---
    const [pointSettings, setPointSettings] = useState<PointSetting[]>([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);

    const { data: platformFee } = useReadContract({ address: DAILY_APP_ADDRESS as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: minPoolUSD } = useReadContract({ address: DAILY_APP_ADDRESS as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'minRewardPoolValue' });
    const { data: minRewardUSD } = useReadContract({ address: DAILY_APP_ADDRESS as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'rewardPerClaim' });
    const { data: tokenPrice } = useReadContract({ address: DAILY_APP_ADDRESS as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'tokenPriceUSD' });
    const { data: nextTaskId, refetch: refetchTasks } = useReadContract({ address: DAILY_APP_ADDRESS as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'nextTaskId' });
    const { data: nextSponsorId, refetch: refetchSponsors } = useReadContract({ address: DAILY_APP_ADDRESS as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'totalSponsorRequests' });

    // --- QUICK MODE STATES ---
    const [dailyDesc, setDailyDesc] = useState('');
    const [dailyPoints, setDailyPoints] = useState('');
    const [dailyCooldown, setDailyCooldown] = useState('24h');
    const [dailyRequiresVerify, setDailyRequiresVerify] = useState(false);
    const [dailyIsBaseSocialRequired, setDailyIsBaseSocialRequired] = useState(false);
    const [dailyMinTier, setDailyMinTier] = useState(0);

    const [quickSponsorTitle, setQuickSponsorTitle] = useState('');
    const [quickSponsorLink, setQuickSponsorLink] = useState('');
    const [quickSponsorEmail, setQuickSponsorEmail] = useState('');
    const [quickSponsorRewardPerUser, setQuickSponsorRewardPerUser] = useState('0.10');
    const [quickSponsorTotalClaims, setQuickSponsorTotalClaims] = useState('50');
    const [quickSponsorIsBaseSocialRequired, setQuickSponsorIsBaseSocialRequired] = useState(false);

    const [configPlatformFee, setConfigPlatformFee] = useState('');
    const [configMinPool, setConfigMinPool] = useState('');
    const [configMinReward, setConfigMinReward] = useState('');

    // --- BATCH MODE STATES ---
    const [tasksBatch, setTasksBatch] = useState<TaskBatchItem[]>([
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', target_id: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, isBaseSocialRequired: false, minNeynarScore: 0, minFollowers: 0, powerBadgeRequired: false, noSpamFilter: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', target_id: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, isBaseSocialRequired: false, minNeynarScore: 0, minFollowers: 0, powerBadgeRequired: false, noSpamFilter: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', target_id: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, isBaseSocialRequired: false, minNeynarScore: 0, minFollowers: 0, powerBadgeRequired: false, noSpamFilter: true }
    ]);
    const [batchSponsorTitle, setBatchSponsorTitle] = useState('');
    const [batchSponsorLink, setBatchSponsorLink] = useState('');
    const [batchSponsorEmail, setBatchSponsorEmail] = useState('');
    const [batchRewardPerUserUSD, setBatchRewardPerUserUSD] = useState('0.01');
    const [batchTargetClaims, setBatchTargetClaims] = useState('500');
    const [batchIsBaseSocialRequired, setBatchIsBaseSocialRequired] = useState(false);

    // --- TOKEN WHITELIST ---
    const [whitelistedTokens, setWhitelistedTokens] = useState<AllowedToken[]>([]);
    const [selectedTokenAddr, setSelectedTokenAddr] = useState<string>('0x0000000000000000000000000000000000000000');
    const selectedToken = whitelistedTokens.find((t: AllowedToken) => t.address?.toLowerCase() === selectedTokenAddr.toLowerCase());

    // --- INITIALIZATION ---
    useEffect(() => {
        const fetchPoints = async () => {
            try {
                const { data, error } = await supabase.from('point_settings').select('*').eq('is_active', true);
                if (error) throw error;
                if (data) {
                    setPointSettings(data);
                    setTasksBatch(prev => prev.map(task => ({ ...task, baseReward: getGlobalPoints(task.platform, task.action, data) })));
                }
            } finally { setIsLoadingPoints(false); }
        };
        const fetchTokens = async () => {
            if (!chainId) return;
            const { data } = await supabase.from('allowed_tokens').select('*').eq('chain_id', chainId).eq('is_active', true);
            if (data) {
                setWhitelistedTokens(data as AllowedToken[]);
                const eth = (data as AllowedToken[]).find((t: AllowedToken) => t.symbol === 'ETH');
                if (eth) setSelectedTokenAddr(eth.address);
            }
        };
        fetchPoints();
        fetchTokens();
    }, [chainId]);

    const getGlobalPoints = (platform: string, action: string, currentSettings: PointSetting[] = pointSettings) => {
        if (!currentSettings || currentSettings.length === 0) return 0;
        const platMap: Record<string, string> = { 'Farcaster': 'farcaster', 'X': 'x', 'Base App': 'base', 'TikTok': 'tiktok', 'Instagram': 'instagram' };
        const actMap: Record<string, string> = { 'Follow': 'follow', 'Like': 'like', 'Recast/Repost': 'recast', 'Comment': 'comment', 'Quote': 'quote' };
        const platKey = platMap[platform] || platform.toLowerCase();
        let actKey = actMap[action] || action.toLowerCase();
        if (platKey === 'x' && actKey === 'recast') actKey = 'repost';

        const match = currentSettings.find(s =>
            (s.platform?.toLowerCase() === platKey && s.action_type?.toLowerCase() === actKey) ||
            [`task_${platKey}_${actKey}`, `${platKey}_${actKey}`].includes(s.activity_key?.toLowerCase())
        );
        return match ? match.points_value : 0;
    };

    // --- SHARED ACTIONS ---
    const handleTxSuccess = () => {
        toast.success('Blockchain confirmation received!');
    };

    const _syncAuditAction = async (tx: string, action: string, details: Record<string, unknown>) => {
        try {
            const timestamp = new Date().toISOString();
            const message = `Governance Audit Log\nTX: ${tx}\nAdmin: ${address}\nAction: ${action}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });
            await fetch('/api/admin/tasks/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_address: address, signature, message, action: 'AUDIT_GOVERNANCE', tx_hash: tx, governor_action: action, details })
            });
        } catch (err) { console.error('[Audit Sync Error]', err); }
    };

    // --- QUICK MODE LOGIC ---
    const buildQuickTaskCall = () => {
        const cd = dailyCooldown === '24h' ? 86400 : dailyCooldown === '1h' ? 3600 : 43200;
        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI as unknown, functionName: 'addTask',
                args: [BigInt(dailyPoints || 0), BigInt(cd), BigInt(dailyMinTier), dailyDesc, '', dailyRequiresVerify]
            }),
        }];
    };

    const buildQuickSponsorCall = () => {
        const decimals = selectedToken?.decimals || 18;
        const totalPool = parseUnits((Number(quickSponsorRewardPerUser) * Number(quickSponsorTotalClaims)).toString(), decimals);
        const isNative = selectedTokenAddr === '0x0000000000000000000000000000000000000000';

        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI as unknown,
                functionName: 'buySponsorshipWithToken',
                args: [0n, [quickSponsorTitle], [quickSponsorLink], quickSponsorEmail, isNative ? 0n : totalPool, selectedTokenAddr]
            }),
            value: isNative ? totalPool : 0n
        }];
    };

    // --- BATCH MODE LOGIC ---
    const handleBatchSave = async () => {
        const validTasks = tasksBatch.filter(t => t.title.trim() !== '');
        if (validTasks.length === 0) return toast.error("Enter Task Names");

        const tid = toast.loading("Deploying batch...");
        try {
            await writeContractAsync({
                address: DAILY_APP_ADDRESS as `0x${string}`,
                abi: DAILY_APP_ABI,
                functionName: 'addTaskBatch',
                args: [
                    validTasks.map(t => BigInt(t.baseReward)),
                    validTasks.map(t => BigInt(t.cooldown)),
                    validTasks.map(t => t.minTier),
                    validTasks.map(t => t.title),
                    validTasks.map(t => t.link || 'https://warpcast.com/CryptoDisco'),
                    validTasks.map(t => t.requiresVerification)
                ],
            });
            toast.success("Batch transaction submitted!", { id: tid });
        } catch (e: unknown) {
            toast.error(e instanceof Error ? (e as unknown).shortMessage || e.message : "Batch deployment failed", { id: tid });
        }
    };

    const handleCreateBatchSponsorship = async () => {
        if (!batchSponsorTitle || !batchSponsorLink) return toast.error("Missing fields");
        const tid = toast.loading("Processing Batch Sponsorship...");
        try {
            const decimals = selectedToken?.decimals || 18;
            const totalPool = parseUnits((parseFloat(batchRewardPerUserUSD) * Number(batchTargetClaims)).toString(), decimals);
            const isNative = selectedTokenAddr === '0x0000000000000000000000000000000000000000';

            await writeContractAsync({
                address: DAILY_APP_ADDRESS as `0x${string}`,
                abi: DAILY_APP_ABI,
                functionName: 'buySponsorshipWithToken',
                args: [0n, [batchSponsorTitle], [batchSponsorLink], batchSponsorEmail, isNative ? 0n : totalPool, selectedTokenAddr],
                value: isNative ? totalPool : 0n
            });
            toast.success("Sponsorship transaction submitted!", { id: tid });
        } catch (e: unknown) {
            toast.error(e instanceof Error ? (e as unknown).shortMessage || "Deployment failed" : "Deployment failed", { id: tid });
        }
    };

    const updateTaskLine = <K extends keyof TaskBatchItem>(idx: number, field: K, value: TaskBatchItem[K]) => {
        const newBatch = [...tasksBatch];
        newBatch[idx] = { ...newBatch[idx], [field]: value };
        if (field === 'platform' || field === 'action') {
            const platform = field === 'platform' ? (value as string) : newBatch[idx].platform;
            const action = field === 'action' ? (value as string) : newBatch[idx].action;
            newBatch[idx].title = `${action} our post on ${platform}`;
            if (!isLoadingPoints) newBatch[idx].baseReward = getGlobalPoints(platform, action);
        }
        setTasksBatch(newBatch);
    };

    // --- TRANSACTION SYNC EFFECT ---
    useEffect(() => {
        const syncToEcosystem = async () => {
            if (isTxSuccess && receipt && !syncedHashes.current.has(receipt.transactionHash)) {
                syncedHashes.current.add(receipt.transactionHash);
                const tid = toast.loading("Syncing Ecosystem Security...");
                try {
                    const timestamp = new Date().toISOString();
                    const message = `Admin Protocol Sync\nTX: ${receipt.transactionHash}\nAdmin: ${address}\nTime: ${timestamp}`;
                    const signature = await signMessageAsync({ message });

                    // Handle different sync requirements based on mode/tab
                    const payload: Record<string, unknown> = { action: 'admin-sync', tx_hash: receipt.transactionHash, wallet_address: address, signature, message };

                    if (controlMode === 'quick') {
                        if (subTab === 'daily') {
                            payload.tasks = [{ title: dailyDesc, is_base_social_required: dailyIsBaseSocialRequired }];
                        } else if (subTab === 'sponsor') {
                            payload.tasks = [{ title: quickSponsorTitle, is_base_social_required: quickSponsorIsBaseSocialRequired }];
                        }
                    } else {
                        if (subTab === 'BATCH_CREATOR') {
                            payload.tasks = tasksBatch.filter(t => t.title.trim() !== '').map(t => ({ ...t, action_type: t.action.toLowerCase() }));
                        }
                    }

                    await fetch('/api/admin/tasks/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    // Log to User Activity History [v3.63.7]
                    await fetch('/api/user-bundle?action=log-activity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wallet_address: address,
                            signature,
                            message,
                            category: subTab === 'sponsor' || subTab === 'SPONSOR_PORTAL' ? 'Sponsorship' : 'Task',
                            type: subTab === 'sponsor' || subTab === 'SPONSOR_PORTAL' ? 'Sponsor Hub' : 'Task Forge',
                            description: subTab === 'sponsor' || subTab === 'SPONSOR_PORTAL'
                                ? `Created Sponsorship: ${quickSponsorTitle || batchSponsorTitle}`
                                : `Created Task Batch: ${tasksBatch.filter(t => t.title.trim() !== '').length} tasks`,
                            amount: subTab === 'sponsor' || subTab === 'SPONSOR_PORTAL'
                                ? parseFloat(quickSponsorRewardPerUser || batchRewardPerUserUSD) * parseFloat(quickSponsorTotalClaims || batchTargetClaims)
                                : 0,
                            symbol: selectedToken?.symbol || 'ETH',
                            txHash: receipt.transactionHash
                        })
                    });

                    toast.success("Ecosystem Hardened & Synced", { id: tid });
                    refetchTasks();
                    refetchSponsors();
                } catch (e) { toast.error("Sync partial failure", { id: tid }); }
            }
        };
        syncToEcosystem();
    }, [isTxSuccess, receipt]);

    return (
        <div className="space-y-8">
            <EconomyMetrics />

            {/* Mode Toggle */}
            <div className="flex justify-center">
                <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setControlMode('quick')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${controlMode === 'quick' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Quick Forge
                    </button>
                    <button
                        onClick={() => setControlMode('batch')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${controlMode === 'batch' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Smart Batch
                    </button>
                </div>
            </div>

            {/* Sub-Tabs */}
            <div className="flex gap-2 p-1 bg-[#121214] border border-white/5 rounded-xl">
                {(controlMode === 'quick' ? ['daily', 'sponsor', 'config', 'analytics'] : ['BATCH_CREATOR', 'SPONSOR_PORTAL', 'ADMIN_CONFIG', 'VIEW_TASKS']).map(t => (
                    <button
                        key={t}
                        onClick={() => setSubTab(t)}
                        className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${subTab === t ? 'bg-[#0a0a0c] text-indigo-400 border border-white/5' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                        {t.replace('_', ' ').replace('daily', 'Single Task').replace('sponsor', 'Sponsor').replace('analytics', 'Analytics')}
                    </button>
                ))}
            </div>

            {/* Dynamic Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {controlMode === 'quick' ? (
                    <>
                        {subTab === 'daily' && (
                            <QuickTaskForgeSection
                                dailyDesc={dailyDesc} onDailyDescChange={setDailyDesc}
                                dailyPoints={dailyPoints} onDailyPointsChange={(v: string | number) => setDailyPoints(String(v))}
                                dailyCooldown={dailyCooldown} onDailyCooldownChange={setDailyCooldown}
                                dailyRequiresVerify={dailyRequiresVerify} onDailyRequiresVerifyChange={setDailyRequiresVerify}
                                dailyIsBaseSocialRequired={dailyIsBaseSocialRequired} onDailyIsBaseSocialRequiredChange={setDailyIsBaseSocialRequired}
                                dailyMinTier={dailyMinTier} onDailyMinTierChange={setDailyMinTier}
                                pointSettings={pointSettings}
                                buildAdminTaskCall={buildQuickTaskCall}
                                handleTxSuccess={handleTxSuccess}
                            />
                        )}
                        {subTab === 'sponsor' && (
                            <QuickSponsorPortalSection
                                sponsorTitle={quickSponsorTitle} onSponsorTitleChange={setQuickSponsorTitle}
                                sponsorLink={quickSponsorLink} onSponsorLinkChange={setQuickSponsorLink}
                                sponsorEmail={quickSponsorEmail} onSponsorEmailChange={setQuickSponsorEmail}
                                sponsorTotalClaims={quickSponsorTotalClaims} onSponsorTotalClaimsChange={setQuickSponsorTotalClaims}
                                sponsorRewardPerUser={quickSponsorRewardPerUser} onSponsorRewardPerUserChange={setQuickSponsorRewardPerUser}
                                sponsorIsBaseSocialRequired={quickSponsorIsBaseSocialRequired} onSponsorIsBaseSocialRequiredChange={setQuickSponsorIsBaseSocialRequired}
                                whitelistedTokens={whitelistedTokens}
                                selectedTokenAddr={selectedTokenAddr}
                                onTokenChange={setSelectedTokenAddr}
                                platformFee={platformFee}
                                minRewardUSD={minRewardUSD}
                                minPoolUSD={minPoolUSD}
                                totalPoolUSD={Number(quickSponsorRewardPerUser) * Number(quickSponsorTotalClaims)}
                                requiredTokens={parseUnits((Number(quickSponsorRewardPerUser) * Number(quickSponsorTotalClaims)).toString(), selectedToken?.decimals || 18)}
                                buildSponsorCall={buildQuickSponsorCall}
                                handleTxSuccess={handleTxSuccess}
                            />
                        )}
                        {/* Add config and analytics here for quick mode if needed, or share with batch */}
                    </>
                ) : (
                    <>
                        {subTab === 'BATCH_CREATOR' && (
                            <TaskBatchCreatorSection
                                tasksBatch={tasksBatch}
                                onUpdateTask={updateTaskLine as unknown}
                                onDeploy={handleBatchSave}
                                isSaving={isWaiting}
                            />
                        )}
                        {subTab === 'SPONSOR_PORTAL' && (
                            <SponsorshipPortalSection
                                sponsorTitle={batchSponsorTitle} onSponsorTitleChange={setBatchSponsorTitle}
                                sponsorLink={batchSponsorLink} onSponsorLinkChange={setBatchSponsorLink}
                                sponsorEmail={batchSponsorEmail} onSponsorEmailChange={setBatchSponsorEmail}
                                rewardPerUserUSD={batchRewardPerUserUSD} onRewardPerUserUSDChange={setBatchRewardPerUserUSD}
                                targetClaims={batchTargetClaims} onTargetClaimsChange={setBatchTargetClaims}
                                isBaseSocialRequired={batchIsBaseSocialRequired} onIsBaseSocialRequiredChange={setBatchIsBaseSocialRequired}
                                currentTokenPrice={tokenPrice}
                                currentPlatformFee={platformFee}
                                whitelistedTokens={whitelistedTokens}
                                selectedTokenAddr={selectedTokenAddr}
                                onTokenChange={setSelectedTokenAddr}
                                onCreateSponsorship={handleCreateBatchSponsorship}
                                isSponsorSaving={isWaiting}
                            />
                        )}
                        {subTab === 'ADMIN_CONFIG' && (
                            <EconomyConfigSection
                                newPlatformFee={configPlatformFee} onNewPlatformFeeChange={setConfigPlatformFee}
                                newMinPoolUSD={configMinPool} onNewMinPoolUSDChange={setConfigMinPool}
                                newMinRewardUSD={configMinReward} onNewMinRewardUSDChange={setConfigMinReward}
                                newTokenPriceUSD={''} onNewTokenPriceUSDChange={() => {}}
                                currentPlatformFee={platformFee}
                                currentTokenPrice={tokenPrice}
                                pendingPrice={undefined}
                                onUpdateEconomy={async () => {}}
                                onSchedulePrice={async () => {}}
                                onExecutePrice={async () => {}}
                            />
                        )}
                        {subTab === 'VIEW_TASKS' && (
                            <ActiveCampaignsSection
                                nextSponsorId={nextSponsorId}
                                nextTaskId={nextTaskId}
                                onToggleTaskStatus={async () => {}}
                                onApproveSponsor={async () => { toast.error('On-chain sponsorship moderation is unavailable on the deployed DailyApp contract.'); }}
                                onRejectSponsor={async () => { toast.error('On-chain sponsorship moderation is unavailable on the deployed DailyApp contract.'); }}
                                isSponsorModerationEnabled={false}
                                onRefetchSponsors={refetchSponsors}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Error/Loading Overlay */}
            {(writeError || isWaiting) && (
                <div className="fixed bottom-10 right-10 z-[200] p-6 bg-[#080808] border border-white/5 rounded-2xl shadow-2xl animate-in slide-in-from-right-4">
                    <div className="flex items-center gap-4">
                        {isWaiting ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                        <div>
                            <p className="text-[11px] font-black text-white uppercase tracking-widest">{isWaiting ? "Protocol Engagement Active" : "Authorization Error"}</p>
                            <p className="text-[9px] text-slate-500 mt-0.5">{isWaiting ? "Awaiting block confirmation..." : (writeError as unknown)?.shortMessage || writeError?.message}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
