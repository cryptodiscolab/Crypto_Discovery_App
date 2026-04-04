import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { MASTER_X_ABI, DAILY_APP_ABI, CONTRACTS } from '../lib/contracts';
import { Trophy, Star, Zap, ShieldCheck, ShieldAlert, Check, Calendar, ChevronRight } from 'lucide-react';
import { useSocialGuard } from '../hooks/useSocialGuard';
import { useVerification } from '../hooks/useVerification';
import { useTaskInfo } from '../hooks/useTaskInfo';
import { useUserV12Stats } from '../hooks/useContract';
import { encodeFunctionData } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { useCMS } from '../hooks/useCMS';
import { GovernancePanel } from './GovernancePanel';
import { calculateMultipliers, estimateXP } from '../lib/economy';
import { useUserInfo, useV12Stats } from '../hooks/useContract';
import { supabase } from '@/lib/supabaseClient';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function UnifiedDashboard() {
    const { address, isConnected } = useAccount();
    const [mounted, setMounted] = useState(false);
    const queryClient = useQueryClient();
    const { refetch: refetchStats, stats: userStats } = useUserV12Stats(address);
    const { totalUsers } = useV12Stats();
    const { isAdmin } = useCMS();
    const [isBaseVerified, setIsBaseVerified] = useState(false);

    useEffect(() => {
        if (!address) return;
        const fetchBaseStatus = async () => {
            const { data } = await supabase
                .from('user_profiles')
                .select('is_base_social_verified')
                .eq('wallet_address', address.toLowerCase())
                .maybeSingle();
            if (data) setIsBaseVerified(!!data.is_base_social_verified);
        };
        fetchBaseStatus();
    }, [address]);

    const multis = calculateMultipliers(userStats, totalUsers);

    useEffect(() => { setMounted(true); }, []);

    const { data: fcUser } = useSocialGuard(address);

    const { data: userData } = useReadContract({
        address: CONTRACTS.MASTER_X,
        abi: MASTER_X_ABI,
        functionName: 'users',
        args: [address],
        query: { enabled: !!address },
    });

    const { data: dailyTaskIds } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'getDailyTasks',
    });

    const { data: nextSponsorId } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'nextSponsorId',
    });

    const sponsorshipIds = [];
    if (nextSponsorId) {
        const maxSponsors = 8;
        const total = Number(nextSponsorId);
        const start = Math.max(1, total - maxSponsors);

        for (let i = start; i < total; i++) {
            sponsorshipIds.push(i);
        }
        sponsorshipIds.reverse();
    }

    const { data: unsyncedPointsRaw } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'unsyncedPoints',
        args: [address],
        query: { enabled: !!address },
    });

    const userPoints = userData ? Number(userData[0]) : 0;
    const unsyncedPoints = unsyncedPointsRaw ? Number(unsyncedPointsRaw) : 0;

    const handleTransactionSuccess = useCallback(async (txHash) => {
        // BUG-SYNC fix: Trigger backend XP sync immediately after transaction confirmation
        if (address) {
            try {
                console.log('[Dashboard Sync] Triggering XP sync for tx:', txHash);
                // Call /api/user/xp — Vercel routes this to user-bundle?action=xp
                fetch('/api/user/xp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        wallet_address: address,
                        tx_hash: txHash 
                    }),
                }).then(async (res) => {
                    if (!res.ok) {
                        const err = await res.json();
                        console.warn('[Dashboard Sync] XP sync failed:', err.error);
                    } else {
                        console.log('[Dashboard Sync] XP synced to DB');
                    }
                    // Refetch local stats after backend updates
                    if (refetchStats) refetchStats();
                    queryClient.invalidateQueries({ queryKey: ['readContract'] });
                }).catch((e) => {
                    console.warn('[Dashboard Sync] Network error during XP sync:', e);
                });
            } catch (e) {
                console.warn('[Dashboard Sync] Failed to trigger backend sync:', e);
            }
        }
    }, [address, queryClient, refetchStats]);

    if (!mounted || !isConnected) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 mb-12">
            
            {/* Admin Governance Panel (v3.20.0) */}
            {isAdmin && <GovernancePanel />}

            {/* Social Verification Guard */}
            <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${fcUser
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-amber-500/10 text-amber-400'
                }`}>
                {fcUser ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <ShieldAlert className="w-5 h-5 shrink-0 animate-pulse" />}
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest">{fcUser ? 'IDENTITY VERIFIED' : 'IDENTITY REQUIRED'}</p>
                    <p className="text-[11px] font-black uppercase tracking-widest opacity-70 leading-none mt-1">
                        {fcUser ? `LINKED TO @${fcUser.username.toUpperCase()}` : 'CONNECT FARCASTER TO UNLOCK GASLESS REWARDS'}
                    </p>
                </div>
                {!fcUser && (
                    <a href="https://warpcast.com" target="_blank" rel="noreferrer" className="text-[11px] font-black uppercase tracking-widest text-amber-400 underline underline-offset-2 shrink-0">
                        LINK
                    </a>
                )}
            </div>

            {/* v3.41.2: Nexus Economy Underdog Badge */}
            {multis.isUnderdogActive && (
                <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl animate-scale-in">
                    <div className="p-1.5 bg-indigo-500 rounded-lg animate-pulse-zap">
                        <Zap className="w-3 h-3 text-white fill-current" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-indigo-400">CATCH-UP ACTIVE</p>
                        <p className="text-[10px] font-bold uppercase tracking-tight text-indigo-400/60 leading-none mt-0.5">
                            YOUR REWARDS ARE BOOSTED BY +10%
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daily Admin Tasks */}
                <div className="space-y-4">
                    <div className="space-y-3">
                        {dailyTaskIds?.map((tid) => (
                            <DailyTaskItem
                                key={Number(tid)}
                                taskId={Number(tid)}
                                isDisabled={!fcUser || isBaseVerified === false}
                                isBaseVerified={isBaseVerified}
                                address={address}
                                onSucceed={handleTransactionSuccess}
                                multipliers={multis}
                            />
                        ))}
                    </div>
                </div>

                {/* Sponsorship Missions */}
                <div className="space-y-4">
                    <div className="space-y-4">
                        {sponsorshipIds.map((sid) => (
                            <SponsorCard
                                key={Number(sid)}
                                sponsorId={Number(sid)}
                                isDisabled={!fcUser || isBaseVerified === false}
                                isBaseVerified={isBaseVerified}
                                address={address}
                                onSuccess={handleTransactionSuccess}
                                multipliers={multis}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DailyTaskItem({ taskId, isDisabled, isBaseVerified, address, onSucceed, multipliers }) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { verifyTask, isVerifying, registerTaskStart } = useVerification(onSucceed);

    const { data: isCompleted, refetch: refetchCompletion } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasDoneTask',
        args: [address, BigInt(taskId)],
    });

    const { data: isVerified } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'isTaskVerified',
        args: [address, BigInt(taskId)],
    });

    if (isLoading || !task) return null;

    // Hardening v3.41.2: Check Base Social Requirement
    const isBaseLocked = task.isBaseSocialRequired && !isBaseVerified;
    const finalDisabled = isDisabled || isBaseLocked;

    const needsVerify = task.requiresVerification && !isVerified;

    const calls = [{
        to: CONTRACTS.DAILY_APP,
        data: encodeFunctionData({
            abi: DAILY_APP_ABI,
            functionName: 'doTask',
            args: [BigInt(taskId), ZERO_ADDRESS],
        }),
    }];

    const handleVerifyOrClaim = async () => {
        if (needsVerify) {
            registerTaskStart(taskId);
            window.open(task.link, '_blank');
            const success = await verifyTask(task, address, taskId);
            if (success) {
                refetchCompletion();
            }
        }
    };

    return (
        <div className={`glass-card p-4 flex justify-between items-center transition-colors ${isCompleted ? 'opacity-40' : 'hover:bg-zinc-800/60'}`}>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-400">
                    <Zap className="w-3 h-3 fill-current" />
                </div>
                <div>
                    <p className={`text-[11px] font-black uppercase tracking-widest leading-tight ${isCompleted ? 'line-through text-slate-500' : 'text-white'}`}>{task.title.toUpperCase()}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">
                            +{estimateXP(task.baseReward, multipliers)} XP
                        </p>
                        {multipliers.total !== 1.0 && (
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight line-through opacity-50">
                                {task.baseReward} XP
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {!isCompleted && (
                <div className="flex gap-2 relative z-[9999] pointer-events-auto">
                    {needsVerify ? (
                        <button
                            onClick={handleVerifyOrClaim}
                            disabled={isVerifying || finalDisabled}
                            className={`btn-primary py-1.5 px-3 text-[11px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 ${isVerifying || finalDisabled ? 'opacity-50' : ''}`}
                        >
                            {isVerifying ? 'VERIFYING...' : isBaseLocked ? 'BASE REQ' : 'VERIFY'}
                        </button>
                    ) : (
                        <ClaimButton 
                            taskId={taskId} 
                            isDisabled={finalDisabled} 
                            onSuccess={(hash) => {
                                onSucceed(hash);
                                refetchCompletion();
                            }} 
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function ClaimButton({ taskId, isDisabled, onSuccess }) {
    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        if (isSuccess && hash) {
            onSuccess(hash);
        }
    }, [isSuccess, hash, onSuccess]);

    const handleClaim = () => {
        writeContract({
            address: CONTRACTS.DAILY_APP,
            abi: DAILY_APP_ABI,
            functionName: 'doTask',
            args: [BigInt(taskId), ZERO_ADDRESS],
        });
    };

    return (
        <button
            onClick={handleClaim}
            disabled={isPending || isConfirming || isDisabled}
            className={`btn-primary py-1.5 px-3 text-[11px] font-black uppercase tracking-widest ${isDisabled || isPending || isConfirming ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {isPending ? 'SIGNING...' : isConfirming ? 'WAIT...' : isDisabled ? 'LOCKED' : 'CLAIM'}
        </button>
    );
}

function SponsorCard({ sponsorId, isDisabled, isBaseVerified, address, onSuccess, multipliers }) {
const [selectedTasks, setSelectedTasks] = useState([]);

    const { data: sponsorData } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'sponsorships',
        args: [BigInt(sponsorId)],
    });

    const { data: taskIds } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'getSponsorTasks',
        args: [BigInt(sponsorId)],
    });

    const toggleTask = (taskId, isCompleted) => {
        if (isCompleted) return;
        setSelectedTasks((prev) =>
            prev.includes(taskId) ? prev.filter((t) => t !== taskId) : [...prev, taskId]
        );
    };

    if (!sponsorData || !taskIds) return null;

    const sponsorName = sponsorData[0];
    const cardsDisabled = isDisabled || selectedTasks.length === 0;

    const calls = selectedTasks.length > 0
        ? [{
            to: CONTRACTS.DAILY_APP,
            data: encodeFunctionData({
                abi: DAILY_APP_ABI,
                functionName: 'doBatchTasks',
                args: [selectedTasks.map((t) => BigInt(t))],
            }),
        }]
        : [];

    const handleBatchSuccess = (tx) => {
        setSelectedTasks([]);
        onSuccess(tx.transactionHash);
    };

    return (
        <div className={`glass-card p-5 relative overflow-hidden transition-colors ${isDisabled ? 'opacity-50' : 'hover:bg-zinc-800/60'}`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <span className="text-[11px] font-black uppercase text-indigo-500 tracking-widest block mb-1">PARTNER MISSION</span>
                    <h4 className="font-black text-lg uppercase tracking-tighter text-white">{sponsorName.toUpperCase()}</h4>
                </div>
                <Zap className="w-4 h-4 text-indigo-500 fill-indigo-500/20" />
            </div>

            <div className="space-y-2 mb-6">
                {taskIds.map((tid) => (
                    <SubTaskItem
                        key={Number(tid)}
                        taskId={Number(tid)}
                        isSelected={selectedTasks.includes(Number(tid))}
                        onToggle={(id, comp) => toggleTask(id, comp)}
                        address={address}
                        isBaseVerified={isBaseVerified}
                        multipliers={multipliers}
                    />
            ))}
            </div>

            <div className="relative z-[9999] pointer-events-auto">
                <BatchClaimButton 
                    selectedTasks={selectedTasks} 
                    isDisabled={cardsDisabled} 
                    onSuccess={(hash) => {
                        setSelectedTasks([]);
                        onSuccess(hash);
                    }} 
                />
            </div>
        </div>
    );
}

function BatchClaimButton({ selectedTasks, isDisabled, onSuccess }) {
    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        if (isSuccess && hash) {
            onSuccess(hash);
        }
    }, [isSuccess, hash, onSuccess]);

    const handleBatchClaim = () => {
        if (selectedTasks.length === 0) return;
        writeContract({
            address: CONTRACTS.DAILY_APP,
            abi: DAILY_APP_ABI,
            functionName: 'doBatchTasks',
            args: [selectedTasks.map((t) => BigInt(t))],
        });
    };

    return (
        <button
            onClick={handleBatchClaim}
            disabled={isPending || isConfirming || isDisabled}
            className={`w-full btn-primary py-3 text-[11px] font-black uppercase tracking-widest ${isDisabled || isPending || isConfirming ? 'opacity-50 grayscale' : ''}`}
        >
            {isPending ? 'SIGNING...' : isConfirming ? 'CONFIRMING...' : isDisabled ? 'SELECT MISSIONS' : `VERIFY ${selectedTasks.length} MISSIONS`}
        </button>
    );
}

function SubTaskItem({ taskId, isBaseVerified, isSelected, onToggle, address, multipliers }) {
const { task, isLoading } = useTaskInfo(taskId);
    const { verifyTask, isVerifying } = useVerification();

    const { data: isCompleted, refetch: refetchCompletion } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasDoneTask',
        args: [address, BigInt(taskId)],
    });

    const { data: isVerified, refetch: refetchVerification } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'isTaskVerified',
        args: [address, BigInt(taskId)],
    });

    if (isLoading || !task) return null;

    const isBaseLocked = task.isBaseSocialRequired && !isBaseVerified;

    const handleAction = async (e) => {
        e.stopPropagation();
        if (isBaseLocked) {
            toast.error("Base.app Social Link required for this mission!");
            return;
        }
        if (needsVerify) {
        window.open(task.link, '_blank');
            const success = await verifyTask(task, address, taskId);
            if (success) {
                refetchVerification();
                refetchCompletion();
            }
        } else {
            onToggle(taskId, !!isCompleted);
        }
    };

    return (
        <div
            onClick={handleAction}
            className={`flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer select-none ${isCompleted
                    ? 'bg-zinc-800/50 opacity-60'
                    : isBaseLocked
                        ? 'bg-amber-500/5 border border-amber-500/20 opacity-50 grayscale'
                        : isSelected
                            ? 'bg-indigo-600'
                            : 'bg-zinc-800 hover:bg-zinc-700/80'
                }`}
        >
        <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${isCompleted
                    ? 'bg-emerald-500 border-emerald-500'
                    : isBaseLocked
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : isSelected
                            ? 'bg-white border-white'
                            : 'border-white/10 bg-slate-900'
                    }`}>
                    {isBaseLocked ? (
                        <ShieldAlert className="w-3 h-3 text-amber-500" />
                    ) : (isCompleted || isSelected) && (
                        <Check
                            className={`w-4 h-4 ${isCompleted ? 'text-white' : 'text-indigo-500'}`}
                            strokeWidth={4}
                        />
                    )}
                </div>
            <div>
                    <div className="flex items-center gap-2">
                        <p className={`text-[11px] font-black uppercase tracking-widest leading-tight ${isCompleted ? 'line-through text-slate-500'
                            : isSelected ? 'text-white'
                                : 'text-slate-300'
                            }`}>{task.title.toUpperCase()}</p>
                        {task.requiresVerification && (
                            <ShieldCheck className={`w-3 h-3 ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`} />
                        )}
                    </div>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-indigo-400'}`}>
                            +{estimateXP(task.baseReward, multipliers)} XP
                        </p>
                    </div>
                </div>

            <div className="flex items-center gap-2">
                {needsVerify ? (
                    <button
                        disabled={isVerifying}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest py-1.5 px-3 rounded-lg transition-all"
                    >
                        {isVerifying ? 'WAIT...' : 'VERIFY'}
                    </button>
                ) : isCompleted ? (
                    <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                        DONE
                    </span>
                ) : null}
            </div>
        </div>
    );
}
