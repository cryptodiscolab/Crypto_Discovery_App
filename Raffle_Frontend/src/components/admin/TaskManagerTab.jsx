import React, { useState, useEffect } from 'react';
import { Plus, Zap, Clock, Shield, Award, ExternalLink, RefreshCw, Send, List, Share2, Twitter, MessageCircle, Heart, Repeat } from 'lucide-react';
import { useWriteContract, useReadContract, useAccount, useWaitForTransactionReceipt, useSignMessage } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../../lib/contracts';
import { supabase } from '../../lib/supabaseClient';
import { useDailyAppAdmin } from '../../hooks/useContract';
import { EconomyMetrics } from './EconomyMetrics';
import toast from 'react-hot-toast';

const V12_ADDRESS = CONTRACTS.DAILY_APP;
const DAILY_APP_ADDRESS = V12_ADDRESS;

const PLATFORMS = {
    'Farcaster': { id: 'farcaster', domain: 'https://warpcast.com/...', icon: <Share2 className="w-4 h-4" /> },
    'X': { id: 'x', domain: 'https://x.com/...', icon: <Twitter className="w-4 h-4" /> },
    'Base App': { id: 'base', domain: 'https://base.app/...', icon: <img src="/base-logo.png" className="w-4 h-4 grayscale opacity-50" alt="Base" /> }
};

const ACTIONS = {
    'Follow': { id: 'follow', label: 'Follow', icon: <Plus className="w-3 h-3" /> },
    'Like': { id: 'like', label: 'Like', icon: <Heart className="w-3 h-3" /> },
    'Recast/Repost': { id: 'recast', label: 'Recast/Repost', icon: <Repeat className="w-3 h-3" /> },
    'Quote': { id: 'quote', label: 'Quote', icon: <Repeat className="w-3 h-3 rotate-90" /> },
    'Comment': { id: 'comment', label: 'Comment', icon: <MessageCircle className="w-3 h-3" /> },
    'Transaction': { id: 'transaction', label: 'Transaction', icon: <Zap className="w-3 h-3" /> }
};

export function TaskManagerTab() {
    const { address, chainId } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useWriteContract();
    // --- GOVERNANCE: REGULAR TASK MANAGEMENT ---
    const handleToggleTaskStatus = async (tid, currentStatus) => {
        const loadingId = toast.loading(`${currentStatus ? 'Deactivating' : 'Activating'} task...`);
        try {
            await writeContractAsync({
                address: V12_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'setTaskActive',
                args: [BigInt(tid), !currentStatus],
            });
            toast.success("Task status updated on-chain!", { id: loadingId });
            refetchCount();
        } catch (err) {
            toast.error(err.shortMessage || "Action failed", { id: loadingId });
        }
    };

    // UI Mode Switcher
    const [viewMode, setViewMode] = useState('BATCH_CREATOR'); // BATCH_CREATOR, SPONSOR_PORTAL, ADMIN_CONFIG, VIEW_TASKS
    const [auditSubMode, setAuditSubMode] = useState('SPONSORS'); // SPONSORS, ORGANIC

    // Admin Config State
    const [newPlatformFee, setNewPlatformFee] = useState('');
    const [newMinPoolUSD, setNewMinPoolUSD] = useState('');
    const [newMinRewardUSD, setNewMinRewardUSD] = useState('');
    const [newTokenPriceUSD, setNewTokenPriceUSD] = useState('');

    // On-Chain Economy Data
    const { data: currentPlatformFee } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'sponsorshipPlatformFee',
    });
    const { data: currentTokenPrice } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'tokenPriceUSD',
    });

    // Sponsorship State (Sponsor Portal)
    const [sponsorTitle, setSponsorTitle] = useState('');
    const [sponsorLink, setSponsorLink] = useState('');
    const [sponsorEmail, setSponsorEmail] = useState('');
    const [rewardPerUserUSD, setRewardPerUserUSD] = useState('0.01');
    const [targetClaims, setTargetClaims] = useState('500');
    const [isSponsorSaving, setIsSponsorSaving] = useState(false);

    // Admin Governance Logic (Audit Hub)
    const { approveSponsorship, rejectSponsorship } = useDailyAppAdmin();
    const [pendingRequests, setPendingRequests] = useState([]);
    const [isCheckingRequests, setIsCheckingRequests] = useState(false);

    const { data: nextSponsorId, refetch: refetchSponsors } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'nextSponsorId',
    });

    const { data: pendingPrice, refetch: refetchPendingPrice } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'pendingPriceChange',
    });

    // Helper: Secure Multi-Step Sync (On-Chain -> Audit Log)
    const syncAuditAction = async (txHash, action, details) => {
        try {
            const timestamp = new Date().toISOString();
            const message = `Governance Audit Log\nTX: ${txHash}\nAdmin: ${address}\nAction: ${action}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            await fetch('/api/admin/tasks/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action: 'AUDIT_GOVERNANCE',
                    tx_hash: txHash,
                    governor_action: action,
                    details
                })
            });
        } catch (err) {
            console.error('[Audit Sync Error]', err);
        }
    };

    // Initial state for 3 tasks with advanced filters
    const [tasksBatch, setTasksBatch] = useState([
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 0, minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true }
    ]);

    const [pointSettings, setPointSettings] = useState([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);

    const { data: nextTaskId, refetch: refetchCount } = useReadContract({
        address: V12_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'nextTaskId',
    });

    // 1. Fetch Global Point Settings (The Source of Truth)
    useEffect(() => {
        const fetchPoints = async () => {
            try {
                const { data, error } = await supabase
                    .from('point_settings')
                    .select('*')
                    .eq('is_active', true);

                if (error) throw error;
                if (data) {
                    setPointSettings(data);

                    // Sync initial points for the 3 default tasks
                    setTasksBatch(prev => prev.map(task => ({
                        ...task,
                        baseReward: getGlobalPoints(task.platform, task.action, data)
                    })));
                }
            } catch (err) {
                console.error('[FetchPoints Error]', err);
                toast.error("Failed to fetch points data!");
            } finally {
                setIsLoadingPoints(false);
            }
        };
        fetchPoints();
    }, []);

    // 2. Map Dynamic Points to Local Form (Safe Lookup)
    const getGlobalPoints = (platform, action, currentSettings = pointSettings) => {
        if (!currentSettings || currentSettings.length === 0) return 0;

        const platMap = { 'Farcaster': 'farcaster', 'X': 'x', 'Base App': 'base' };
        const actMap = {
            'Follow': 'follow',
            'Like': 'like',
            'Recast/Repost': 'recast',
            'Comment': 'comment',
            'Quote': 'quote'
        };

        const platKey = platMap[platform] || platform.toLowerCase();
        let actKey = actMap[action] || action.toLowerCase();

        // Platform specific overrides (X uses 'repost', Others use 'recast')
        if (platKey === 'x' && actKey === 'recast') actKey = 'repost';

        // High Priority: Match by Database Columns (platform & action_type)
        const columnMatch = currentSettings.find(s =>
            s.platform?.toLowerCase() === platKey &&
            s.action_type?.toLowerCase() === actKey
        );
        if (columnMatch) return columnMatch.points_value;

        // Level 2: Match by Activity Key (With or Without "task_" prefix)
        const searchKeys = [`task_${platKey}_${actKey}`, `${platKey}_${actKey}`, `${platKey}${actKey}`];
        const keyMatch = currentSettings.find(s => searchKeys.includes(s.activity_key?.toLowerCase()));

        return keyMatch ? keyMatch.points_value : 0;
    };

    const [txHash, setTxHash] = useState(null);
    const { data: receipt, isSuccess: isTxSuccess, isError: isTxError, error: txError } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // To prevent double-sync from useEffect re-runs
    const syncedHashes = React.useRef(new Set());

    // 3. SECURE Supabase Sync Effect
    useEffect(() => {
        const syncToSupabase = async () => {
            if (isTxSuccess && receipt && !syncedHashes.current.has(receipt.transactionHash)) {
                syncedHashes.current.add(receipt.transactionHash);

                const validTasks = tasksBatch.filter(t => t.title.trim() !== '');
                const tid = toast.loading("Transaction successful! Requesting admin signature for DB sync...");

                try {
                    // 1. Prepare Message & Signature
                    const timestamp = new Date().toISOString();
                    const message = `Sync Batch Tasks\nTX: ${receipt.transactionHash}\nAdmin: ${address}\nTime: ${timestamp}`;
                    const signature = await signMessageAsync({ message });

                    toast.loading("Updating database via Secure API...", { id: tid });

                    // 2. Prepare Data for API
                    const tasksToSync = validTasks.map(task => ({
                        platform: PLATFORMS[task.platform]?.id || task.platform.toLowerCase(),
                        action_type: ACTIONS[task.action]?.id || task.action.toLowerCase(),
                        title: task.title,
                        link: task.link || 'https://warpcast.com/CryptoDisco',
                        reward_points: task.baseReward,
                        min_tier: task.minTier,
                        requires_verification: task.requiresVerification,
                        min_neynar_score: task.minNeynarScore,
                        min_followers: task.minFollowers,
                        account_age_requirement: task.accountAgeLimit,
                        power_badge_required: task.powerBadgeRequired,
                        no_spam_filter: task.noSpamFilter
                    }));

                    // 3. Call Secure API
                    const response = await fetch('/api/admin/tasks/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wallet_address: address,
                            signature,
                            message,
                            tx_hash: receipt.transactionHash,
                            tasks: tasksToSync
                        })
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || "Sync failed");
                    }

                    toast.success("Done! On-chain task & DB synchronized.", { id: tid });

                    // Reset
                    setTasksBatch([
                        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: getGlobalPoints('Farcaster', 'Follow'), minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
                        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: getGlobalPoints('Farcaster', 'Follow'), minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
                        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: getGlobalPoints('Farcaster', 'Follow'), minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true }
                    ]);
                    refetchCount();
                    setTxHash(null);

                } catch (error) {
                    console.error('Sync Error:', error);
                    const errMsg = error.message || "Unknown error";
                    if (error.code === 4001) {
                        toast.error("Signature rejected. DB data not synchronized!", { id: tid });
                    } else {
                        toast.error(`Sync failed: ${errMsg}`, { id: tid });
                    }
                } finally {
                    setIsSaving(false);
                }
            }

            // Handle Failure (Unlocking UI)
            if (isTxError) {
                console.error('Wait Error:', txError);
                toast.error(`Blockchain Confirmation Failed: ${txError?.shortMessage || txError?.message || "Internal Error"}`);
                setIsSaving(false);
                setTxHash(null);
            }
        };

        syncToSupabase();
    }, [isTxSuccess, isTxError, receipt, txError]);

    const handleBatchSave = async () => {
        const validTasks = tasksBatch.filter(t => t.title.trim() !== '');

        if (validTasks.length === 0) {
            toast.error("Enter at least one Task Name!");
            return;
        }

        const EXPECTED_CHAIN_ID = 84532;
        if (chainId !== EXPECTED_CHAIN_ID) {
            toast.error(`Wrong Network! Please switch to Base Sepolia (Connected: ${chainId || 'Unknown'})`);
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Preparing batch transaction...");

        try {
            const baseRewards = validTasks.map(t => BigInt(t.baseReward));
            const cooldowns = validTasks.map(t => BigInt(t.cooldown));
            const minTiers = validTasks.map(t => t.minTier); // enum unit8
            const titles = validTasks.map(t => t.title);
            const links = validTasks.map(t => t.link || 'https://warpcast.com/CryptoDisco');
            const requiresVerifications = validTasks.map(t => t.requiresVerification);

            const hash = await writeContractAsync({
                address: V12_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'addTaskBatch',
                args: [
                    baseRewards,
                    cooldowns,
                    minTiers,
                    titles,
                    links,
                    requiresVerifications
                ],
            });

            if (!hash) throw new Error("Failed to get transaction hash!");

            setTxHash(hash);
            toast.loading("Sending Batch to Base Network...", { id: tid });

        } catch (e) {
            console.error("Batch Deployment Error:", e);
            toast.error(e.shortMessage || e.message || "Failed to register batch tasks", { id: tid });
            setIsSaving(false);
        }
    };


    const updateTaskLine = (index, field, value) => {
        const newBatch = [...tasksBatch];
        newBatch[index][field] = value;

        // Auto-fill title and LOCKED points logic
        if (field === 'platform' || field === 'action') {
            const platform = field === 'platform' ? value : newBatch[index].platform;
            const action = field === 'action' ? value : newBatch[index].action;
            newBatch[index].title = `${action} our post on ${platform}`;

            // Lock points from global settings
            if (!isLoadingPoints) {
                newBatch[index].baseReward = getGlobalPoints(platform, action);
            }
        }

        setTasksBatch(newBatch);
    };

    // --- SPONSORSHIP HANDLERS ---
    const handleAddSponsorTask = () => {
        if (sponsorTasks.length < 5) {
            setSponsorTasks([...sponsorTasks, { desc: '', points: 100 }]);
        } else {
            toast.error("Max 5 tasks per sponsorship");
        }
    };

    const handleRemoveSponsorTask = (index) => {
        setSponsorTasks(sponsorTasks.filter((_, i) => i !== index));
    };

    const handleSponsorTaskChange = (index, field, value) => {
        const newTasks = [...sponsorTasks];
        newTasks[index][field] = value;
        setSponsorTasks(newTasks);
    };

    const handleUpdateEconomy = async () => {
        if (!newPlatformFee && !newMinPoolUSD && !newMinRewardUSD) return toast.error("Enter at least one value");
        const tid = toast.loading("Updating on-chain economy...");
        try {
            const fee = newPlatformFee ? BigInt(parseFloat(newPlatformFee) * 1e6) : (currentPlatformFee || BigInt(1e6));
            const pool = newMinPoolUSD ? BigInt(parseFloat(newMinPoolUSD) * 1e18) : BigInt(5e18);
            const reward = newMinRewardUSD ? BigInt(parseFloat(newMinRewardUSD) * 1e18) : BigInt(0.01e18);

            const hash = await writeContractAsync({
                address: V12_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'setSponsorshipParams',
                args: [fee, pool, reward]
            });
            if (hash) toast.success("Economy updated!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || "Update failed", { id: tid });
        }
    };

    const handleSchedulePrice = async () => {
        if (!newTokenPriceUSD) return toast.error("Enter new price");
        const tid = toast.loading("Scheduling price update...");
        try {
            const price = BigInt(parseFloat(newTokenPriceUSD) * 1e18);
            const hash = await writeContractAsync({
                address: V12_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'scheduleTokenPriceUpdate',
                args: [price]
            });
            if (hash) {
                toast.success("Price update scheduled! Wait 24h to execute.", { id: tid });
                await syncAuditAction(hash, 'SCHEDULE_PRICE_CHANGE', { new_price: newTokenPriceUSD });
                refetchPendingPrice();
            }
        } catch (e) {
            toast.error(e.shortMessage || "Scheduling failed", { id: tid });
        }
    };

    const handleExecutePrice = async () => {
        if (!pendingPrice?.[2]) return toast.error("No pending price change");
        const tid = toast.loading("Executing & Syncing price...");
        try {
            const hash = await writeContractAsync({
                address: V12_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'executePriceChange'
            });

            if (hash) {
                const newPriceVal = Number(pendingPrice[0]) / 1e18;
                toast.loading("Tx confirmed! Synchronizing Database...", { id: tid });

                const timestamp = new Date().toISOString();
                const message = `Sync Economy Price\nTX: ${hash}\nAdmin: ${address}\nPrice: ${newPriceVal}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                const res = await fetch('/api/admin/tasks/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: address,
                        signature,
                        message,
                        action: 'SYNC_ECONOMY',
                        token_price_usd: newPriceVal,
                        tx_hash: hash
                    })
                });

                if (res.ok) {
                    toast.success("Success! Contract & Database synchronized.", { id: tid });
                } else {
                    toast.error("Chain updated but DB sync failed. Please sync manually.", { id: tid });
                }
                refetchPendingPrice();
            }
        } catch (err) {
            toast.error(err.shortMessage || "Execution failed", { id: tid });
        }
    };

    const handleCreateSponsorship = async () => {
        if (!sponsorTitle || !sponsorLink || !sponsorEmail) return toast.error("Missing required fields");
        setIsSponsorSaving(true);
        const tid = toast.loading("Processing sponsorship tokens...");

        try {
            const rewardUSD = BigInt(parseFloat(rewardPerUserUSD) * 1e18);
            const claims = BigInt(targetClaims);

            const hash = await writeContractAsync({
                address: DAILY_APP_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'buySponsorshipWithToken',
                args: [
                    0, // BRONZE LEVEL
                    sponsorTitle,
                    sponsorLink,
                    sponsorEmail,
                    rewardUSD,
                    claims
                ]
            });

            if (hash) {
                toast.success("Sponsorship module deployed!", { id: tid });
                setViewMode('VIEW_TASKS');
            }
        } catch (error) {
            console.error(error);
            toast.error(error.shortMessage || "Deployment failed", { id: tid });
        } finally {
            setIsSponsorSaving(false);
        }
    };

    const handleApprove = async (rid) => {
        const tid = toast.loading("Approving on-chain...");
        try {
            const hash = await approveSponsorship(rid);
            if (hash) {
                toast.success("Sponsorship Approved!", { id: tid });
                await syncAuditAction(hash, 'SPONSOR_APPROVE', { request_id: rid.toString() });
            }
        } catch (e) {
            toast.error(e.shortMessage || "Approval failed", { id: tid });
        }
    };

    const handleReject = async (rid) => {
        const reason = window.prompt("Enter rejection reason:");
        if (!reason) return;
        const tid = toast.loading("Rejecting on-chain...");
        try {
            const hash = await rejectSponsorship(rid, reason);
            if (hash) {
                toast.success("Sponsorship Rejected & Refunded", { id: tid });
                await syncAuditAction(hash, 'SPONSOR_REJECT', { request_id: rid.toString(), reason });
            }
        } catch (e) {
            toast.error(e.shortMessage || "Rejection failed", { id: tid });
        }
    };

    return (
        <div className="space-y-8">
            {/* Economy & Profitability Command Center */}
            <EconomyMetrics />

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 p-1 bg-slate-900/50 rounded-2xl border border-white/5 w-fit">
                {[
                    { id: 'BATCH_CREATOR', label: 'Daily Tasks', icon: <Plus className="w-4 h-4" /> },
                    { id: 'SPONSOR_PORTAL', label: 'Sponsor Portal', icon: <Share2 className="w-4 h-4" /> },
                    { id: 'ADMIN_CONFIG', label: 'Configuration', icon: <Clock className="w-4 h-4" /> },
                    { id: 'VIEW_TASKS', label: 'Active Campaigns', icon: <List className="w-4 h-4" /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setViewMode(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 1. Daily Task Batch Creator */}
            {viewMode === 'BATCH_CREATOR' && (
                <div className="glass-card p-8 bg-purple-950/10 border border-purple-500/10 shadow-2xl relative">
                    <div className="mb-6">
                        <h3 className="text-2xl font-black text-white flex items-center gap-2">
                            <Plus className="w-6 h-6 text-purple-500" /> TASK GENERATOR
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold font-mono">Build internal organic tasks</p>
                    </div>

                    <div className="space-y-6 mb-10">
                        {tasksBatch.map((task, idx) => (
                            <div key={idx} className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 relative group transition-all hover:bg-slate-900/60 hover:border-purple-500/20">
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-black text-slate-500 group-hover:text-purple-400 group-hover:border-purple-500/50 transition-all z-10 shadow-lg">
                                    {idx + 1}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                    <div className="lg:col-span-3 space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Platform</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                    {PLATFORMS[task.platform]?.icon}
                                                </div>
                                                <select
                                                    value={task.platform}
                                                    onChange={(e) => updateTaskLine(idx, 'platform', e.target.value)}
                                                    className="w-full bg-slate-950/50 border border-white/5 p-2 pl-9 rounded-xl text-white text-xs font-bold focus:border-purple-500/50 outline-none appearance-none cursor-pointer"
                                                >
                                                    {Object.keys(PLATFORMS).map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Action</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                    {ACTIONS[task.action]?.icon}
                                                </div>
                                                <select
                                                    value={task.action}
                                                    onChange={(e) => updateTaskLine(idx, 'action', e.target.value)}
                                                    className="w-full bg-slate-950/50 border border-white/5 p-2 pl-9 rounded-xl text-white text-xs font-bold focus:border-purple-500/50 outline-none appearance-none cursor-pointer"
                                                >
                                                    {Object.keys(ACTIONS).map(a => <option key={a} value={a}>{a}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-5 space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Task Name</label>
                                            <input
                                                value={task.title}
                                                onChange={(e) => updateTaskLine(idx, 'title', e.target.value)}
                                                placeholder="Auto-filled based on action..."
                                                className="w-full bg-slate-950/50 border border-white/5 p-3 rounded-xl text-white font-bold placeholder:text-slate-700 focus:border-purple-500/50 outline-none transition-all text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Target Link</label>
                                            <input
                                                value={task.link}
                                                onChange={(e) => updateTaskLine(idx, 'link', e.target.value)}
                                                placeholder={PLATFORMS[task.platform]?.domain || "https://..."}
                                                className="w-full bg-slate-950/30 border border-white/5 p-2 px-3 rounded-lg text-slate-400 text-xs italic focus:border-purple-500/30 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="lg:col-span-4 grid grid-cols-2 gap-4 h-fit">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Points (Locked)</label>
                                            <div className="relative font-mono">
                                                <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-yellow-500" />
                                                <input
                                                    type="number"
                                                    readOnly
                                                    value={task.baseReward}
                                                    className="w-full bg-slate-900 border border-white/5 p-3 pl-8 rounded-xl text-slate-400 font-black text-sm outline-none cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Verification</label>
                                            <button
                                                onClick={() => updateTaskLine(idx, 'requiresVerification', !task.requiresVerification)}
                                                className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${task.requiresVerification ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-slate-950/50 border-white/5 text-slate-50'}`}
                                            >
                                                <Shield className={`w-4 h-4 ${task.requiresVerification ? 'animate-pulse' : ''}`} />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">
                                                    {task.requiresVerification ? 'Auto-Verify ON' : 'Manual Claim'}
                                                </span>
                                            </button>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Min Tier</label>
                                            <select
                                                value={task.minTier}
                                                onChange={(e) => updateTaskLine(idx, 'minTier', Number(e.target.value))}
                                                className="w-full bg-slate-950/50 border border-white/5 p-3 rounded-xl text-white font-bold text-xs focus:border-purple-500/50 outline-none cursor-pointer"
                                            >
                                                <option value={1}>Bronze</option>
                                                <option value={2}>Silver</option>
                                                <option value={3}>Gold</option>
                                                <option value={4}>Platinum</option>
                                                <option value={5}>Diamond</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={handleBatchSave}
                            disabled={isSaving}
                            className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:brightness-110 disabled:opacity-50 p-5 rounded-2xl font-black text-white text-lg tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-purple-500/20 active:scale-[0.98]"
                        >
                            {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                            DEPLOY BATCH TO BASE NETWORK
                        </button>
                    </div>
                </div>
            )}

            {/* 2. Sponsor Portal (Paid Engagement) */}
            {viewMode === 'SPONSOR_PORTAL' && (
                <div className="glass-card p-8 bg-indigo-950/10 border border-indigo-500/10 shadow-2xl relative">
                    <div className="mb-6">
                        <h3 className="text-2xl font-black text-white flex items-center gap-2 uppercase">
                            <Share2 className="w-6 h-6 text-indigo-400" /> Sponsor Engagement Portal
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Paid campaigns using Creator Tokens</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-indigo-400 uppercase mb-1 block">Project / Campaign Name</label>
                                <input
                                    value={sponsorTitle}
                                    onChange={(e) => setSponsorTitle(e.target.value)}
                                    placeholder="e.g. Disco Gacha Season 1"
                                    className="w-full bg-slate-900/50 border border-white/10 p-4 rounded-2xl text-white font-bold focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-indigo-400 uppercase mb-1 block">Landing Link</label>
                                <input
                                    value={sponsorLink}
                                    onChange={(e) => setSponsorLink(e.target.value)}
                                    placeholder="https://"
                                    className="w-full bg-slate-900/50 border border-white/10 p-4 rounded-2xl text-white font-mono text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-indigo-400 uppercase mb-1 block">Contact Email</label>
                                <input
                                    value={sponsorEmail}
                                    onChange={(e) => setSponsorEmail(e.target.value)}
                                    placeholder="sponsor@example.com"
                                    className="w-full bg-slate-900/50 border border-white/10 p-4 rounded-2xl text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="glass-card bg-indigo-500/5 border border-indigo-500/20 p-6 flex flex-col justify-between">
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
                                                onChange={(e) => setRewardPerUserUSD(e.target.value)}
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
                                                onChange={(e) => setTargetClaims(e.target.value)}
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
                                onClick={handleCreateSponsorship}
                                disabled={isSponsorSaving}
                                className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 disabled:opacity-50"
                            >
                                {isSponsorSaving ? 'Submitting to Base...' : 'Deploy Sponsorship'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Admin Config (Economy Center) */}
            {viewMode === 'ADMIN_CONFIG' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Platform Fee & Limits */}
                    <div className="glass-card p-8 border border-white/10 bg-slate-900/50">
                        <h4 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-yellow-500" /> ECONOMIC PARAMETERS
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Sponsorship Listing Fee (USDC)</label>
                                <input
                                    value={newPlatformFee}
                                    onChange={(e) => setNewPlatformFee(e.target.value)}
                                    placeholder={`${currentPlatformFee ? Number(currentPlatformFee) / 1e6 : '1.00'}`}
                                    className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-yellow-500/50"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Min Pool (USD)</label>
                                    <input
                                        value={newMinPoolUSD}
                                        onChange={(e) => setNewMinPoolUSD(e.target.value)}
                                        placeholder="5"
                                        className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-white outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Min Reward/User (USD)</label>
                                    <input
                                        value={newMinRewardUSD}
                                        onChange={(e) => setNewMinRewardUSD(e.target.value)}
                                        placeholder="0.01"
                                        className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-white outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleUpdateEconomy}
                                className="w-full bg-yellow-600 hover:bg-yellow-500 p-3 rounded-xl text-white font-black text-xs uppercase tracking-widest mt-4"
                            >
                                Update Parameters
                            </button>
                        </div>
                    </div>

                    {/* Token Price (Scheduled) */}
                    <div className="glass-card p-8 border border-white/10 bg-slate-900/50">
                        <h4 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-indigo-400" /> TOKEN PRICE ORACLE
                        </h4>
                        <div className="space-y-4">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">
                                Governance: Price changes require a 24-hour timelock execution.
                            </p>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Target Token Price (USD)</label>
                                <div className="flex gap-2">
                                    <input
                                        value={newTokenPriceUSD}
                                        onChange={(e) => setNewTokenPriceUSD(e.target.value)}
                                        placeholder={`${currentTokenPrice ? Number(currentTokenPrice) / 1e18 : '0.01'}`}
                                        className="flex-1 bg-slate-950 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-indigo-500/50"
                                    />
                                    <button
                                        onClick={handleSchedulePrice}
                                        className="bg-indigo-600 hover:bg-indigo-500 px-6 rounded-xl text-white font-black text-[10px] uppercase"
                                    >
                                        Schedule
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-indigo-400" />
                                    <div>
                                        <p className="text-xs font-bold text-white">
                                            {pendingPrice?.[2] ? `Pending: $${(Number(pendingPrice[0]) / 1e18).toFixed(4)}` : 'No Pending Change'}
                                        </p>
                                        <p className="text-[9px] text-slate-500 uppercase">
                                            {pendingPrice?.[2] ? `Effective: ${new Date(Number(pendingPrice[1]) * 1000).toLocaleString()}` : 'Ready for schedule'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleExecutePrice}
                                    disabled={!pendingPrice?.[2]}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pendingPrice?.[2] ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                >
                                    Execute Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Active Campaigns & Audit Hub */}
            {viewMode === 'VIEW_TASKS' && (
                <div className="space-y-8 animate-in fade-in duration-700">
                    <div className="flex gap-1 bg-slate-950/50 p-1 rounded-2xl w-fit border border-white/5">
                        <button
                            onClick={() => setAuditSubMode('SPONSORS')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${auditSubMode === 'SPONSORS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Sponsorship Audit
                        </button>
                        <button
                            onClick={() => setAuditSubMode('ORGANIC')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${auditSubMode === 'ORGANIC' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Organic Tasks
                        </button>
                    </div>

                    {auditSubMode === 'SPONSORS' ? (
                        <>
                            <div className="glass-card p-8 bg-indigo-950/10 border border-indigo-500/10 shadow-2xl relative overflow-hidden">
                                <div className="flex justify-between items-center mb-8">
                                    <div>
                                        <h3 className="text-2xl font-black text-white flex items-center gap-2">
                                            <Shield className="w-6 h-6 text-indigo-400" /> SPONSOR AUDIT HUB
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Review and verify paid campaign requests</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => refetchSponsors()}
                                            className="p-3 bg-slate-900 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isCheckingRequests ? 'animate-spin' : ''}`} />
                                        </button>
                                        <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase">Total Requests: {nextSponsorId ? Number(nextSponsorId) - 1 : 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Audit Table */}
                                <div className="space-y-4">
                                    {nextSponsorId && Number(nextSponsorId) > 1 ? (
                                        Array.from({ length: Number(nextSponsorId) - 1 }).map((_, i) => (
                                            <AuditRequestRow key={i + 1} id={BigInt(i + 1)} onApprove={handleApprove} onReject={handleReject} />
                                        ))
                                    ) : (
                                        <p className="text-center text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] py-10 opacity-50">
                                            NO PENDING AUDIT LOGS
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="glass-card p-6 bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center text-center group transition-all hover:bg-slate-900/60">
                                    <Zap className="w-6 h-6 text-yellow-500 mb-2 group-hover:scale-125 transition-transform" />
                                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Points Flow</h5>
                                    <p className="text-2xl font-black text-white mt-1">2.4M</p>
                                </div>
                                <div className="glass-card p-6 bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center text-center group transition-all hover:bg-slate-900/60">
                                    <Clock className="w-6 h-6 text-indigo-400 mb-2 group-hover:scale-125 transition-transform" />
                                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Avg. TTR (Time to Reward)</h5>
                                    <p className="text-2xl font-black text-white mt-1">12.4s</p>
                                </div>
                                <div className="glass-card p-6 bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center text-center group transition-all hover:bg-slate-900/60">
                                    <List className="w-6 h-6 text-purple-500 mb-2 group-hover:scale-125 transition-transform" />
                                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Success Rate</h5>
                                    <p className="text-2xl font-black text-emerald-400 mt-1">99.8%</p>
                                </div>
                            </div>

                            <div className="glass-card p-8 bg-slate-900/40 border border-white/5">
                                <h4 className="text-sm font-black text-white uppercase tracking-widest mb-6">Active Campaigns (Live Tasks)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {nextSponsorId && Number(nextSponsorId) > 1 ? (
                                        Array.from({ length: Number(nextSponsorId) - 1 }).map((_, i) => (
                                            <SponsorCardItem key={i + 1} id={BigInt(i + 1)} />
                                        ))
                                    ) : (
                                        <div className="col-span-full py-10 text-center text-slate-700 text-[10px] font-black uppercase tracking-widest">
                                            No live campaigns found
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="glass-card p-8 bg-slate-900/20 border border-white/5">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-white">ORGANIC TASKS</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">In-house engagement tasks management</p>
                                </div>
                                <div className="px-4 py-2 bg-slate-800 rounded-full">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Live: {nextTaskId ? Number(nextTaskId) - 1 : 0}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {nextTaskId && Number(nextTaskId) > 1 ? (
                                    Array.from({ length: Number(nextTaskId) - 1 }).map((_, i) => (
                                        <OrganicTaskRow
                                            key={i + 1}
                                            id={BigInt(i + 1)}
                                            onToggle={handleToggleTaskStatus}
                                        />
                                    ))
                                ) : (
                                    <div className="py-20 text-center opacity-30">
                                        <Clock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.5em]">No Organic Tasks Deployed</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div >
    );
}

// --- SUB-COMPONENTS FOR FETCHING ---

// --- SUB-COMPONENTS FOR FETCHING & AUDIT ---

function OrganicTaskRow({ id, onToggle }) {
    const { data: task } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'tasks',
        args: [id]
    });

    if (!task || task[0] === "") return null;

    const baseReward = task[0];
    const isActive = task[1];
    const title = task[4];
    const requiresVerification = task[7];

    return (
        <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex items-center justify-between group hover:border-indigo-500/20 transition-all">
            <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                    {requiresVerification ? <Shield className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>
                <div>
                    <h5 className="text-xs font-black text-white uppercase">{title}</h5>
                    <div className="flex gap-2 mt-1">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{Number(baseReward)} XP</span>
                        <span className={`text-[8px] font-bold uppercase ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isActive ? '● PUBLIC' : '○ DISABLED'}
                        </span>
                    </div>
                </div>
            </div>
            <button
                onClick={() => onToggle(id, isActive)}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${isActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
            >
                {isActive ? 'Disable' : 'Enable'}
            </button>
        </div>
    );
}

function AuditRequestRow({ id, onApprove, onReject }) {
    const { data: request } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'sponsorRequests',
        args: [id]
    });

    if (!request || Number(request[8]) === 2) return null; // REJECTED

    // [sponsor, level, title, link, email, rewardPool, rewardPerUserUSD, targetClaims, status, timestamp]
    const sponsor = request[0];
    const title = request[2];
    const link = request[3];
    const rewardPerUserUSD = request[6];
    const targetClaims = request[7];
    const status = Number(request[8]);

    return (
        <div className="p-6 rounded-2xl border border-white/5 bg-slate-950/50 flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-indigo-500/30 transition-all">
            <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                    <Share2 className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h4 className="font-black text-white uppercase text-sm">{title}</h4>
                    <p className="text-[10px] text-slate-500 font-mono">ID: #{id.toString()} | From: {sponsor.slice(0, 6)}...{sponsor.slice(-4)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-[9px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-bold">{targetClaims.toString()} Targets</span>
                        <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-bold">${(Number(rewardPerUserUSD) / 1e18).toFixed(2)} USD</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${status === 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}`}>
                            {status === 0 ? 'PENDING AUDIT' : 'APPROVED'}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {status === 0 && (
                    <>
                        <button
                            onClick={() => onReject(id.toString())}
                            className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase rounded-xl hover:bg-red-500/20 transition-all"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => onApprove(id.toString())}
                            className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-500 transition-all shadow-lg"
                        >
                            Approve
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function SponsorCardItem({ id }) {
    const { data: request } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'sponsorRequests',
        args: [id]
    });

    if (!request || Number(request[8]) !== 1) return null; // ONLY SHOW APPROVED

    const title = request[2];
    const link = request[3];
    const rewardPerUserUSD = request[6];
    const targetClaims = request[7];

    return (
        <div className="p-5 bg-slate-900/30 border border-white/5 rounded-2xl relative overflow-hidden group hover:bg-slate-900/50 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <span className="text-[8px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded">ID #{id.toString()}</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <span className="font-black text-white text-xs">{title.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                    <h4 className="font-bold text-white text-sm truncate max-w-[120px]">{title}</h4>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Live Campaign</p>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">Value per Claim:</span>
                    <span className="font-black text-emerald-400">${(Number(rewardPerUserUSD) / 1e18).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">Target Users:</span>
                    <span className="font-black text-white">{targetClaims.toString()}</span>
                </div>
            </div>

            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 border border-white/5 py-2.5 rounded-xl text-white text-[9px] font-black uppercase text-center block hover:border-indigo-500/50 transition-all group-hover:bg-indigo-600 group-hover:border-indigo-500"
            >
                Preview Mission
            </a>
        </div>
    );
}
