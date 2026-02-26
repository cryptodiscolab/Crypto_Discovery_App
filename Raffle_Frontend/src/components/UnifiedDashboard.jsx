import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import {
    Transaction,
    TransactionButton,
    TransactionStatus,
    TransactionStatusLabel,
    TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';
import { MASTER_X_ABI, DAILY_APP_ABI, CONTRACTS } from '../lib/contracts';
import { Trophy, Star, Zap, ShieldCheck, ShieldAlert, Check, Calendar, ChevronRight } from 'lucide-react';
import { useSocialGuard } from '../hooks/useSocialGuard';
import { useVerification } from '../hooks/useVerification';
import { useTaskInfo } from '../hooks/useTaskInfo';
import { useUserV12Stats } from '../hooks/useContract';
import { encodeFunctionData } from 'viem';
import { useQueryClient } from '@tanstack/react-query';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function UnifiedDashboard() {
    const { address, isConnected } = useAccount();
    const [mounted, setMounted] = useState(false);
    const queryClient = useQueryClient();
    const { refetch: refetchStats } = useUserV12Stats(address);

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

    const handleTransactionSuccess = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['readContract'] });
        if (refetchStats) refetchStats();
    }, [queryClient, refetchStats]);

    if (!mounted || !isConnected) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 mb-12">
            {/* XP Stats Card */}
            <div className="glass-card relative overflow-hidden bg-gradient-to-br from-indigo-600/20 to-violet-700/20 border-indigo-500/30">
                <div className="relative z-10 p-6 flex justify-between items-center">
                    <div>
                        <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Total XP Points</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-black text-white tracking-tighter">
                                {userPoints.toLocaleString()}
                            </h2>
                            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {unsyncedPoints > 0 && (
                            <div className="relative z-[9999] pointer-events-auto">
                                <Transaction
                                    calls={[{
                                        to: CONTRACTS.DAILY_APP,
                                        data: encodeFunctionData({
                                            abi: DAILY_APP_ABI,
                                            functionName: 'syncMasterXPoints',
                                        }),
                                    }]}
                                    onSuccess={handleTransactionSuccess}
                                >
                                    <TransactionButton
                                        className="btn-primary py-2 px-4 text-[10px]"
                                        text={`Sync ${unsyncedPoints} Pts`}
                                    />
                                </Transaction>
                            </div>
                        )}
                        <div className="bg-white/5 backdrop-blur-md p-3 rounded-2xl flex flex-col items-center border border-white/10">
                            <Trophy className="w-5 h-5 text-yellow-400 mb-1" />
                            <span className="text-[9px] uppercase font-black text-white/60 tracking-widest">Master</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Social Verification Guard */}
            <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${fcUser
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                }`}>
                <div className={`p-2 rounded-xl ${fcUser ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                    {fcUser ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.1em]">{fcUser ? 'Identity Verified' : 'Identity Required'}</p>
                    <p className="text-[11px] opacity-70 font-medium">
                        {fcUser ? `Linked to @${fcUser.username}` : 'Connect Farcaster to enable gasless rewards'}
                    </p>
                </div>
                {!fcUser && (
                    <a href="https://warpcast.com" target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase underline tracking-wider">
                        Link Now
                    </a>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daily Admin Tasks */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500" /> Daily Admin Tasks
                    </h3>
                    <div className="space-y-3">
                        {dailyTaskIds?.map((tid) => (
                            <DailyTaskItem
                                key={Number(tid)}
                                taskId={Number(tid)}
                                isDisabled={!fcUser}
                                address={address}
                                onSuccess={handleTransactionSuccess}
                            />
                        ))}
                    </div>
                </div>

                {/* Sponsorship Missions */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Sponsor Missions
                    </h3>
                    <div className="space-y-4">
                        {sponsorshipIds.map((id) => (
                            <SponsorCard
                                key={id}
                                sponsorId={id}
                                isDisabled={!fcUser}
                                address={address}
                                onSuccess={handleTransactionSuccess}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DailyTaskItem({ taskId, isDisabled, address, onSuccess }) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { verifyTask, isVerifying, registerTaskStart } = useVerification(onSuccess);

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
        <div className={`glass-card p-4 flex justify-between items-center transition-all ${isCompleted ? 'opacity-50 grayscale' : 'hover:border-indigo-500/50'}`}>
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCompleted ? 'bg-indigo-500/20 text-indigo-500' : 'bg-indigo-600 text-white'}`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : <Zap className="w-3 h-3 fill-white" />}
                </div>
                <div>
                    <p className={`text-xs font-bold leading-tight ${isCompleted ? 'line-through' : 'text-white'}`}>{task.title}</p>
                    <p className="text-[10px] font-black text-indigo-400 mt-0.5">+{task.baseReward} XP</p>
                </div>
            </div>

            {!isCompleted && (
                <div className="flex gap-2 relative z-[9999] pointer-events-auto">
                    {needsVerify ? (
                        <button
                            onClick={handleVerifyOrClaim}
                            disabled={isVerifying || isDisabled}
                            className={`btn-primary py-1.5 px-3 text-[9px] bg-blue-600 hover:bg-blue-500 ${isVerifying || isDisabled ? 'opacity-50' : ''}`}
                        >
                            {isVerifying ? 'Verifying...' : 'Verify'}
                        </button>
                    ) : (
                        <Transaction calls={calls} onSuccess={() => { onSuccess(); refetchCompletion(); }}>
                            <TransactionButton
                                className={`btn-primary py-1.5 px-3 text-[9px] ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                text={isDisabled ? 'Locked' : 'Claim'}
                                disabled={isDisabled}
                            />
                        </Transaction>
                    )}
                </div>
            )}
        </div>
    );
}

function SponsorCard({ sponsorId, isDisabled, address, onSuccess }) {
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

    const handleBatchSuccess = () => {
        setSelectedTasks([]);
        onSuccess();
    };

    return (
        <div className={`glass-card p-5 relative overflow-hidden transition-all ${isDisabled ? 'opacity-50 grayscale' : 'hover:border-indigo-500/40'}`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest block mb-1">Partner</span>
                    <h4 className="font-black text-lg uppercase tracking-tighter text-white">{sponsorName}</h4>
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
                    />
                ))}
            </div>

            <div className="relative z-[9999] pointer-events-auto">
                <Transaction calls={calls} onSuccess={handleBatchSuccess}>
                    <TransactionButton
                        className={`w-full btn-primary py-3 text-[10px] ${cardsDisabled ? 'opacity-50 grayscale' : ''}`}
                        text={isDisabled ? 'Identity Required' : selectedTasks.length > 0 ? `Verify ${selectedTasks.length} Tasks` : 'Select Tasks'}
                        disabled={cardsDisabled}
                    />
                </Transaction>
            </div>
        </div>
    );
}

function SubTaskItem({ taskId, isSelected, onToggle, address }) {
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

    const needsVerify = task.requiresVerification && !isVerified;

    const handleAction = async (e) => {
        e.stopPropagation();
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
            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors cursor-pointer ${isCompleted
                ? 'bg-emerald-500/5 border-emerald-500/10 opacity-60'
                : isSelected
                    ? 'bg-indigo-500 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                    : 'bg-white/5 border-white/5 hover:border-white/10'
                }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${isCompleted
                    ? 'bg-emerald-500 border-emerald-500'
                    : isSelected
                        ? 'bg-white border-white'
                        : 'border-white/10 bg-slate-900'
                    }`}>
                    {(isCompleted || isSelected) && (
                        <Check
                            className={`w-4 h-4 ${isCompleted ? 'text-white' : 'text-indigo-500'}`}
                            strokeWidth={4}
                        />
                    )}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <p className={`text-[11px] font-bold tracking-tight ${isCompleted ? 'line-through text-slate-500'
                            : isSelected ? 'text-white'
                                : 'text-slate-300'
                            }`}>{task.title}</p>
                        {task.requiresVerification && (
                            <ShieldCheck className={`w-3 h-3 ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`} />
                        )}
                    </div>
                    <p className={`text-[9px] font-black ${isCompleted ? 'text-indigo-400/50'
                        : isSelected ? 'text-white/80'
                            : 'text-indigo-400'
                        }`}>+{task.baseReward} XP</p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {needsVerify ? (
                    <button
                        disabled={isVerifying}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black py-1.5 px-3 rounded-lg transition-all"
                    >
                        {isVerifying ? 'Wait...' : 'Verify'}
                    </button>
                ) : isCompleted ? (
                    <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                        Done
                    </span>
                ) : null}
            </div>
        </div>
    );
}
