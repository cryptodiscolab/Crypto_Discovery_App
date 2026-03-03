import React, { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSignMessage, useReadContract } from 'wagmi';
import {
    Transaction,
    TransactionButton,
    TransactionStatus,
    TransactionStatusLabel,
    TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';
import { encodeFunctionData, formatUnits, parseUnits } from 'viem';
import {
    Plus, Zap, Calendar, Loader2, CheckCircle2, AlertCircle, X,
    Star, Database, Download, RefreshCw, Settings, TrendingUp, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { DAILY_APP_ABI, CONTRACTS } from '../../lib/contracts';

const DAILY_APP_ADDRESS = CONTRACTS.DAILY_APP;

/**
 * TaskViewer sub-component to show existing data
 */
function TaskViewer({ address, abi }) {
    const { data: nextTaskId } = useReadContract({ address, abi, functionName: 'nextTaskId' });
    const { data: nextSponsorId } = useReadContract({ address, abi, functionName: 'totalSponsorRequests' });

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 px-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">On-Chain Registry</span>
            </div>

            {/* Live Tasks */}
            <div className="space-y-2">
                <h4 className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Live Tasks ({Number(nextTaskId || 0)})</h4>
                <div className="grid grid-cols-1 gap-2">
                    {Array.from({ length: Number(nextTaskId || 1) - 1 }).map((_, i) => (
                        <TaskItem key={i + 1} id={BigInt(i + 1)} address={address} abi={abi} />
                    ))}
                    {Number(nextTaskId || 1) <= 1 && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[9px] text-slate-500 italic text-center">No tasks deployed on-chain</div>
                    )}
                </div>
            </div>

            {/* Sponsorships */}
            <div className="space-y-2">
                <h4 className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Sponsorship Requests ({Number(nextSponsorId || 0)})</h4>
                <div className="grid grid-cols-1 gap-3">
                    {Array.from({ length: Number(nextSponsorId || 0) }).map((_, i) => (
                        <SponsorRequestItem key={i + 1} id={BigInt(i + 1)} address={address} abi={abi} />
                    ))}
                    {Number(nextSponsorId || 0) === 0 && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[9px] text-slate-500 italic text-center">No sponsorships requested</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TaskItem({ id, address, abi }) {
    const { data: task } = useReadContract({ address, abi, functionName: 'tasks', args: [id] });
    if (!task || task[0] === 0n) return null;
    return (
        <div className="flex items-center justify-between p-3 bg-[#0a0a0c] border border-white/5 rounded-xl">
            <div className="flex flex-col">
                <span className="text-[10px] text-white font-bold">{task[4]}</span>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] text-slate-500 uppercase tracking-tighter">ID: {id.toString()}</span>
                    {task[1] ? (
                        <span className="text-[7px] px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded-full font-black uppercase">Active</span>
                    ) : (
                        <span className="text-[7px] px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded-full font-black uppercase">Paused</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                <Star className="w-2.5 h-2.5 text-indigo-400" />
                <span className="text-[10px] font-mono text-indigo-400 font-black">{task[0].toString()} XP</span>
            </div>
        </div>
    );
}

function SponsorRequestItem({ id, address, abi }) {
    const { data: req } = useReadContract({ address, abi, functionName: 'sponsorRequests', args: [id] });
    if (!req || req[0] === '0x0000000000000000000000000000000000000000') return null;

    const statusMap = ["PENDING", "APPROVED", "REJECTED"];
    const status = statusMap[req[8]];

    return (
        <div className="p-4 bg-[#0a0a0c] border border-white/5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{req[2]}</span>
                </div>
                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' : status === 'APPROVED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {status}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="flex flex-col">
                    <span className="text-slate-600 uppercase font-black tracking-widest">Sponsor</span>
                    <span className="text-white truncate font-mono">{req[0]}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-600 uppercase font-black tracking-widest">Pool Size</span>
                    <span className="text-indigo-400 font-black">{formatUnits(req[5], 18)} Tokens</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-600 uppercase font-black tracking-widest">Target Claims</span>
                    <span className="text-white font-black">{req[7].toString()} Users</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-600 uppercase font-black tracking-widest">Value/User</span>
                    <span className="text-green-500 font-black">${formatUnits(req[6], 18)} USD</span>
                </div>
            </div>
        </div>
    );
}

export function TaskManager() {
    const [mode, setMode] = useState('daily'); // 'daily' | 'sponsor' | 'config' | 'view'

    // Daily Task State (Admin)
    const [dailyDesc, setDailyDesc] = useState('');
    const [dailyPoints, setDailyPoints] = useState('');
    const [dailyCooldown, setDailyCooldown] = useState('24h');
    const [dailyRequiresVerify, setDailyRequiresVerify] = useState(false);
    const [dailyMinTier, setDailyMinTier] = useState(0);

    // Sponsor State (User/Sponsor)
    const [sponsorTitle, setSponsorTitle] = useState('');
    const [sponsorLink, setSponsorLink] = useState('');
    const [sponsorEmail, setSponsorEmail] = useState('');
    const [sponsorRewardPerUser, setSponsorRewardPerUser] = useState('0.10');
    const [sponsorTotalClaims, setSponsorTotalClaims] = useState('50');

    // Config State (Admin)
    const [configPlatformFee, setConfigPlatformFee] = useState('');
    const [configMinPool, setConfigMinPool] = useState('');
    const [configMinReward, setConfigMinReward] = useState('');

    // Metadata States
    const [pointSettings, setPointSettings] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [isFetching, setIsFetching] = useState(false);

    // Wagmi hooks
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
    const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash });

    // ON-CHAIN DATA (Economical Balance)
    const { data: platformFee } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: minPoolUSD } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'minRewardPoolUSD' });
    const { data: minRewardUSD } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'minRewardPerUserUSD' });
    const { data: tokenPrice } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'tokenPriceUSD' });

    // CALCULATIONS
    const totalPoolUSD = Number(sponsorRewardPerUser || 0) * Number(sponsorTotalClaims || 0);
    const requiredTokens = tokenPrice && tokenPrice > 0n
        ? (parseUnits(totalPoolUSD.toString(), 18) * parseUnits('1', 18)) / tokenPrice
        : 0n;

    const fetchAdminTasks = async () => {
        setIsFetching(true);
        try {
            const { data } = await supabase.from('daily_tasks').select('*').order('created_at', { ascending: false });
            setTasks(data || []);
            const { data: points } = await supabase.from('point_settings').select('*').eq('is_active', true);
            setPointSettings(points || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        fetchAdminTasks();
    }, []);

    const handleTxSuccess = () => {
        toast.success('Transaction Successful!');
        setDailyDesc('');
        setSponsorTitle('');
        fetchAdminTasks();
    };

    const buildAdminTaskCall = () => {
        const cooldownValue = dailyCooldown === '24h' ? 86400 : dailyCooldown === '1h' ? 3600 : 43200;
        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI,
                functionName: 'addTask',
                args: [
                    BigInt(dailyPoints || 0),
                    BigInt(cooldownValue),
                    dailyMinTier,
                    dailyDesc,
                    '',
                    dailyRequiresVerify
                ],
            }),
        }];
    };

    const buildSponsorCall = () => {
        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI,
                functionName: 'buySponsorshipWithToken',
                args: [
                    0, // BRONZE
                    sponsorTitle,
                    sponsorLink,
                    sponsorEmail,
                    parseUnits(sponsorRewardPerUser, 18),
                    BigInt(sponsorTotalClaims)
                ],
            }),
        }];
    };

    const buildConfigCall = () => {
        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI,
                functionName: 'setSponsorshipParams',
                args: [
                    parseUnits(configPlatformFee, 6),
                    parseUnits(configMinPool, 18),
                    parseUnits(configMinReward, 18)
                ],
            }),
        }];
    };

    return (
        <div className="space-y-6" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>

            {/* Economic Monitor */}
            <div className="bg-[#121214] p-4 rounded-xl border border-indigo-500/20 flex flex-wrap gap-4 items-center justify-between group overflow-hidden relative">
                <div className="absolute inset-0 bg-green-500/[0.02] -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">Economic Ecosystem Health</span>
                </div>
                <div className="flex gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] text-slate-500 uppercase font-black tracking-widest">Platform Fee</span>
                        <span className="text-[10px] text-white font-black font-mono">{platformFee ? formatUnits(platformFee, 6) : '0.00'} USDC</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] text-slate-500 uppercase font-black tracking-widest">Min Reward Pool</span>
                        <span className="text-[10px] text-indigo-400 font-black font-mono">${minPoolUSD ? formatUnits(minPoolUSD, 18) : '0.00'} USD</span>
                    </div>
                </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex gap-2 p-1 bg-[#121214] border border-white/5 rounded-xl">
                {['daily', 'sponsor', 'config', 'view'].map(m => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-[#0a0a0c] text-indigo-400 border border-white/5 shadow-inner' : 'text-slate-600'}`}
                    >
                        {m === 'daily' ? 'Set Daily' : m === 'sponsor' ? 'Sponsor Portal' : m === 'config' ? 'Econ-Config' : 'Analytics'}
                    </button>
                ))}
            </div>

            {/* FORM: INTERNAL DAILY TASK */}
            {mode === 'daily' && (
                <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Administrative Task Forge
                    </h3>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Activity Template (From DB)</label>
                            <select
                                onChange={(e) => {
                                    const s = pointSettings.find(x => x.activity_key === e.target.value);
                                    if (s) { setDailyPoints(s.points_value); setDailyDesc(s.activity_key.replace(/_/g, ' ').toUpperCase()); }
                                }}
                                className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors"
                            >
                                <option value="">-- Manual Configuration --</option>
                                {pointSettings.map(s => <option key={s.id} value={s.activity_key}>{s.activity_key} (+{s.points_value} XP)</option>)}
                            </select>
                        </div>
                        <input
                            placeholder="Detailed Description"
                            value={dailyDesc}
                            onChange={e => setDailyDesc(e.target.value)}
                            className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[7px] font-black text-slate-700 uppercase px-1">XP Points</label>
                                <input
                                    type="number"
                                    placeholder="100"
                                    value={dailyPoints}
                                    onChange={e => setDailyPoints(e.target.value)}
                                    className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-indigo-400 font-black outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[7px] font-black text-slate-700 uppercase px-1">Cooldown</label>
                                <select
                                    value={dailyCooldown}
                                    onChange={e => setDailyCooldown(e.target.value)}
                                    className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none"
                                >
                                    <option value="1h">1 Hour (Flash)</option>
                                    <option value="12h">12 Hours</option>
                                    <option value="24h">24 Hours (Daily)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 px-2 bg-[#0a0a0c] py-3 rounded-xl border border-white/5">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={dailyRequiresVerify} onChange={e => setDailyRequiresVerify(e.target.checked)} className="rounded border-white/5 bg-slate-900 text-indigo-600" />
                                <span className="text-[9px] font-black text-slate-500 uppercase group-hover:text-white transition-colors">Requires Human Verification</span>
                            </label>
                            <div className="h-4 w-px bg-white/5" />
                            <select value={dailyMinTier} onChange={e => setDailyMinTier(Number(e.target.value))} className="bg-transparent text-[9px] font-black text-indigo-500 uppercase outline-none">
                                <option value={0}>Min Tier: ALL</option>
                                <option value={1}>Tier: Bronze</option>
                                <option value={2}>Tier: Silver+</option>
                            </select>
                        </div>
                    </div>
                    <Transaction calls={buildAdminTaskCall()} onSuccess={handleTxSuccess}>
                        <TransactionButton className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20" text="DEPLOY SYSTEM TASK" />
                    </Transaction>
                </div>
            )}

            {/* FORM: SPONSOR PORTAL */}
            {mode === 'sponsor' && (
                <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-yellow-500" /> Sponsor-Grade Engagement
                    </h3>
                    <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-3 h-3 text-indigo-400" />
                            <span className="text-[9px] font-black text-indigo-400 uppercase">Dynamic Profit & Loss Control</span>
                        </div>
                        <p className="text-[8px] text-slate-500 font-bold leading-relaxed">
                            Listing Fee: <span className="text-white">${formatUnits(platformFee || 1000000n, 6)} USDC</span>.
                            Min Reward $ / User: <span className="text-green-500">${formatUnits(minRewardUSD || 10000000000000000n, 18)}</span>.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                            <input placeholder="App/Community Name" value={sponsorTitle} onChange={e => setSponsorTitle(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50" />
                            <input placeholder="Destination URL (Farcaster/X/App)" value={sponsorLink} onChange={e => setSponsorLink(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50" />
                            <input placeholder="Contact Email (Verification Only)" value={sponsorEmail} onChange={e => setSponsorEmail(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[7px] font-black text-slate-700 uppercase px-1">Total Reward Slots</label>
                                <input type="number" value={sponsorTotalClaims} onChange={e => setSponsorTotalClaims(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white font-black outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[7px] font-black text-slate-700 uppercase px-1">USD Value Per User</label>
                                <input type="number" step="0.01" value={sponsorRewardPerUser} onChange={e => setSponsorRewardPerUser(e.target.value)} className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-green-500 font-black outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-[#0a0a0c] rounded-xl border-2 border-indigo-500/30 flex justify-between items-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex flex-col relative z-10">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Aggregate Reward Pool</span>
                            <span className="text-xl font-black text-white">${totalPoolUSD.toFixed(2)} USD</span>
                        </div>
                        <div className="flex flex-col items-end relative z-10">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Token Requirement</span>
                            <span className="text-[11px] font-black text-indigo-400 font-mono">{formatUnits(requiredTokens, 18)} $DISCO</span>
                        </div>
                    </div>

                    <Transaction calls={buildSponsorCall()} onSuccess={handleTxSuccess}>
                        <TransactionButton
                            disabled={totalPoolUSD < Number(formatUnits(minPoolUSD || 0n, 18))}
                            className="w-full py-4 bg-white hover:bg-slate-100 text-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl disabled:opacity-30 disabled:grayscale"
                            text={totalPoolUSD < Number(formatUnits(minPoolUSD || 0n, 18)) ? `MIN POOL $${formatUnits(minPoolUSD || 5000000000000000000n, 18)} REQUIRED` : `REQUEST SPONSORSHIP ($${totalPoolUSD.toFixed(2)})`}
                        />
                    </Transaction>
                </div>
            )}

            {/* FORM: ADMIN ECON-CONFIG */}
            {mode === 'config' && (
                <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-green-500" /> Economic Command Center
                    </h3>
                    <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl mb-2">
                        <p className="text-[8px] text-red-400 font-black uppercase leading-relaxed">
                            Warning: Adjusting these parameters immediately affects all new sponsorship requests and operational profit margins.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Sponsorship Listing Fee (USDC)</label>
                            <input value={configPlatformFee} onChange={e => setConfigPlatformFee(e.target.value)} placeholder="e.g. 1.00" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-500/30 transition-colors" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Minimum Aggregate Pool (USD)</label>
                            <input value={configMinPool} onChange={e => setConfigMinPool(e.target.value)} placeholder="e.g. 5.00" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-500/30 transition-colors" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Minimum Reward Per User (USD)</label>
                            <input value={configMinReward} onChange={e => setConfigMinReward(e.target.value)} placeholder="e.g. 0.01" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-500/30 transition-colors" />
                        </div>
                    </div>
                    <Transaction calls={buildConfigCall()} onSuccess={handleTxSuccess}>
                        <TransactionButton className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20" text="UPDATE PROTOCOL ECONOMICS" />
                    </Transaction>
                </div>
            )}

            {/* VIEW: LIVE ANALYTICS */}
            {mode === 'view' && <TaskViewer address={DAILY_APP_ADDRESS} abi={DAILY_APP_ABI} />}

            {/* STATUS FEEDBACK PIPELINE */}
            {writeError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-[9px] font-black text-red-500 uppercase">{writeError.shortMessage || "Critical Transaction Error"}</p>
                </div>
            )}
            {hash && !isSuccess && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Committing to Blockchain...</p>
                        <span className="text-[7px] text-slate-500 font-mono truncate block max-w-[200px]">{hash}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
