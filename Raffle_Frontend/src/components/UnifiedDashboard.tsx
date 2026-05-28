import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { DAILY_APP_ABI, CONTRACTS } from '../lib/contracts';
import { Zap, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
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

// Custom Official Logos SVGs (Premium Branding)
const GoogleIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
    </svg>
);

const XIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const FarcasterIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 1000 1000" fill="currentColor">
        <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z" />
        <path d="M377.778 844.445H622.222V528.889H377.778V844.445Z" />
    </svg>
);

const BaseIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm3.5-7c0 1.93-1.57 3.5-3.5 3.5S8.5 13.93 8.5 12s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5z" />
    </svg>
);

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

    const sponsorshipIds: number[] = [];

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
                <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            fcUser?.isVerified 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        }`}>
                            {fcUser?.isVerified ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5 animate-pulse" />}
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-white leading-tight">IDENTITY & SOCIAL STATUS</p>
                            <p className="text-[10px] font-bold uppercase tracking-tight text-slate-500 mt-0.5 leading-none">
                                {fcUser?.isVerified ? 'SOCIAL IDENTITIES DETECTED & ACTIVE' : 'LINK SOCIAL PLATFORMS TO UNLOCK REWARDS'}
                            </p>
                            {!fcUser?.isVerified && (
                                <div className="flex items-center gap-2 mt-2">
                                    {!fcUser?.farcaster?.verified && (
                                        <a 
                                            href={import.meta.env.VITE_OWNER_FARCASTER_REF || 'https://warpcast.com/~/signup'} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="text-[9px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
                                        >
                                            Register Farcaster ➔
                                        </a>
                                    )}
                                    {!fcUser?.farcaster?.verified && !fcUser?.base?.verified && (
                                        <span className="text-slate-700 text-[9px] font-black">•</span>
                                    )}
                                    {!fcUser?.base?.verified && (
                                        <a 
                                            href={import.meta.env.VITE_OWNER_BASE_REF || 'https://base.org/names'} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            Get Basename ➔
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Social Logos status grid */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {/* Google */}
                            <div 
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                                    fcUser?.google?.verified
                                        ? 'bg-blue-500/5 border-blue-500/20 text-blue-400'
                                        : 'bg-white/5 border-white/5 text-slate-600 opacity-40'
                                }`}
                                title={fcUser?.google?.verified ? `Google Linked: ${fcUser.google.email}` : 'Google Not Linked'}
                            >
                                <GoogleIcon className="w-4 h-4" />
                            </div>

                            {/* X (Twitter) */}
                            <div 
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                                    fcUser?.twitter?.verified
                                        ? 'bg-white/10 border-white/20 text-white'
                                        : 'bg-white/5 border-white/5 text-slate-600 opacity-40'
                                }`}
                                title={fcUser?.twitter?.verified ? `X Linked: @${fcUser.twitter.username}` : 'X Not Linked'}
                            >
                                <XIcon className="w-4 h-4 text-white" />
                            </div>

                            {/* Farcaster */}
                            <div 
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                                    fcUser?.farcaster?.verified
                                        ? 'bg-[#8a63d2]/10 border-[#8a63d2]/20 text-[#8a63d2]'
                                        : 'bg-white/5 border-white/5 text-slate-600 opacity-40'
                                }`}
                                title={fcUser?.farcaster?.verified ? `Farcaster Linked: FID ${fcUser.farcaster.fid}` : 'Farcaster Not Linked'}
                            >
                                <FarcasterIcon className="w-4 h-4 text-[#8a63d2]" />
                            </div>

                            {/* Base Social */}
                            <div 
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                                    fcUser?.base?.verified
                                        ? 'bg-[#0052ff]/10 border-[#0052ff]/20 text-[#0052ff]'
                                        : 'bg-white/5 border-white/5 text-slate-600 opacity-40'
                                }`}
                                title={fcUser?.base?.verified ? `Base Linked: ${fcUser.base.username}` : 'Base Social Not Linked'}
                            >
                                <BaseIcon className="w-4 h-4 text-[#0052ff]" />
                            </div>
                        </div>

                        <Link 
                            to="/profile" 
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 whitespace-nowrap"
                        >
                            MANAGE
                        </Link>
                    </div>
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
