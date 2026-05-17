import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { MASTER_X_ABI, DAILY_APP_ABI, CONTRACTS } from '../lib/contracts';
import { Zap, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useSocialGuard } from '../hooks/useSocialGuard';
import { useVerification } from '../hooks/useVerification';
import { useTaskInfo } from '../hooks/useTaskInfo';
import { useUserV12Stats, useV12Stats } from '../hooks/useContract';
import { useQueryClient } from '@tanstack/react-query';
import { useCMS } from '../hooks/useCMS';
import { GovernancePanel } from './GovernancePanel';
import { calculateMultipliers, estimateXP, MultiplierResult, UserStats } from '../lib/economy';
import { supabase } from '../lib/supabaseClient';
import { NexusPulseStrip } from './home/NexusPulseStrip';
import { DailyGoalCard } from './tasks/DailyGoalCard';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

interface Multipliers {
    total: number;
    isUnderdogActive: boolean;
}

export function UnifiedDashboard() {
    const { address, isConnected } = useAccount();
    const [mounted, setMounted] = useState(false);
    const queryClient = useQueryClient();
    const { refetch: refetchStats, stats: userStats } = useUserV12Stats(address);
    const { totalUsers } = useV12Stats();

    // Heartbeat logic for CCU/DAU - routed through backend
    useEffect(() => {
        if (!address) return;
        const heartbeat = async () => {
            try {
                await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ action: 'update-profile', wallet_address: address, heartbeat: true })
                });
            } catch { /* heartbeat is best-effort */ }
        };
        heartbeat();
    }, [address]);

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

    const multis = calculateMultipliers(userStats as UserStats | null, totalUsers);

    useEffect(() => { setMounted(true); }, []);

    const { data: fcUser } = useSocialGuard(address);

    const { data: userData } = useReadContract({
        address: CONTRACTS.MASTER_X,
        abi: MASTER_X_ABI,
        functionName: 'users',
        args: [address],
        query: { enabled: !!address },
    });

    const { data: nextTaskIdRaw } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'nextTaskId',
    });

    // Build task ID array from nextTaskId (replaces legacy getDailyTasks)
    const dailyTaskIds: number[] = [];
    if (nextTaskIdRaw) {
        const total = Number(nextTaskIdRaw);
        const maxDisplay = 10; // Show last 10 tasks
        const start = Math.max(0, total - maxDisplay);
        for (let i = start; i < total; i++) {
            dailyTaskIds.push(i);
        }
    }

    const { data: nextSponsorId } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'totalSponsorRequests',
    });

    const sponsorshipIds: number[] = [];
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

    const _userPoints = userData ? Number((userData as [bigint])[0]) : 0;
    const _unsyncedPoints = unsyncedPointsRaw ? Number(unsyncedPointsRaw) : 0;

    const handleTransactionSuccess = useCallback(async (txHash: string) => {
        // BUG-SYNC fix: Trigger backend XP sync immediately after transaction confirmation
        if (address) {
            try {

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
        <div className="w-full bg-[#0B0E14] min-h-screen text-slate-300">
            <NexusPulseStrip />
            <div className="max-w-4xl mx-auto space-y-6 mb-12">

                {/* Admin Governance Panel (v3.20.0) */}
                {isAdmin && <GovernancePanel />}

                {/* Social Verification Guard */}
                <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${fcUser?.isVerified
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-blue-500/10 text-blue-400'
                    }`}>
                    {fcUser?.isVerified ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <ShieldAlert className="w-5 h-5 shrink-0 animate-pulse" />}
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest">{fcUser?.isVerified ? 'IDENTITY VERIFIED' : 'IDENTITY REQUIRED'}</p>
                        <p className="text-[11px] font-black uppercase tracking-widest opacity-70 leading-none mt-1">
                            {fcUser?.isVerified ? `LINKED TO @${(fcUser.farcaster?.username || fcUser.twitter?.username || 'ANONYMOUS').toUpperCase()}` : 'CONNECT FARCASTER TO UNLOCK GASLESS REWARDS'}
                        </p>
                    </div>
                    {!fcUser && (
                        <a href="https://warpcast.com" target="_blank" rel="noreferrer" className="text-[11px] font-black uppercase tracking-widest text-blue-400 underline underline-offset-2 shrink-0">
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

                {/* [v3.59.4] Daily Retention Goal Component */}
                <DailyGoalCard />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Daily Admin Tasks */}
                    <div className="space-y-4">
                        <div className="space-y-3">
                            {(dailyTaskIds || []).map((tid) => (
                                <DailyTaskItem
                                    key={tid}
                                    taskId={tid}
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
        </div>
    );
}

function DailyTaskItem({ taskId, isDisabled, isBaseVerified, address, onSucceed, multipliers }: {
    taskId: number;
    isDisabled: boolean;
    isBaseVerified: boolean;
    address: `0x${string}` | undefined;
    onSucceed: (_hash: string) => void;
    multipliers: Multipliers;
}) {
    const { task, isLoading } = useTaskInfo(taskId);
    const { verifyTask, isVerifying, registerTaskStart } = useVerification(() => onSucceed(''));

    const { data: isCompleted, refetch: refetchCompletion } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'hasCompletedTask',
        args: [address, BigInt(taskId)],
    });

    // v3.42.2: Hard Hide for completed tasks
    if (isLoading || !task || isCompleted) return null;

    const t = task;
    // Hardening v3.41.2: Check Base Social Requirement
    const isBaseLocked = t.isBaseSocialRequired && !isBaseVerified;
    const finalDisabled = isDisabled || isBaseLocked;

    const needsVerify = t.requiresVerification && !isCompleted;

    const handleVerifyOrClaim = async () => {
        if (needsVerify) {
            registerTaskStart(taskId);
            window.open(t.link, '_blank');
            const success = await verifyTask(t, address || '', taskId);
            if (success) {
                refetchCompletion();
            }
        }
    };

    return (
        <div className="glass-card p-4 flex justify-between items-center transition-all hover:bg-zinc-800/60 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-400">
                    <Zap className="w-3 h-3 fill-current" />
                </div>
                <div>
                    <p className={`text-[11px] font-black uppercase tracking-widest leading-tight ${isCompleted ? 'line-through text-slate-500' : 'text-white'}`}>{String(t.title || '').toUpperCase()}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">
                            +{estimateXP(t.baseReward, multipliers as MultiplierResult)} XP
                        </p>
                        {multipliers.total !== 1.0 && (
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight line-through opacity-50">
                                {t.baseReward} XP
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
                            isDisabled={!!finalDisabled}
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

function ClaimButton({ taskId, isDisabled, onSuccess }: {
    taskId: number;
    isDisabled: boolean;
    onSuccess: (_hash: string) => void;
}) {
    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        if (isSuccess && hash) {
            onSuccess(hash);
        }
    }, [isSuccess, hash, onSuccess]);

    const handleClaim = () => {
        writeContract({
            address: CONTRACTS.DAILY_APP as `0x${string}`,
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

function SponsorCard({ sponsorId, isDisabled, isBaseVerified, address, onSuccess, multipliers }: {
    sponsorId: number;
    isDisabled: boolean;
    isBaseVerified: boolean;
    address: `0x${string}` | undefined;
    onSuccess: (_hash: string) => void;
    multipliers: Multipliers;
}) {
    void sponsorId;
    void isDisabled;
    void isBaseVerified;
    void address;
    void onSuccess;
    void multipliers;

    // Legacy on-chain sponsor cards require sponsor task lookup selectors that are not in the deployed ABI.
    // Sponsored missions are rendered through the UGC campaign pipeline instead.
    return null;
}
