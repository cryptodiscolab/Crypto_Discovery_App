import React, { useState, useEffect, useRef } from 'react';
import { Plus, Clock, RefreshCw, Send, List, Share2 } from 'lucide-react';
import { useWriteContract, useReadContract, useAccount, useWaitForTransactionReceipt, useSignMessage } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../../lib/contracts';
import { supabase } from '../../lib/supabaseClient';
import { useDailyAppAdmin } from '../../hooks/useContract';
import { EconomyMetrics } from './EconomyMetrics';
import toast from 'react-hot-toast';

// Sub-sections
import { TaskBatchCreatorSection } from './tasks/TaskBatchCreatorSection';
import { SponsorshipPortalSection } from './tasks/SponsorshipPortalSection';
import { EconomyConfigSection } from './tasks/EconomyConfigSection';
import { ActiveCampaignsSection } from './tasks/ActiveCampaignsSection';

const DAILY_APP_ADDRESS = CONTRACTS.DAILY_APP;

export function TaskManagerTab() {
    const { address, chainId } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useWriteContract();
    const { approveSponsorship, rejectSponsorship } = useDailyAppAdmin();

    // UI States
    const [viewMode, setViewMode] = useState('BATCH_CREATOR');
    const [isSaving, setIsSaving] = useState(false);
    const [isSponsorSaving, setIsSponsorSaving] = useState(false);

    // Economy Config States
    const [newPlatformFee, setNewPlatformFee] = useState('');
    const [newMinPoolUSD, setNewMinPoolUSD] = useState('');
    const [newMinRewardUSD, setNewMinRewardUSD] = useState('');
    const [newTokenPriceUSD, setNewTokenPriceUSD] = useState('');

    // Sponsor Portal States
    const [sponsorTitle, setSponsorTitle] = useState('');
    const [sponsorLink, setSponsorLink] = useState('');
    const [sponsorEmail, setSponsorEmail] = useState('');
    const [rewardPerUserUSD, setRewardPerUserUSD] = useState('0.01');
    const [targetClaims, setTargetClaims] = useState('500');
    const [isBaseSocialRequired, setIsBaseSocialRequired] = useState(false); // v3.42.0

    // On-Chain Data
    const { data: currentPlatformFee } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: currentTokenPrice } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'tokenPriceUSD' });
    const { data: nextSponsorId, refetch: refetchSponsors } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'nextSponsorId' });
    const { data: pendingPrice, refetch: refetchPendingPrice } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'pendingPriceChange' });
    const { data: nextTaskId, refetch: refetchCount } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'nextTaskId' });

    // Tasks Batch State
    const [tasksBatch, setTasksBatch] = useState([
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', target_id: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, isBaseSocialRequired: false, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', target_id: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, isBaseSocialRequired: false, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', target_id: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, isBaseSocialRequired: false, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true }
    ]);
    const [pointSettings, setPointSettings] = useState([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);

    const [txHash, setTxHash] = useState(null);
    const { data: receipt, isSuccess: isTxSuccess, isError: isTxError, error: txError } = useWaitForTransactionReceipt({ hash: txHash });
    const syncedHashes = useRef(new Set());

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
        fetchPoints();
    }, []);

    const getGlobalPoints = (platform, action, currentSettings = pointSettings) => {
        if (!currentSettings || currentSettings.length === 0) return 0;
        const platMap = { 'Farcaster': 'farcaster', 'X': 'x', 'Base App': 'base', 'TikTok': 'tiktok', 'Instagram': 'instagram' };
        const actMap = { 'Follow': 'follow', 'Like': 'like', 'Recast/Repost': 'recast', 'Comment': 'comment', 'Quote': 'quote' };
        const platKey = platMap[platform] || platform.toLowerCase();
        let actKey = actMap[action] || action.toLowerCase();
        if (platKey === 'x' && actKey === 'recast') actKey = 'repost';

        const columnMatch = currentSettings.find(s => s.platform?.toLowerCase() === platKey && s.action_type?.toLowerCase() === actKey);
        if (columnMatch) return columnMatch.points_value;

        const searchKeys = [`task_${platKey}_${actKey}`, `${platKey}_${actKey}`, `${platKey}${actKey}`];
        const keyMatch = currentSettings.find(s => searchKeys.includes(s.activity_key?.toLowerCase()));
        return keyMatch ? keyMatch.points_value : 0;
    };

    const syncAuditAction = async (txHash, action, details) => {
        try {
            const timestamp = new Date().toISOString();
            const message = `Governance Audit Log\nTX: ${txHash}\nAdmin: ${address}\nAction: ${action}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });
            await fetch('/api/admin/tasks/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_address: address, signature, message, action: 'AUDIT_GOVERNANCE', tx_hash: txHash, governor_action: action, details })
            });
        } catch (err) { console.error('[Audit Sync Error]', err); }
    };

    useEffect(() => {
        const syncToSupabase = async () => {
            if (isTxSuccess && receipt && !syncedHashes.current.has(receipt.transactionHash)) {
                syncedHashes.current.add(receipt.transactionHash);
                const validTasks = tasksBatch.filter(t => t.title.trim() !== '');
                const tid = toast.loading("Transaction successful! Syncing DB...");
                try {
                    const timestamp = new Date().toISOString();
                    const message = `Sync Batch Tasks\nTX: ${receipt.transactionHash}\nAdmin: ${address}\nTime: ${timestamp}`;
                    const signature = await signMessageAsync({ message });

                    const tasksToSync = validTasks.map(task => ({
                        platform: task.platform.toLowerCase(),
                        action_type: task.action.toLowerCase(),
                        title: task.title,
                        link: task.link || 'https://warpcast.com/CryptoDisco',
                        target_id: task.target_id,
                        reward_points: task.baseReward,
                        min_tier: task.minTier,
                        requires_verification: task.requiresVerification,
                        is_base_social_required: task.isBaseSocialRequired, // v3.42.0
                        min_neynar_score: task.minNeynarScore,
                        min_followers: task.minFollowers,
                        account_age_requirement: task.accountAgeLimit,
                        power_badge_required: task.powerBadgeRequired,
                        no_spam_filter: task.noSpamFilter
                    }));

                    const response = await fetch('/api/admin/tasks/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            action: 'task-sync',
                            wallet_address: address, 
                            signature, 
                            message, 
                            tx_hash: receipt.transactionHash, 
                            tasks: tasksToSync 
                        })
                    });

                    if (!response.ok) throw new Error("Sync failed");
                    toast.success("Done! On-chain task & DB synchronized.", { id: tid });
                    setTasksBatch(prev => prev.map(t => ({ ...t, title: '' })));
                    refetchCount();
                    setTxHash(null);
                } catch (error) { toast.error(`Sync failed: ${error.message}`, { id: tid }); }
                finally { setIsSaving(false); }
            }
            if (isTxError) { toast.error(`Confirmation Failed: ${txError?.shortMessage || "Internal Error"}`); setIsSaving(false); setTxHash(null); }
        };
        syncToSupabase();
    }, [isTxSuccess, isTxError, receipt]);

    const handleBatchSave = async () => {
        const validTasks = tasksBatch.filter(t => t.title.trim() !== '');
        if (validTasks.length === 0) return toast.error("Enter Task Names");
        if (chainId !== 84532) return toast.error("Connect to Base Sepolia");

        setIsSaving(true);
        const tid = toast.loading("Deploying batch...");
        try {
            const hash = await writeContractAsync({
                address: DAILY_APP_ADDRESS,
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
            setTxHash(hash);
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); setIsSaving(false); }
    };

    const updateTaskLine = (index, field, value) => {
        const newBatch = [...tasksBatch];
        newBatch[index][field] = value;
        if (field === 'platform' || field === 'action') {
            const platform = field === 'platform' ? value : newBatch[index].platform;
            const action = field === 'action' ? value : newBatch[index].action;
            newBatch[index].title = `${action} our post on ${platform}`;
            if (!isLoadingPoints) newBatch[index].baseReward = getGlobalPoints(platform, action);
        }
        setTasksBatch(newBatch);
    };

    const handleUpdateEconomy = async () => {
        const tid = toast.loading("Updating economy...");
        try {
            const fee = newPlatformFee ? BigInt(parseFloat(newPlatformFee) * 1e6) : (currentPlatformFee || BigInt(1e6));
            const pool = newMinPoolUSD ? BigInt(parseFloat(newMinPoolUSD) * 1e18) : BigInt(5e18);
            const reward = newMinRewardUSD ? BigInt(parseFloat(newMinRewardUSD) * 1e18) : BigInt(0.01e18);
            await writeContractAsync({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'setSponsorshipParams', args: [fee, pool, reward] });
            toast.success("Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || "Failed", { id: tid }); }
    };

    const handleSchedulePrice = async () => {
        if (!newTokenPriceUSD) return toast.error("Enter price");
        const tid = toast.loading("Scheduling...");
        try {
            const price = BigInt(parseFloat(newTokenPriceUSD) * 1e18);
            const hash = await writeContractAsync({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'scheduleTokenPriceUpdate', args: [price] });
            if (hash) { toast.success("Scheduled (24h wait)", { id: tid }); syncAuditAction(hash, 'SCHEDULE_PRICE_CHANGE', { new_price: newTokenPriceUSD }); refetchPendingPrice(); }
        } catch (e) { toast.error(e.shortMessage, { id: tid }); }
    };

    const handleExecutePrice = async () => {
        const tid = toast.loading("Executing...");
        try {
            const hash = await writeContractAsync({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'executePriceChange' });
            if (hash) {
                const newPriceVal = Number(pendingPrice[0]) / 1e18;
                const message = `Sync Economy Price\nTX: ${hash}\nAdmin: ${address}\nPrice: ${newPriceVal}\nTime: ${new Date().toISOString()}`;
                const signature = await signMessageAsync({ message });
                await fetch('/api/admin/tasks/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallet_address: address, signature, message, action: 'SYNC_ECONOMY', token_price_usd: newPriceVal, tx_hash: hash })
                });
                toast.success("Synced!", { id: tid });
                refetchPendingPrice();
            }
        } catch (err) { toast.error(err.shortMessage, { id: tid }); }
    };

    const handleCreateSponsorship = async () => {
        if (!sponsorTitle || !sponsorLink) return toast.error("Missing fields");
        setIsSponsorSaving(true);
        const tid = toast.loading("Processing...");
        try {
            const hash = await writeContractAsync({
                address: DAILY_APP_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'buySponsorshipWithToken',
                args: [0, sponsorTitle, sponsorLink, sponsorEmail, BigInt(parseFloat(rewardPerUserUSD) * 1e18), BigInt(targetClaims)]
            });

            if (hash) {
                toast.loading("Syncing with database...", { id: tid });
                
                const timestamp = new Date().toISOString();
                const message = `Sync UGC Mission\nTX: ${hash}\nAdmin: ${address}\nTitle: ${sponsorTitle}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                await fetch('/api/user/bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet: address,
                        signature,
                        message,
                        action: 'sync-ugc-mission',
                        payload: {
                            title: sponsorTitle,
                            description: `Sponsored mission by ${sponsorEmail}`,
                            sponsor_address: address,
                            platform_code: 'base',
                            reward_amount_per_user: rewardPerUserUSD,
                            max_participants: targetClaims,
                            txHash: hash,
                            is_base_social_required: isBaseSocialRequired, // v3.42.0
                            tasks_batch: [{
                                title: sponsorTitle,
                                link: sponsorLink,
                                platform: 'base',
                                action_type: 'visit'
                            }]
                        }
                    })
                });
                
                toast.success("Deployed & Synchronized!", { id: tid });
                setViewMode('VIEW_TASKS');
            }
        } catch (e) { 
            console.error("Sponsorship error:", e);
            toast.error(e.shortMessage || "Failed to deploy", { id: tid }); 
        } finally { setIsSponsorSaving(false); }
    };

    const handleApprove = async (rid) => {
        try { const hash = await approveSponsorship(rid); if (hash) syncAuditAction(hash, 'SPONSOR_APPROVE', { request_id: rid }); }
        catch (e) { toast.error(e.shortMessage); }
    };

    const handleReject = async (rid) => {
        const reason = window.prompt("Reason?");
        if (!reason) return;
        try { const hash = await rejectSponsorship(rid, reason); if (hash) syncAuditAction(hash, 'SPONSOR_REJECT', { request_id: rid, reason }); }
        catch (e) { toast.error(e.shortMessage); }
    };

    const handleToggleTaskStatus = async (tid, current) => {
        const lid = toast.loading("Updating status...");
        try {
            await writeContractAsync({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'setTaskActive', args: [BigInt(tid), !current] });
            toast.success("Updated!", { id: lid });
            refetchCount();
        } catch (e) { toast.error(e.shortMessage, { id: lid }); }
    };

    return (
        <div className="space-y-8">
            <EconomyMetrics />
            <div className="flex flex-wrap gap-2 p-1 bg-slate-900/50 rounded-2xl border border-white/5 w-fit">
                {[
                    { id: 'BATCH_CREATOR', label: 'Daily Tasks', icon: <Plus className="w-4 h-4" /> },
                    { id: 'SPONSOR_PORTAL', label: 'Sponsor Portal', icon: <Share2 className="w-4 h-4" /> },
                    { id: 'ADMIN_CONFIG', label: 'Configuration', icon: <Clock className="w-4 h-4" /> },
                    { id: 'VIEW_TASKS', label: 'Active Campaigns', icon: <List className="w-4 h-4" /> },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {viewMode === 'BATCH_CREATOR' && <TaskBatchCreatorSection tasksBatch={tasksBatch} onUpdateTask={updateTaskLine} onDeploy={handleBatchSave} isSaving={isSaving} />}
            {viewMode === 'SPONSOR_PORTAL' && (
                <SponsorshipPortalSection
                    sponsorTitle={sponsorTitle} onSponsorTitleChange={setSponsorTitle}
                    sponsorLink={sponsorLink} onSponsorLinkChange={setSponsorLink}
                    sponsorEmail={sponsorEmail} onSponsorEmailChange={setSponsorEmail}
                    rewardPerUserUSD={rewardPerUserUSD} onRewardPerUserUSDChange={setRewardPerUserUSD}
                    targetClaims={targetClaims} onTargetClaimsChange={setTargetClaims}
                    isBaseSocialRequired={isBaseSocialRequired} onIsBaseSocialRequiredChange={setIsBaseSocialRequired}
                    currentTokenPrice={currentTokenPrice}
                    currentPlatformFee={currentPlatformFee}
                    onCreateSponsorship={handleCreateSponsorship}
                    isSponsorSaving={isSponsorSaving}
                />
            )}
            {viewMode === 'ADMIN_CONFIG' && (
                <EconomyConfigSection
                    newPlatformFee={newPlatformFee} onNewPlatformFeeChange={setNewPlatformFee}
                    newMinPoolUSD={newMinPoolUSD} onNewMinPoolUSDChange={setNewMinPoolUSD}
                    newMinRewardUSD={newMinRewardUSD} onNewMinRewardUSDChange={setNewMinRewardUSD}
                    newTokenPriceUSD={newTokenPriceUSD} onNewTokenPriceUSDChange={setNewTokenPriceUSD}
                    currentPlatformFee={currentPlatformFee}
                    currentTokenPrice={currentTokenPrice}
                    pendingPrice={pendingPrice}
                    onUpdateEconomy={handleUpdateEconomy}
                    onSchedulePrice={handleSchedulePrice}
                    onExecutePrice={handleExecutePrice}
                />
            )}
            {viewMode === 'VIEW_TASKS' && (
                <ActiveCampaignsSection
                    nextSponsorId={nextSponsorId}
                    nextTaskId={nextTaskId}
                    onToggleTaskStatus={handleToggleTaskStatus}
                    onApproveSponsor={handleApprove}
                    onRejectSponsor={handleReject}
                    onRefetchSponsors={refetchSponsors}
                />
            )}
        </div>
    );
}
