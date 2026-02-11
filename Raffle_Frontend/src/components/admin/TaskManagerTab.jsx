import React, { useState, useEffect } from 'react';
import { Plus, Zap, Clock, Shield, Award, ExternalLink, RefreshCw, Send, List, Share2, Twitter, MessageCircle, Heart, Repeat } from 'lucide-react';
import { useWriteContract, useReadContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { V12_ABI } from '../../shared/constants/abis';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

const V12_ADDRESS = import.meta.env.VITE_V12_CONTRACT_ADDRESS || "0xEF8ab11E070359B9C0aA367656893B029c1d04d4";

const PLATFORMS = {
    'Farcaster': { id: 'farcaster', domain: 'https://warpcast.com/...', icon: <Share2 className="w-4 h-4" /> },
    'X': { id: 'x', domain: 'https://x.com/...', icon: <Twitter className="w-4 h-4" /> },
    'Base App': { id: 'base', domain: 'https://base.app/...', icon: <img src="/base-logo.png" className="w-4 h-4 grayscale opacity-50" alt="Base" /> }
};

const DAILY_APP_ADDRESS = import.meta.env.VITE_DAILY_APP_ADDRESS;
const DAILY_APP_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "_name", "type": "string" },
            { "internalType": "string[]", "name": "_descs", "type": "string[]" },
            { "internalType": "uint256[]", "name": "_rewards", "type": "uint256[]" }
        ],
        "name": "createSponsorship",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextSponsorId",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "name": "sponsorships",
        "outputs": [
            { "internalType": "string", "name": "name", "type": "string" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

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
    const { writeContractAsync } = useWriteContract();
    const [isSaving, setIsSaving] = useState(false);

    // Sponsorship State
    const [showSponsorForm, setShowSponsorForm] = useState(false);
    const [sponsorName, setSponsorName] = useState('');
    const [sponsorTasks, setSponsorTasks] = useState([{ desc: '', points: 100 }]);
    const [isSponsorSaving, setIsSponsorSaving] = useState(false);

    const { data: nextSponsorId, refetch: refetchSponsors } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'nextSponsorId',
    });

    // Initial state for 3 tasks with advanced filters
    const [tasksBatch, setTasksBatch] = useState([
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: 100, minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true }
    ]);

    const [pointSettings, setPointSettings] = useState([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);

    const { data: nextTaskId, refetch: refetchCount } = useReadContract({
        address: V12_ADDRESS,
        abi: V12_ABI,
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
                toast.error("Gagal mengambil data poin!");
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

    // 3. Supabase Sync Effect (Triggers ONLY when transaction is successful)
    useEffect(() => {
        const syncToSupabase = async () => {
            // Handle Success
            if (isTxSuccess && receipt && !syncedHashes.current.has(receipt.transactionHash)) {
                syncedHashes.current.add(receipt.transactionHash);

                const validTasks = tasksBatch.filter(t => t.title.trim() !== '');
                const tid = toast.loading("Transaksi sukses! Menyimpan ke database...");

                try {
                    for (const task of validTasks) {
                        try {
                            const { id, platform, action, ...taskData } = task;
                            const { error: dbError } = await supabase.from('tasks').insert([{
                                ...taskData,
                                platform: PLATFORMS[platform]?.id || platform.toLowerCase(),
                                action_type: ACTIONS[action]?.id || action.toLowerCase(),
                                requires_verification: task.requiresVerification,
                                min_neynar_score: task.minNeynarScore,
                                min_followers: task.minFollowers,
                                account_age_requirement: task.accountAgeLimit,
                                power_badge_required: task.powerBadgeRequired,
                                no_spam_filter: task.noSpamFilter,
                                reward_points: task.baseReward,
                                created_at: new Date().toISOString(),
                                is_active: true,
                                transaction_hash: receipt.transactionHash
                            }]);

                            if (dbError) console.error('[Supabase Sync Error]', dbError);

                            await supabase.from('admin_audit_logs').insert([{
                                admin_address: address || '0x0',
                                action: 'DEPLOY_BATCH_TASK',
                                details: {
                                    task_name: task.title,
                                    points: task.baseReward,
                                    platform: task.platform,
                                    action: task.action,
                                    min_tier: task.minTier,
                                    tx_hash: receipt.transactionHash
                                }
                            }]);
                        } catch (err) {
                            console.warn('[Sync/Log Error] Non-critical failure:', err);
                        }
                    }

                    toast.success("Selesai! Task on-chain & DB sinkron.", { id: tid });

                    // Reset to default
                    setTasksBatch([
                        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: getGlobalPoints('Farcaster', 'Follow'), minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
                        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: getGlobalPoints('Farcaster', 'Follow'), minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true },
                        { platform: 'Farcaster', action: 'Follow', title: '', link: '', baseReward: getGlobalPoints('Farcaster', 'Follow'), minTier: 1, cooldown: 86400, requiresVerification: true, minNeynarScore: 0, minFollowers: 0, accountAgeLimit: 0, powerBadgeRequired: false, noSpamFilter: true }
                    ]);
                    refetchCount();
                    setTxHash(null);
                } catch (error) {
                    console.error('Sync Error:', error);
                    toast.error("Transaksi sukses, tapi gagal simpan ke DB. Cek log.", { id: tid });
                } finally {
                    setIsSaving(false);
                }
            }

            // Handle Failure (Unlocking UI)
            if (isTxError) {
                console.error('Wait Error:', txError);
                toast.error(`Konfirmasi Blockchain Gagal: ${txError?.shortMessage || txError?.message || "Internal Error"}`);
                setIsSaving(false);
                setTxHash(null);
            }
        };

        syncToSupabase();
    }, [isTxSuccess, isTxError, receipt, txError]);

    const handleBatchSave = async () => {
        const validTasks = tasksBatch.filter(t => t.title.trim() !== '');

        if (validTasks.length === 0) {
            toast.error("Isi minimal satu Nama Task!");
            return;
        }

        const EXPECTED_CHAIN_ID = 8453;
        if (chainId !== EXPECTED_CHAIN_ID) {
            toast.error(`Wrong Network! Please switch to Base Mainnet (Connected: ${chainId || 'Unknown'})`);
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Minta tanda tangan wallet...");

        try {
            const baseRewards = validTasks.map(t => BigInt(t.baseReward));
            const cooldowns = validTasks.map(t => BigInt(t.cooldown));
            const minTiers = validTasks.map(t => t.minTier);
            const titles = validTasks.map(t => t.title);
            const links = validTasks.map(t => t.link || 'https://warpcast.com/CryptoDisco');
            const requiresVerifications = validTasks.map(t => t.requiresVerification);

            const hash = await writeContractAsync({
                address: V12_ADDRESS,
                abi: V12_ABI,
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

            if (!hash) throw new Error("Gagal mendapatkan transaction hash!");

            setTxHash(hash);
            // Update toast to information state, keep it loading for mining
            toast.loading("Mengirim ke Base Network...", { id: tid });

        } catch (e) {
            console.error("Batch Deployment Error:", e);
            toast.error(e.shortMessage || e.message || "Gagal mendaftarkan task", { id: tid });
            setIsSaving(false); // Unlock UI ONLY on premature error
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

    const handleCreateSponsorship = async () => {
        if (!sponsorName.trim()) return toast.error("Enter Sponsor Name");
        if (sponsorTasks.some(t => !t.desc.trim())) return toast.error("All tasks must have descriptions");

        setIsSponsorSaving(true);
        const tid = toast.loading("Deploying Sponsorship...");

        try {
            const hash = await writeContractAsync({
                address: DAILY_APP_ADDRESS,
                abi: DAILY_APP_ABI,
                functionName: 'createSponsorship',
                args: [
                    sponsorName,
                    sponsorTasks.map(t => t.desc),
                    sponsorTasks.map(t => BigInt(t.points))
                ]
            });

            if (hash) {
                toast.success("Sponsorship Created!", { id: tid });
                setSponsorName('');
                setSponsorTasks([{ desc: '', points: 100 }]);
                setShowSponsorForm(false);
                setTimeout(() => refetchSponsors(), 2000); // Give time for indexing
            }
        } catch (error) {
            console.error("Sponsorship Error:", error);
            toast.error(error.shortMessage || "Failed to create sponsorship", { id: tid });
        } finally {
            setIsSponsorSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="glass-card p-8 bg-purple-950/10 border border-purple-500/10 shadow-2xl overflow-hidden relative">
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />

                <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                        <Plus className="w-6 h-6 text-purple-500" /> SMART BATCH CREATOR
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Manage multiple sponsorship tasks with one click</p>
                </div>
                <button
                    onClick={() => setShowSponsorForm(!showSponsorForm)}
                    className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${showSponsorForm ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-900 text-slate-500 border-white/5 hover:text-white'}`}
                >
                    {showSponsorForm ? 'Close Register' : '+ New Sponsorship'}
                </button>

                {/* SPONSORSHIP FORM (Minimalist) */}
                {/* SPONSORSHIP FORM (Minimalist) */}
                {showSponsorForm && (
                    <div
                        className="mb-8 bg-[#0a0a0c] p-6 rounded-2xl border border-indigo-500/20 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300"
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">Sponsor Identity</label>
                                    <input
                                        value={sponsorName}
                                        onChange={(e) => setSponsorName(e.target.value)}
                                        placeholder="e.g. Warpcast (Official)"
                                        className="w-full bg-slate-900/50 border border-white/10 p-3 rounded-xl text-white text-sm font-bold focus:border-indigo-500/50 outline-none"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleAddSponsorTask}
                                        className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 transition-all"
                                    >
                                        + Task
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {sponsorTasks.map((task, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <span className="text-[10px] text-slate-600 font-mono w-4">{i + 1}</span>
                                        <input
                                            value={task.desc}
                                            onChange={(e) => handleSponsorTaskChange(i, 'desc', e.target.value)}
                                            placeholder="Task Description"
                                            className="flex-1 bg-transparent border-b border-white/10 py-2 text-xs text-slate-300 focus:border-indigo-500/50 outline-none"
                                        />
                                        <div className="flex items-center gap-1 bg-slate-900 px-2 rounded-lg">
                                            <Zap className="w-3 h-3 text-yellow-500" />
                                            <input
                                                type="number"
                                                value={task.points}
                                                onChange={(e) => handleSponsorTaskChange(i, 'points', e.target.value)}
                                                className="w-12 bg-transparent py-2 text-xs font-mono text-yellow-500 font-bold outline-none text-right"
                                            />
                                        </div>
                                        {sponsorTasks.length > 1 && (
                                            <button onClick={() => handleRemoveSponsorTask(i)} className="text-slate-600 hover:text-red-500">
                                                <List className="w-3 h-3 rotate-45" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleCreateSponsorship}
                                disabled={isSponsorSaving}
                                className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                            >
                                {isSponsorSaving ? 'Deploying...' : 'Deploy Sponsorship Module'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-6 mb-10">
                    {tasksBatch.map((task, idx) => (
                        <div key={idx} className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 relative group transition-all hover:bg-slate-900/60 hover:border-purple-500/20">
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-black text-slate-500 group-hover:text-purple-400 group-hover:border-purple-500/50 transition-all z-10 shadow-lg">
                                {idx + 1}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Platform & Action Dropdowns */}
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

                                {/* Task Details */}
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

                                {/* Pts & Tier */}
                                <div className="lg:col-span-4 grid grid-cols-2 gap-4 h-fit">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Points (Locked)</label>
                                        <div className="relative">
                                            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-yellow-500" />
                                            <input
                                                type="number"
                                                readOnly
                                                value={task.baseReward}
                                                className="w-full bg-slate-900 border border-white/5 p-3 pl-8 rounded-xl text-slate-400 font-black text-sm outline-none cursor-not-allowed"
                                                title="Poin dikunci oleh kebijakan Admin SBT"
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

                                {/* Advanced Filters SECTION */}
                                {task.requiresVerification && (
                                    <div className="lg:col-span-12 mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-slate-950/30 rounded-2xl border border-purple-500/10">
                                        <div>
                                            <label className="text-[9px] font-black text-purple-400 uppercase mb-1 block">Min Neynar Score</label>
                                            <input
                                                type="number"
                                                value={task.minNeynarScore}
                                                onChange={(e) => updateTaskLine(idx, 'minNeynarScore', Number(e.target.value))}
                                                className="w-full bg-slate-900 border border-white/5 p-2 rounded-lg text-white text-xs"
                                                placeholder="0-100"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-purple-400 uppercase mb-1 block">Min Followers</label>
                                            <input
                                                type="number"
                                                value={task.minFollowers}
                                                onChange={(e) => updateTaskLine(idx, 'minFollowers', Number(e.target.value))}
                                                className="w-full bg-slate-900 border border-white/5 p-2 rounded-lg text-white text-xs"
                                                placeholder="Count"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-purple-400 uppercase mb-1 block">Account Age (Days)</label>
                                            <input
                                                type="number"
                                                value={task.accountAgeLimit}
                                                onChange={(e) => updateTaskLine(idx, 'accountAgeLimit', Number(e.target.value))}
                                                className="w-full bg-slate-900 border border-white/5 p-2 rounded-lg text-white text-xs"
                                                placeholder="Days"
                                            />
                                        </div>
                                        <div className="flex flex-col justify-end">
                                            <label className="text-[9px] font-black text-purple-400 uppercase mb-1 block">Power Badge</label>
                                            <button
                                                onClick={() => updateTaskLine(idx, 'powerBadgeRequired', !task.powerBadgeRequired)}
                                                className={`p-2 rounded-lg text-[10px] font-bold border transition-all ${task.powerBadgeRequired ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-900 border-white/5 text-slate-600'}`}
                                            >
                                                {task.powerBadgeRequired ? 'REQUIRED' : 'ANY'}
                                            </button>
                                        </div>
                                        <div className="flex flex-col justify-end">
                                            <label className="text-[9px] font-black text-purple-400 uppercase mb-1 block">Anti-Spam</label>
                                            <button
                                                onClick={() => updateTaskLine(idx, 'noSpamFilter', !task.noSpamFilter)}
                                                className={`p-2 rounded-lg text-[10px] font-bold border transition-all ${task.noSpamFilter ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-slate-900 border-white/5 text-slate-600'}`}
                                            >
                                                {task.noSpamFilter ? 'STRICT' : 'OFF'}
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <Award className="w-3 h-3" /> Minimum Tier 1 Enforcement Active
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center text-center group transition-all hover:bg-slate-900/60">
                    <List className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Tasks Count</p>
                    <p className="text-3xl font-black text-white">{nextTaskId ? (Number(nextTaskId) - 1).toString() : '0'}</p>
                </div>

                <div className="glass-card p-6 bg-slate-900/40 border border-white/5 col-span-2 relative overflow-hidden group">
                    <div className="relative z-10 h-full flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-blue-400 group-hover:rotate-12 transition-transform" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Standard Task Window</p>
                        </div>
                        <p className="text-xl font-black text-white">24 HOUR COOLDOWN</p>
                        <p className="text-[10px] text-slate-600 mt-2 italic font-bold">Optimized for daily social engagements and community growth.</p>
                    </div>
                    <Award className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12 group-hover:rotate-0 transition-all duration-500" />
                </div>

                {/* LIVE SPONSORSHIP FETCH DISPLAY */}
                <div className="space-y-4">
                    <div className="glass-card p-6 bg-slate-900/40 border border-white/5 flex items-center justify-between group transition-all hover:bg-slate-900/60">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Sponsorships</p>
                                <p className="text-xl font-black text-white">
                                    {nextSponsorId ? (Number(nextSponsorId) - 1).toString() : '0'} <span className="text-sm text-slate-600 font-medium">Campaigns</span>
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] text-slate-600 uppercase font-black bg-slate-950 px-2 py-1 rounded-md">Synced with Base</span>
                        </div>
                    </div>

                    {/* FETCHED LIST */}
                    {nextSponsorId && Number(nextSponsorId) > 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Array.from({ length: Number(nextSponsorId) - 1 }).map((_, i) => (
                                <SponsorCardItem key={i + 1} id={BigInt(i + 1)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}

// --- SUB-COMPONENTS FOR FETCHING ---

function SponsorCardItem({ id }) {
    const { data: sponsor } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'sponsorships',
        args: [id]
    });

    const { data: taskIds } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: DAILY_APP_ABI,
        functionName: 'getSponsorTasks',
        args: [id]
    });

    if (!sponsor) return null;

    return (
        <div className="p-5 bg-slate-900/30 border border-white/5 rounded-2xl relative overflow-hidden group hover:bg-slate-900/50 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <span className="text-[8px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded">ID #{id.toString()}</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <span className="font-black text-white text-xs">{sponsor[0].charAt(0)}</span>
                </div>
                <div>
                    <h4 className="font-bold text-white text-sm">{sponsor[0]}</h4>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Featured Partner</p>
                </div>
            </div>

            <div className="space-y-2 pl-2 border-l-2 border-white/5">
                {taskIds?.map(tid => (
                    <SponsorSubTask key={Number(tid)} id={tid} />
                ))}
            </div>
        </div>
    );
}

function SponsorSubTask({ id }) {
    const { data: task } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: [
            {
                "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
                "name": "tasks",
                "outputs": [
                    { "internalType": "string", "name": "desc", "type": "string" },
                    { "internalType": "uint256", "name": "pointReward", "type": "uint256" }
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ],
        functionName: 'tasks',
        args: [id]
    });

    if (!task) return <div className="h-4 w-20 bg-white/5 animate-pulse rounded"></div>;

    return (
        <div className="flex items-center justify-between text-xs group/item">
            <span className="text-slate-400 group-hover/item:text-slate-200 transition-colors">{task[0]}</span>
            <span className="font-mono font-black text-indigo-400 text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded">{task[1].toString()} XP</span>
        </div>
    );
}
