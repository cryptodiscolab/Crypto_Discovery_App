import React, { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSignMessage } from 'wagmi';
import {
    Transaction,
    TransactionButton,
    TransactionStatus,
    TransactionStatusLabel,
    TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';
import { encodeFunctionData } from 'viem';
import { Plus, Zap, Calendar, Loader2, CheckCircle2, AlertCircle, X, Star, Database, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { DAILY_APP_ABI, CONTRACTS } from '../../lib/contracts';

const DAILY_APP_ADDRESS = CONTRACTS.DAILY_APP;

/**
 * TaskViewer sub-component to show existing data
 */
function TaskViewer({ address, abi }) {
    const { data: dailyIds } = useReadContract({ address, abi, functionName: 'getDailyTasks' });
    const { data: nextSponsorId } = useReadContract({ address, abi, functionName: 'nextSponsorId' });

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 px-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">Live Content on Blockchain</span>
            </div>

            {/* Daily Tasks List */}
            <div className="space-y-2">
                <h4 className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Active Daily Tasks</h4>
                <div className="grid grid-cols-1 gap-2">
                    {dailyIds?.map(id => (
                        <DailyTaskItem key={Number(id)} id={id} address={address} abi={abi} />
                    ))}
                    {(!dailyIds || dailyIds.length === 0) && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[9px] text-slate-500 italic text-center">No daily tasks deployed</div>
                    )}
                </div>
            </div>

            {/* Sponsorships List */}
            <div className="space-y-2">
                <h4 className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Sponsorship Cards</h4>
                <div className="grid grid-cols-1 gap-3">
                    {Array.from({ length: Number(nextSponsorId || 1) - 1 }).map((_, i) => (
                        <SponsorCardItem key={i + 1} id={BigInt(i + 1)} address={address} abi={abi} />
                    ))}
                    {Number(nextSponsorId || 1) <= 1 && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[9px] text-slate-500 italic text-center">No sponsorships deployed</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DailyTaskItem({ id, address, abi }) {
    const { data: task } = useReadContract({ address, abi, functionName: 'tasks', args: [id] });
    if (!task) return null;
    return (
        <div className="flex items-center justify-between p-3 bg-[#0a0a0c] border border-white/5 rounded-xl">
            <div className="flex flex-col">
                <span className="text-[10px] text-white font-bold">{task[0]}</span>
                <span className="text-[8px] text-slate-500 uppercase tracking-tighter">Task ID: {id.toString()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                <Star className="w-2.5 h-2.5 text-indigo-400" />
                <span className="text-[10px] font-mono text-indigo-400 font-black">{task[1].toString()} XP</span>
            </div>
        </div>
    );
}

function SponsorCardItem({ id, address, abi }) {
    const { data: sponsor } = useReadContract({ address, abi, functionName: 'sponsorships', args: [id] });
    const { data: taskIds } = useReadContract({ address, abi, functionName: 'getSponsorTasks', args: [id] });

    if (!sponsor) return null;

    return (
        <div className="p-4 bg-[#0a0a0c] border border-white/5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{sponsor[0]}</span>
                </div>
                <span className="text-[8px] text-slate-700 font-bold uppercase tracking-widest">Sponsor ID: {id.toString()}</span>
            </div>

            <div className="space-y-2">
                {taskIds?.map(tid => (
                    <SponsorSubTask key={Number(tid)} id={tid} address={address} abi={abi} />
                ))}
            </div>
        </div>
    );
}

function SponsorSubTask({ id, address, abi }) {
    const { data: task } = useReadContract({ address, abi, functionName: 'tasks', args: [id] });
    if (!task) return null;
    return (
        <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 opacity-80">
            <span className="text-[9px] text-slate-300">• {task[0]}</span>
            <span className="text-[9px] font-mono text-indigo-400 font-black">{task[1].toString()} XP</span>
        </div>
    );
}

export function TaskManager() {
    const [mode, setMode] = useState('daily'); // 'daily' | 'sponsor' | 'view'

    // Daily Task State
    const [dailyDesc, setDailyDesc] = useState('');
    const [dailyPoints, setDailyPoints] = useState('');
    const [dailyExpire, setDailyExpire] = useState(true);

    // Sponsor State
    const [sponsorName, setSponsorName] = useState('');
    const [sponsorTasks, setSponsorTasks] = useState([{ desc: '', points: '' }]);

    const [pointSettings, setPointSettings] = useState([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);

    // MISI 1: Fetch Point Settings as Source of Truth
    const fetchPoints = async () => {
        setIsLoadingPoints(true);
        try {
            const { data, error } = await supabase
                .from('point_settings')
                .select('*')
                .eq('is_active', true);
            if (!error && data) setPointSettings(data);
        } catch (err) {
            console.error('[FetchPoints Error]', err);
        } finally {
            setIsLoadingPoints(false);
        }
    };

    // Helper: Match standardized points
    const getGlobalPoints = (desc) => {
        if (!pointSettings.length) return 0;
        const normalized = desc.toLowerCase();
        // Simple heuristic matching
        if (normalized.includes('check-in')) return pointSettings.find(s => s.activity_key === 'daily_checkin')?.points_value || 50;
        if (normalized.includes('follow')) return pointSettings.find(s => s.activity_key === 'social_follow')?.points_value || 100;
        return 0;
    };

    // Database Tasks State (MISI 1)
    const [tasks, setTasks] = useState([]);
    const [isFetching, setIsFetching] = useState(false);

    // Wagmi hooks
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    // MISI 1: Fetch Admin Tasks dari Supabase
    const fetchAdminTasks = async () => {
        setIsFetching(true);
        try {
            const { data, error } = await supabase
                .from('daily_tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[fetchAdminTasks Error]', error);
                toast.error(`Failed to fetch tasks: ${error.message}`);
                return;
            }

            setTasks(data || []);
        } catch (err) {
            console.error('[fetchAdminTasks Exception]', err);
            toast.error('Unexpected error while fetching tasks');
        } finally {
            setIsFetching(false);
        }
    };

    // MISI 1: Auto-fetch saat component mount
    useEffect(() => {
        fetchAdminTasks();
        fetchPoints();
    }, []);

    // Reset forms on success
    const handleTxSuccess = () => {
        toast.success('Sponsorship deployed on-chain!');
        setDailyDesc('');
        setSponsorName('');
        setSponsorTasks([{ desc: '', points: '' }]);
        fetchAdminTasks();
    };

    // Build calls for adminCreateSponsorship (daily = Bronze + 1 task, sponsor = up to 3)
    const buildSponsorCalls = () => {
        const titles = mode === 'daily'
            ? [dailyDesc].filter(Boolean)
            : sponsorTasks.filter(t => t.desc && t.link).map(t => t.desc);
        const links = mode === 'daily'
            ? [''] // daily tasks have no specific link
            : sponsorTasks.filter(t => t.desc && t.link).map(t => t.link);

        if (!titles.length) return [];

        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI,
                functionName: 'adminCreateSponsorship',
                args: [
                    0, // SponsorLevel.BRONZE
                    titles,
                    links,
                    '' // email not required for admin
                ],
            }),
        }];
    };

    const addSponsorTask = () => {
        if (sponsorTasks.length < 3) {
            setSponsorTasks([...sponsorTasks, { desc: '', points: '' }]);
        } else {
            toast.error("Max 3 tasks per card");
        }
    };

    const removeSponsorTask = (index) => {
        setSponsorTasks(sponsorTasks.filter((_, i) => i !== index));
    };

    const updateSponsorTask = (index, field, value) => {
        const newTasks = [...sponsorTasks];
        newTasks[index][field] = value;
        setSponsorTasks(newTasks);
    };

    const handleClearAllDaily = async () => {
        if (!window.confirm("CRITICAL: This will delete/deactivate ALL daily tasks. Proceed?")) return;
        const tid = toast.loading("Cleaning up database...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Cleanup All Tasks\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/tasks/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action: 'CLEAR_ALL'
                })
            });

            if (!response.ok) throw new Error("Cleanup failed");
            toast.success("Database Cleared!", { id: tid });
            fetchAdminTasks();
        } catch (err) {
            toast.error(err.message, { id: tid });
        }
    };

    const handleDownloadCSV = async () => {
        const tid = toast.loading("Preparing CSV backup...");
        try {
            const { data, error } = await supabase
                .from('v_user_full_profile')
                .select('wallet_address, username, display_name, xp, tier, rank_name');

            if (error) throw error;
            if (!data || data.length === 0) {
                toast.error("No user data found to backup", { id: tid });
                return;
            }

            // Convert to CSV
            const headers = ['Wallet Address', 'Username', 'Display Name', 'XP', 'Tier', 'Rank'];
            const csvRows = [
                headers.join(','),
                ...data.map(user => [
                    user.wallet_address,
                    `"${user.username}"`,
                    `"${user.display_name}"`,
                    user.xp,
                    user.tier,
                    user.rank_name
                ].join(','))
            ];
            const csvBuffer = csvRows.join('\n');
            const blob = new Blob([csvBuffer], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', `season_backup_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast.success("Backup Downloaded!", { id: tid });
        } catch (err) {
            console.error("CSV Export Error:", err);
            toast.error("Failed to export data: " + err.message, { id: tid });
        }
    };

    const handleResetSeason = async () => {
        const firstConfirm = window.confirm("🚨 WARNING: This will permanently RESET all user XP and Tiers to zero for the new season. Have you downloaded the CSV backup?");
        if (!firstConfirm) return;

        const secondConfirm = window.prompt("To confirm, please type 'RESET SEASON' in ALL CAPS below:");
        if (secondConfirm !== 'RESET_SEASON') {
            toast.error("Reset cancelled: Confirmation text did not match.");
            return;
        }

        const tid = toast.loading("Executing Season Reset...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Full Season Reset\nAdmin: ${address}\nTime: ${timestamp}\nAction: Permanently wipe all progression.`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/tasks/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action: 'RESET_SEASON'
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Reset failed");

            toast.success("SEASON RESET SUCCESSFUL!", { id: tid });
            fetchAdminTasks(); // Refresh list if any changes (though reset clears claims)
        } catch (err) {
            toast.error("Reset failed: " + err.message, { id: tid });
        }
    };

    const isLoading = isPending || isWaiting;

    return (
        <div className="space-y-6" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>

            {/* MISI 1: Stats Dashboard */}
            <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="bg-[#121214] p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total (DB)</p>
                    <p className="text-2xl font-black text-white">{isFetching ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : tasks.length}</p>
                </div>
                <div className="bg-[#121214] p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Active (DB)</p>
                    <p className="text-2xl font-black text-green-500">{isFetching ? <Loader2 className="w-4 h-4 animate-spin text-green-500" /> : tasks.filter(t => t.is_active).length}</p>
                </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex gap-2 p-1 bg-[#121214] border border-white/5 rounded-xl">
                <button
                    onClick={() => setMode('daily')}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'daily' ? 'bg-[#0a0a0c] text-white border border-white/5' : 'text-slate-600'}`}
                >
                    Add Daily
                </button>
                <button
                    onClick={() => setMode('sponsor')}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'sponsor' ? 'bg-[#0a0a0c] text-indigo-400 border border-white/5' : 'text-slate-600'}`}
                >
                    Add Sponsor
                </button>
                <button
                    onClick={() => setMode('view')}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'view' ? 'bg-[#0a0a0c] text-green-500 border border-white/5' : 'text-slate-600'}`}
                >
                    Live Content
                </button>
            </div>

            {/* Daily Task Form */}
            {mode === 'daily' && (
                <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter">Pin Daily Task</span>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Activity Type (Global Points)</label>
                        <select
                            onChange={(e) => {
                                const selected = pointSettings.find(s => s.activity_key === e.target.value);
                                if (selected) {
                                    setDailyPoints(selected.points_value);
                                    if (!dailyDesc) setDailyDesc(selected.activity_key.replace(/_/g, ' ').toUpperCase());
                                }
                            }}
                            className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors"
                        >
                            <option value="">-- Select Standard Activity --</option>
                            {pointSettings.map(s => (
                                <option key={s.id} value={s.activity_key}>
                                    {s.activity_key.toUpperCase()} (+{s.points_value} XP)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Description</label>
                        <input
                            type="text"
                            placeholder="e.g. Complete Daily Check-in"
                            value={dailyDesc}
                            onChange={(e) => setDailyDesc(e.target.value)}
                            className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">XP Reward (Auto-filled from Database)</label>
                        <input
                            type="number"
                            placeholder="100"
                            value={dailyPoints}
                            onChange={(e) => setDailyPoints(e.target.value)}
                            className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-indigo-400 font-black outline-none border-indigo-500/30 transition-colors font-mono"
                        />
                    </div>

                    <div className="flex items-center gap-2 px-1">
                        <input
                            type="checkbox"
                            id="dailyExpire"
                            checked={dailyExpire}
                            onChange={(e) => setDailyExpire(e.target.checked)}
                            className="w-4 h-4 rounded border-white/5 bg-[#0a0a0c] text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="dailyExpire" className="text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">
                            Auto-Expire (24 Hours)
                        </label>
                    </div>

                    <Transaction
                        calls={buildSponsorCalls()}
                        onSuccess={handleTxSuccess}
                        onError={(e) => toast.error(e.shortMessage || 'Deploy failed')}
                    >
                        <TransactionButton
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-500/10"
                            text="DEPLOY DAILY TASK (FREE)"
                        />
                        <div className="mt-2 text-[10px] text-slate-500 text-center">
                            <TransactionStatus><TransactionStatusLabel /><TransactionStatusAction /></TransactionStatus>
                        </div>
                    </Transaction>
                </div>
            )}

            {/* Sponsor Card Form */}
            {mode === 'sponsor' && (
                <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter">Create Sponsor Card</span>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Sponsor Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Warpcast Mini"
                            value={sponsorName}
                            onChange={(e) => setSponsorName(e.target.value)}
                            className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sub-Tasks ({sponsorTasks.length}/3)</label>
                            {sponsorTasks.length < 3 && (
                                <button onClick={addSponsorTask} className="text-[8px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Add
                                </button>
                            )}
                        </div>

                        {sponsorTasks.map((task, idx) => (
                            <div key={idx} className="p-4 bg-[#0a0a0c] rounded-xl border border-white/5 space-y-3 relative group">
                                {sponsorTasks.length > 1 && (
                                    <button
                                        onClick={() => removeSponsorTask(idx)}
                                        className="absolute top-2 right-2 text-slate-800 hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                                <input
                                    type="text"
                                    placeholder="Task description"
                                    value={task.desc}
                                    onChange={(e) => updateSponsorTask(idx, 'desc', e.target.value)}
                                    className="w-full bg-transparent border-b border-white/5 pb-2 text-[11px] text-white outline-none focus:border-indigo-500/30"
                                />
                                <div className="flex items-center gap-2">
                                    <Star className="w-3 h-3 text-indigo-500" />
                                    <input
                                        type="number"
                                        placeholder="Points"
                                        value={task.points}
                                        onChange={(e) => updateSponsorTask(idx, 'points', e.target.value)}
                                        className="bg-transparent text-[11px] text-indigo-400 outline-none w-20 font-black"
                                    />
                                    <span className="text-[8px] font-black text-slate-800 uppercase">XP Reward</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Transaction
                        calls={buildSponsorCalls()}
                        onSuccess={handleTxSuccess}
                        onError={(e) => toast.error(e.shortMessage || 'Deploy failed')}
                    >
                        <TransactionButton
                            className="w-full py-4 bg-white hover:bg-slate-100 text-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl"
                            text="DEPLOY SPONSOR CARD (FREE)"
                        />
                        <div className="mt-2 text-[10px] text-slate-500 text-center">
                            <TransactionStatus><TransactionStatusLabel /><TransactionStatusAction /></TransactionStatus>
                        </div>
                    </Transaction>
                </div>
            )}

            {/* List View (DB & Blockchain) */}
            {mode === 'view' && (
                <div className="space-y-6">
                    {/* Database Records Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <Database className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-[10px] font-black text-white uppercase tracking-tighter">Database Records (Supabase)</span>
                            </div>
                            <button
                                onClick={fetchAdminTasks}
                                disabled={isFetching}
                                className="text-[8px] font-black text-indigo-500 uppercase hover:underline disabled:opacity-50"
                            >
                                {isFetching ? 'Syncing...' : 'Refresh DB'}
                            </button>
                        </div>

                        <div className="space-y-2">
                            {tasks.map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-3 bg-[#0a0a0c] border border-white/5 rounded-xl hover:border-indigo-500/20 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-white font-bold">{task.description}</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[8px] text-slate-500 uppercase tracking-tighter">ID: {task.id}</span>
                                            <span className={`text-[7px] px-1.5 py-0.5 rounded-full uppercase font-black ${task.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                {task.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                                        <Star className="w-2.5 h-2.5 text-indigo-400" />
                                        <span className="text-[10px] font-mono text-indigo-400 font-black">{task.xp_reward} XP</span>
                                    </div>
                                </div>
                            ))}
                            {tasks.length === 0 && !isFetching && (
                                <div className="p-4 bg-[#0a0a0c] rounded-xl border border-white/5 text-center">
                                    <p className="text-[10px] text-slate-500 italic">No tasks found in database.</p>
                                </div>
                            )}

                            {tasks.length > 0 && (
                                <button
                                    onClick={handleClearAllDaily}
                                    className="w-full mt-4 py-3 bg-red-950/20 hover:bg-red-500/20 border border-red-500/30 text-red-500 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                                >
                                    Clear All Daily Tasks (Data Archive)
                                </button>
                            )}

                            {/* SEASON RESET TOOLS */}
                            <div className="pt-4 mt-4 border-t border-white/5 space-y-3">
                                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Season Management</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleDownloadCSV}
                                        className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <Download className="w-3 h-3 text-indigo-400" />
                                        Backup CSV
                                    </button>
                                    <button
                                        onClick={handleResetSeason}
                                        className="flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Reset Season
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <TaskViewer address={DAILY_APP_ADDRESS} abi={DAILY_APP_ABI} />
                    </div>
                </div>
            )}

            {/* Status Feedback */}
            {writeError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[9px] font-black text-red-500 uppercase leading-tight">
                        Pipeline Error: {writeError.shortMessage || "Transaction failed."}
                    </p>
                </div>
            )}

            {hash && !isSuccess && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
                    <Loader2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5 animate-spin" />
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-indigo-400 uppercase leading-tight">Syncing with Node...</p>
                        <a
                            href={`https://sepolia.basescan.org/tx/${hash}`}
                            target="_blank"
                            className="text-[8px] text-indigo-500/50 underline truncate block"
                        >
                            View on Basescan
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

