import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, decodeEventLog } from 'viem';
import { Plus, Zap, Calendar, Loader2, CheckCircle2, AlertCircle, X, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const DAILY_APP_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "_desc", "type": "string" },
            { "internalType": "uint256", "name": "_pointReward", "type": "uint256" }
        ],
        "name": "createDailyTask",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
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
        "name": "getDailyTasks",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "name": "tasks",
        "outputs": [
            { "internalType": "string", "name": "desc", "type": "string" },
            { "internalType": "uint256", "name": "pointReward", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_sponsorId", "type": "uint256" }],
        "name": "getSponsorTasks",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
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
    },
    {
        "inputs": [],
        "name": "nextSponsorId",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
];

const DAILY_APP_ADDRESS = import.meta.env.VITE_DAILY_APP_ADDRESS;

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

    // Sponsor State
    const [sponsorName, setSponsorName] = useState('');
    const [sponsorTasks, setSponsorTasks] = useState([{ desc: '', points: '' }]);

    const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

    const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    // Reset forms on success
    React.useEffect(() => {
        if (isSuccess) {
            toast.success("Transaction Confirmed!");
            setDailyDesc('');
            setDailyPoints('');
            setSponsorName('');
            setSponsorTasks([{ desc: '', points: '' }]);
        }
    }, [isSuccess]);

    const handleCreateDaily = () => {
        if (!dailyDesc || !dailyPoints) return toast.error("Fill all fields");
        writeContract({
            address: DAILY_APP_ADDRESS,
            abi: DAILY_APP_ABI,
            functionName: 'createDailyTask',
            args: [dailyDesc, BigInt(dailyPoints)],
        });
    };

    const handleCreateSponsor = () => {
        if (!sponsorName || sponsorTasks.some(t => !t.desc || !t.points)) {
            return toast.error("Fill all fields");
        }
        writeContract({
            address: DAILY_APP_ADDRESS,
            abi: DAILY_APP_ABI,
            functionName: 'createSponsorship',
            args: [
                sponsorName,
                sponsorTasks.map(t => t.desc),
                sponsorTasks.map(t => BigInt(t.points))
            ],
        });
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

    const isLoading = isPending || isWaiting;

    return (
        <div className="space-y-6" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>
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
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">XP Reward</label>
                        <input
                            type="number"
                            placeholder="100"
                            value={dailyPoints}
                            onChange={(e) => setDailyPoints(e.target.value)}
                            className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors font-mono"
                        />
                    </div>

                    <button
                        onClick={handleCreateDaily}
                        disabled={isLoading}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deploy Daily Task"}
                    </button>
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

                    <button
                        onClick={handleCreateSponsor}
                        disabled={isLoading}
                        className="w-full py-4 bg-white hover:bg-slate-100 disabled:bg-slate-800 text-black disabled:text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deploy Sponsor Card"}
                    </button>
                </div>
            )}

            {/* List View */}
            {mode === 'view' && (
                <TaskViewer address={DAILY_APP_ADDRESS} abi={DAILY_APP_ABI} />
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

import { useReadContract } from 'wagmi';
