'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import {
    Transaction,
    TransactionButton,
    TransactionStatus,
    TransactionStatusLabel,
    TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';
import { MASTER_X_ABI, DAILY_APP_ABI, CONTRACTS } from '@/lib/contracts';
import { Trophy, Star, Zap, ShieldCheck, ShieldAlert, Check, Calendar } from 'lucide-react';
import { useSocialGuard } from '@/hooks/useSocialGuard';
import { encodeFunctionData } from 'viem';
import { useQueryClient } from '@tanstack/react-query';

// ✅ Zero address konstan untuk referrer default (Fix V-02)
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

export function TaskDashboard() {
    const { address, isConnected } = useAccount();
    const [mounted, setMounted] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => { setMounted(true); }, []);

    const { data: fcUser } = useSocialGuard(address);

    const { data: userData } = useReadContract({
        address: CONTRACTS.MASTER_X,
        abi: MASTER_X_ABI,
        functionName: 'users',
        args: [address!],
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

    const sponsorshipIds: number[] = [];
    if (nextSponsorId) {
        // Optimasi: Membatasi maksimal 10 sponsor terbaru untuk menghindari N+1 query problem pada RPC
        const maxSponsors = 10;
        const total = Number(nextSponsorId);
        const start = Math.max(1, total - maxSponsors);

        for (let i = start; i < total; i++) {
            sponsorshipIds.push(i);
        }
        sponsorshipIds.reverse(); // Tampilkan yang terbaru di atas
    }

    const { data: unsyncedPointsRaw } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'unsyncedPoints',
        args: [address!],
        query: { enabled: !!address },
    });

    const userPoints = userData ? Number(userData[0]) : 0;
    const unsyncedPoints = unsyncedPointsRaw ? Number(unsyncedPointsRaw) : 0;

    // ✅ Fix V-03 & V-10: Invalidate hanya query kontrak yang relevan, bukan semua query
    const handleTransactionSuccess = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['readContract'] });
    }, [queryClient]);

    if (!mounted) return null;

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <Zap className="w-16 h-16 text-indigo-500 mb-4" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
                <h1 className="text-3xl font-bold mb-2 uppercase tracking-tighter">Crypto Disco</h1>
                <p className="text-slate-400 mb-8">Connect your wallet to earn points and rewards!</p>
            </div>
        );
    }

    return (
        <div className="p-6 flex flex-col h-full overflow-y-auto pb-24">
            {/* Header / Points Info */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 mb-6 shadow-xl shadow-indigo-500/20 text-white flex justify-between items-center relative overflow-hidden">
                <div className="z-10">
                    <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest opacity-80">Total Points</p>
                    <h2 className="text-4xl font-black flex items-center gap-2 tracking-tighter">
                        {userPoints} <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                    </h2>
                </div>
                <div className="z-10 bg-black/20 backdrop-blur-md p-4 rounded-2xl flex flex-col items-center border border-white/10">
                    <Trophy className="w-6 h-6 text-yellow-400 mb-1" />
                    <span className="text-[10px] uppercase font-bold text-white/60 tracking-tighter">Discovery</span>
                </div>

                {unsyncedPoints > 0 && (
                    <div className="absolute top-4 right-4 z-[9999] pointer-events-auto">
                        <Transaction
                            calls={[{
                                to: CONTRACTS.DAILY_APP,
                                data: encodeFunctionData({
                                    abi: DAILY_APP_ABI,
                                    functionName: 'syncMasterXPoints',
                                }),
                            }]}
                            onSuccess={handleTransactionSuccess}
                            capabilities={{
                                paymasterService: {
                                    url: `https://api.developer.coinbase.com/rpc/v1/base-sepolia/${process.env.NEXT_PUBLIC_CDP_API_KEY}`,
                                },
                            }}
                        >
                            <TransactionButton
                                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 border border-indigo-400/50 transition-colors"
                                text={`Sync ${unsyncedPoints} Pts`}
                            />
                        </Transaction>
                    </div>
                )}

                {/* ✅ Fix V-08: pointer-events-none agar elemen dekoratif tidak block klik */}
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Social Guard Status */}
            {/* ✅ Fix V-09: animate-bounce dihapus, diganti transition-colors (sesuai .cursorrules) */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl mb-8 border transition-colors duration-300 shadow-sm ${fcUser
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                {fcUser ? (
                    <>
                        <ShieldCheck className="w-6 h-6 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider">Social Identity Verified</p>
                            <p className="text-[10px] opacity-70 uppercase font-bold tracking-tight">Accessing Gasless Rewards</p>
                        </div>
                    </>
                ) : (
                    <>
                        <ShieldAlert className="w-6 h-6 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider">Social Identity Required</p>
                            <p className="text-[10px] opacity-70 uppercase font-bold tracking-tight">Link Farcaster on Warpcast to proceed</p>
                        </div>
                    </>
                )}
            </div>

            {/* Daily Admin Tasks */}
            <h3 className="text-lg font-black mb-4 flex items-center gap-2 uppercase tracking-tight text-white/90">
                Daily Admin Tasks <Calendar className="w-5 h-5 text-indigo-500" />
            </h3>
            <div className="space-y-3 mb-10">
                {dailyTaskIds && dailyTaskIds.length > 0 ? (
                    dailyTaskIds.map((tid) => (
                        <DailyTaskItem
                            key={Number(tid)}
                            taskId={Number(tid)}
                            isDisabled={!fcUser}
                            address={address!}
                            onSuccess={handleTransactionSuccess}
                        />
                    ))
                ) : (
                    <div className="p-8 text-center bg-slate-900/30 rounded-3xl border border-slate-800 border-dashed">
                        <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">No daily tasks today</p>
                    </div>
                )}
            </div>

            {/* Sponsorship Cards */}
            <h3 className="text-lg font-black mb-4 flex items-center gap-2 uppercase tracking-tight text-white/90">
                Sponsor Rewards <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </h3>
            <div className="space-y-6 flex-1">
                {sponsorshipIds.map((id) => (
                    <SponsorCard
                        key={id}
                        sponsorId={id}
                        isDisabled={!fcUser}
                        address={address!}
                        onSuccess={handleTransactionSuccess}
                    />
                ))}
                {sponsorshipIds.length === 0 && (
                    <div className="p-12 text-center bg-slate-900/50 rounded-[40px] border border-slate-800 border-dashed">
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Awaiting Sponsors...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function DailyTaskItem({
    taskId,
    isDisabled,
    address,
    onSuccess,
}: {
    taskId: number;
    isDisabled: boolean;
    address: `0x${string}`;
    onSuccess: () => void;
}) {
    const { data: task } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'tasks',
        args: [BigInt(taskId)],
    });

    const { data: isCompleted } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasDoneTask',
        args: [address, BigInt(taskId)],
    });

    if (!task) return null;
    const [desc, reward] = task;

    // ✅ Fix V-02 & V-04: doTask dipanggil dengan 2 args — taskId + ZERO_ADDRESS referrer
    const calls = [{
        to: CONTRACTS.DAILY_APP,
        data: encodeFunctionData({
            abi: DAILY_APP_ABI,
            functionName: 'doTask',
            args: [BigInt(taskId), ZERO_ADDRESS],
        }),
    }];

    return (
        <div className={`bg-slate-900/80 border-2 rounded-3xl p-4 flex justify-between items-center transition-colors ${isCompleted ? 'border-slate-800 opacity-60' : 'border-slate-800 hover:border-indigo-500/40'
            }`}>
            <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isCompleted
                    ? 'bg-indigo-500/20 text-indigo-500'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    }`}>
                    {isCompleted
                        ? <Check className="w-5 h-5" strokeWidth={3} />
                        : <Zap className="w-4 h-4 fill-white" />
                    }
                </div>
                <div>
                    <p className={`text-xs font-black uppercase tracking-tight ${isCompleted ? 'line-through text-slate-500' : 'text-white'
                        }`}>{desc}</p>
                    <p className="text-[10px] font-bold text-indigo-400">+{reward.toString()} XP</p>
                </div>
            </div>

            {/* ✅ Fix V-08: z-[9999] pointer-events-auto pada Transaction wrapper */}
            {!isCompleted && (
                <div className="relative z-[9999] pointer-events-auto">
                    <Transaction
                        calls={calls}
                        onSuccess={onSuccess}
                        capabilities={{
                            paymasterService: {
                                url: `https://api.developer.coinbase.com/rpc/v1/base-sepolia/${process.env.NEXT_PUBLIC_CDP_API_KEY}`,
                            },
                        }}
                    >
                        <TransactionButton
                            className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] transition-colors border-none ${isDisabled
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                }`}
                            text={isDisabled ? 'Locked' : 'Claim'}
                            disabled={isDisabled}
                        />
                    </Transaction>
                </div>
            )}
        </div>
    );
}

function SponsorCard({
    sponsorId,
    isDisabled,
    address,
    onSuccess,
}: {
    sponsorId: number;
    isDisabled: boolean;
    address: `0x${string}`;
    onSuccess: () => void;
}) {
    const [selectedTasks, setSelectedTasks] = useState<number[]>([]);

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

    const toggleTask = (taskId: number, isCompleted: boolean) => {
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
        <div className={`bg-slate-900 border-2 rounded-[40px] p-6 transition-colors duration-300 shadow-2xl overflow-hidden relative ${isDisabled
            ? 'opacity-60 grayscale-[0.8] border-slate-800'
            : 'border-slate-800 hover:border-indigo-500/50 group'
            }`}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] mb-1 block">Sponsored By</span>
                    <h4 className="font-black text-2xl uppercase tracking-tighter text-white">{sponsorName}</h4>
                </div>
                <div className="bg-indigo-600/10 p-3 rounded-2xl group-hover:bg-indigo-600/20 transition-colors">
                    <Zap className="w-5 h-5 text-indigo-500" />
                </div>
            </div>

            <div className="space-y-3 mb-8">
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

            {/* ✅ Fix V-08: z-[9999] pointer-events-auto pada Transaction wrapper */}
            <div className="relative z-[9999] pointer-events-auto">
                <Transaction
                    calls={calls}
                    onSuccess={handleBatchSuccess}
                    capabilities={{
                        paymasterService: {
                            url: `https://api.developer.coinbase.com/rpc/v1/base-sepolia/${process.env.NEXT_PUBLIC_CDP_API_KEY}`,
                        },
                    }}
                >
                    <TransactionButton
                        className={`w-full py-5 rounded-3xl font-black uppercase tracking-[0.1em] text-xs transition-colors border-none ${cardsDisabled
                            ? '!bg-slate-800 !text-slate-500 !cursor-not-allowed'
                            : 'bg-white text-black hover:bg-slate-100 active:scale-95 shadow-xl shadow-white/5'
                            }`}
                        text={
                            isDisabled
                                ? 'Identity Required'
                                : selectedTasks.length > 0
                                    ? `Verify ${selectedTasks.length} Tasks`
                                    : 'Select Tasks'
                        }
                        disabled={cardsDisabled}
                    />
                    <TransactionStatus className="mt-4">
                        <TransactionStatusLabel className="text-[10px] font-bold uppercase text-indigo-400 text-center w-full" />
                        <TransactionStatusAction className="text-[10px]" />
                    </TransactionStatus>
                </Transaction>
            </div>

            {/* ✅ Fix V-08: pointer-events-none agar dekoratif tidak block klik */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        </div>
    );
}

function SubTaskItem({
    taskId,
    isSelected,
    onToggle,
    address,
}: {
    taskId: number;
    isSelected: boolean;
    onToggle: (id: number, completed: boolean) => void;
    address: `0x${string}`;
}) {
    const { data: task } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'tasks',
        args: [BigInt(taskId)],
    });

    const { data: isCompleted } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasDoneTask',
        args: [address, BigInt(taskId)],
    });

    if (!task) return null;
    const [desc, reward] = task;

    return (
        <div
            onClick={() => onToggle(taskId, !!isCompleted)}
            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-colors cursor-pointer ${isCompleted
                ? 'bg-indigo-500/5 border-indigo-500/20 opacity-60'
                : isSelected
                    ? 'bg-indigo-500 border-indigo-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors ${isCompleted
                    ? 'bg-indigo-500 border-indigo-500'
                    : isSelected
                        ? 'bg-white border-white'
                        : 'border-slate-600 bg-slate-900'
                    }`}>
                    {(isCompleted || isSelected) && (
                        <Check
                            className={`w-4 h-4 ${isCompleted ? 'text-white' : 'text-indigo-500'}`}
                            strokeWidth={4}
                        />
                    )}
                </div>
                <div>
                    <p className={`text-xs font-bold uppercase tracking-tight ${isCompleted ? 'line-through text-slate-500'
                        : isSelected ? 'text-white'
                            : 'text-slate-300'
                        }`}>{desc}</p>
                    <p className={`text-[10px] font-black ${isCompleted ? 'text-indigo-400/50'
                        : isSelected ? 'text-white/80'
                            : 'text-indigo-400'
                        }`}>+{reward.toString()} XP</p>
                </div>
            </div>
            {isCompleted && (
                <span className="text-[8px] font-black uppercase text-indigo-400 px-2 py-1 bg-indigo-400/10 rounded-full">
                    Completed
                </span>
            )}
        </div>
    );
}
