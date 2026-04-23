import React, { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract, useSignMessage } from 'wagmi';
import { encodeFunctionData, formatUnits, parseUnits } from 'viem';
import {
    Plus, Zap, Calendar, Loader2, CheckCircle2, AlertCircle,
    Star, Database, RefreshCw, Settings, TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { DAILY_APP_ABI, CONTRACTS } from '../../lib/contracts';

// Sub-sections
import { QuickTaskForgeSection } from './tasks/QuickTaskForgeSection';
import { QuickSponsorPortalSection } from './tasks/QuickSponsorPortalSection';
import { QuickEconConfigSection } from './tasks/QuickEconConfigSection';

const DAILY_APP_ADDRESS = CONTRACTS.DAILY_APP;

function TaskViewer({ address, abi }) {
    const { data: nextTaskId } = useReadContract({ address, abi, functionName: 'nextTaskId' });
    const { data: nextSponsorId } = useReadContract({ address, abi, functionName: 'totalSponsorRequests' });

    return (
        <div className="space-y-4 text-left">
            <div className="flex items-center gap-2 mb-2 px-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">On-Chain Registry</span>
            </div>
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
            <div className="flex flex-col text-left">
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
        <div className="p-4 bg-[#0a0a0c] border border-white/5 rounded-xl space-y-3 text-left">
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
                    <span className="text-slate-600 uppercase font-black tracking-widest text-left">Sponsor</span>
                    <span className="text-white truncate font-mono">{req[0]}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-600 uppercase font-black tracking-widest text-left">Pool Size</span>
                    <span className="text-indigo-400 font-black">{formatUnits(req[5], 18)} Tokens</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-600 uppercase font-black tracking-widest text-left">Target Claims</span>
                    <span className="text-white font-black">{req[7].toString()} Users</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-600 uppercase font-black tracking-widest text-left">Value/User</span>
                    <span className="text-green-500 font-black">${formatUnits(req[6], 18)} USD</span>
                </div>
            </div>
        </div>
    );
}

export function TaskManager() {
    const [mode, setMode] = useState('daily');
    const [dailyDesc, setDailyDesc] = useState('');
    const [dailyPoints, setDailyPoints] = useState('');
    const [dailyCooldown, setDailyCooldown] = useState('24h');
    const [dailyRequiresVerify, setDailyRequiresVerify] = useState(false);
    const [dailyIsBaseSocialRequired, setDailyIsBaseSocialRequired] = useState(false);
    const [dailyMinTier, setDailyMinTier] = useState(0);

    const [sponsorTitle, setSponsorTitle] = useState('');
    const [sponsorLink, setSponsorLink] = useState('');
    const [sponsorEmail, setSponsorEmail] = useState('');
    const [sponsorRewardPerUser, setSponsorRewardPerUser] = useState('0.10');
    const [sponsorTotalClaims, setSponsorTotalClaims] = useState('50');
    const [sponsorIsBaseSocialRequired, setSponsorIsBaseSocialRequired] = useState(false);

    const [configPlatformFee, setConfigPlatformFee] = useState('');
    const [configMinPool, setConfigMinPool] = useState('');
    const [configMinReward, setConfigMinReward] = useState('');

    const [pointSettings, setPointSettings] = useState([]);
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { data: hash, error: writeError } = useWriteContract();
    const { data: receipt, isLoading: isWaiting, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

    const { data: platformFee } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: minPoolUSD } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'minRewardPoolValue' });
    const { data: minRewardUSD } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'rewardPerClaim' });
    const { data: tokenPrice } = useReadContract({ address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'tokenPriceUSD' });

    const totalPoolUSD = Number(sponsorRewardPerUser || 0) * Number(sponsorTotalClaims || 0);
    const requiredTokens = tokenPrice && tokenPrice > 0n ? (parseUnits(totalPoolUSD.toString(), 18) * parseUnits('1', 18)) / tokenPrice : 0n;

    useEffect(() => {
        const fetchInitial = async () => {
            const { data } = await supabase.from('point_settings').select('*').eq('is_active', true);
            setPointSettings(data || []);
        };
        fetchInitial();
    }, []);

    const handleTxSuccess = () => {
        toast.success('Transaction Confirmed! Syncing with system...');
    };

    useEffect(() => {
        const syncQuickAction = async () => {
            if (isTxSuccess && receipt) {
                const tid = toast.loading("Syncing Backend Gating...");
                try {
                    const timestamp = new Date().toISOString();
                    const message = `Sync Quick Admin Action\nTX: ${receipt.transactionHash}\nAdmin: ${address}\nTime: ${timestamp}`;
                    const signature = await signMessageAsync({ message });

                    if (mode === 'daily') {
                        // Sync single task
                        await fetch('/api/admin/tasks/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                action: 'task-sync',
                                wallet_address: address, signature, message,
                                tasks: [{
                                    platform: 'system',
                                    action_type: 'custom',
                                    title: dailyDesc,
                                    link: '',
                                    is_base_social_required: dailyIsBaseSocialRequired
                                }]
                            })
                        });
                    } else if (mode === 'sponsor') {
                        // Sync sponsorship
                        await fetch('/api/admin/tasks/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                action: 'task-sync',
                                wallet_address: address, signature, message,
                                tasks: [{
                                    platform: 'sponsor',
                                    action_type: 'visit',
                                    title: sponsorTitle,
                                    link: sponsorLink,
                                    is_base_social_required: sponsorIsBaseSocialRequired
                                }]
                            })
                        });
                    }
                    toast.success("Ecosystem Synchronized!", { id: tid });
                    setDailyDesc('');
                    setSponsorTitle('');
                } catch (err) {
                    console.error('[Quick Sync Error]', err);
                    toast.error("Sync Failed - Audit Required", { id: tid });
                }
            }
        };
        syncQuickAction();
    }, [isTxSuccess, receipt]);

    const buildAdminTaskCall = () => {
        const cd = dailyCooldown === '24h' ? 86400 : dailyCooldown === '1h' ? 3600 : 43200;
        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI, functionName: 'addTask',
                args: [BigInt(dailyPoints || 0), BigInt(cd), dailyMinTier, dailyDesc, '', dailyRequiresVerify]
            }),
        }];
    };

    const buildSponsorCall = () => {
        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI, functionName: 'buySponsorshipWithToken',
                args: [0, [sponsorTitle], [sponsorLink], sponsorEmail, parseUnits(sponsorRewardPerUser, 18), CONTRACTS.CREATOR_TOKEN || '0x0000000000000000000000000000000000000000']
            }),
        }];
    };

    const buildConfigCall = () => {
        return [{
            to: DAILY_APP_ADDRESS,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI, functionName: 'setSponsorshipParams',
                // Contract: setSponsorshipParams(rewardPerClaim, tasksRequired, minPool, platformFee)
                args: [parseUnits(configMinReward || '0.01', 18), BigInt(3), parseUnits(configMinPool || '5', 18), parseUnits(configPlatformFee || '1', 6)]
            }),
        }];
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#121214] p-4 rounded-xl border border-indigo-500/20 flex flex-wrap gap-4 items-center justify-between group overflow-hidden relative">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">Economic Ecosystem Health</span>
                </div>
                <div className="flex gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] text-slate-500 uppercase font-black tracking-widest">Platform Fee</span>
                        <span className="text-[10px] text-white font-black font-mono">{platformFee ? formatUnits(platformFee, 6) : '0.00'} USDC</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-[#121214] border border-white/5 rounded-xl">
                {['daily', 'sponsor', 'config', 'view'].map(m => (
                    <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-[#0a0a0c] text-indigo-400 border border-white/5 shadow-inner' : 'text-slate-600'}`}>
                        {m === 'daily' ? 'Set Daily' : m === 'sponsor' ? 'Sponsor Portal' : m === 'config' ? 'Econ-Config' : 'Analytics'}
                    </button>
                ))}
            </div>

            {mode === 'daily' && (
                <QuickTaskForgeSection
                    dailyDesc={dailyDesc} onDailyDescChange={setDailyDesc}
                    dailyPoints={dailyPoints} onDailyPointsChange={setDailyPoints}
                    dailyCooldown={dailyCooldown} onDailyCooldownChange={setDailyCooldown}
                    dailyRequiresVerify={dailyRequiresVerify} onDailyRequiresVerifyChange={setDailyRequiresVerify}
                    dailyIsBaseSocialRequired={dailyIsBaseSocialRequired} onDailyIsBaseSocialRequiredChange={setDailyIsBaseSocialRequired}
                    dailyMinTier={dailyMinTier} onDailyMinTierChange={setDailyMinTier}
                    pointSettings={pointSettings}
                    buildAdminTaskCall={buildAdminTaskCall}
                    handleTxSuccess={handleTxSuccess}
                />
            )}

            {mode === 'sponsor' && (
                <QuickSponsorPortalSection
                    sponsorTitle={sponsorTitle} onSponsorTitleChange={setSponsorTitle}
                    sponsorLink={sponsorLink} onSponsorLinkChange={setSponsorLink}
                    sponsorEmail={sponsorEmail} onSponsorEmailChange={setSponsorEmail}
                    sponsorTotalClaims={sponsorTotalClaims} onSponsorTotalClaimsChange={setSponsorTotalClaims}
                    sponsorRewardPerUser={sponsorRewardPerUser} onSponsorRewardPerUserChange={setSponsorRewardPerUser}
                    sponsorIsBaseSocialRequired={sponsorIsBaseSocialRequired} onSponsorIsBaseSocialRequiredChange={setSponsorIsBaseSocialRequired}
                    platformFee={platformFee}
                    minRewardUSD={minRewardUSD}
                    minPoolUSD={minPoolUSD}
                    totalPoolUSD={totalPoolUSD}
                    requiredTokens={requiredTokens}
                    buildSponsorCall={buildSponsorCall}
                    handleTxSuccess={handleTxSuccess}
                />
            )}

            {mode === 'config' && (
                <QuickEconConfigSection
                    configPlatformFee={configPlatformFee} onConfigPlatformFeeChange={setConfigPlatformFee}
                    configMinPool={configMinPool} onConfigMinPoolChange={setConfigMinPool}
                    configMinReward={configMinReward} onConfigMinRewardChange={setConfigMinReward}
                    buildConfigCall={buildConfigCall}
                    handleTxSuccess={handleTxSuccess}
                />
            )}

            {mode === 'view' && <TaskViewer address={DAILY_APP_ADDRESS} abi={DAILY_APP_ABI} />}

            {(writeError || isWaiting) && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3">
                    {isWaiting ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                    <p className="text-[9px] font-black text-indigo-400 uppercase">
                        {isWaiting ? "Committing to Blockchain..." : (writeError.shortMessage || "Error")}
                    </p>
                </div>
            )}
        </div>
    );
}
