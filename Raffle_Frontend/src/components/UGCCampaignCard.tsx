import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';
import { CheckCircle2, Loader2, Trophy, Share2, X, Zap, ExternalLink, Twitter, MessageCircle, Lock, ShieldCheck } from 'lucide-react';
import { useVerification } from '../hooks/useVerification';
import { useFarcaster } from '../hooks/useFarcaster';
import { APP_CONFIG } from '../lib/contracts';

// Platform display icon (text-based since we avoid external deps)
const PLATFORM_ICON = {
    farcaster: '⬣',
    twitter: '𝕏',
    tiktok: '♪',
    instagram: '◎',
    onchain: '⛓'
};

interface UGCCampaign {
    id: string | number;
    title: string;
    platform_code: string;
    reward_amount_per_user: number | string;
    reward_symbol: string;
}

interface UGCSubTask {
    id: string | number;
    title: string;
    action_type: string;
    platform: string;
    link: string;
    is_base_social_required?: boolean;
}

const ACTION_VERB: Record<string, string> = {
    follow: 'Follow',
    like: 'Like',
    recast: 'Recast',
    repost: 'Repost',
    quote: 'Quote',
    reply: 'Reply',
    comment: 'Comment',
    duet: 'Duet',
    transaction: 'Transact'
};

// ─────────────────────────────────────────────
// Completion Pop-up Modal
// ─────────────────────────────────────────────
function CompletionModal({ campaign, totalXp, usdcReward, rewardSymbol, onClaim, onClose, isClaiming, claimed }: {
    campaign: UGCCampaign;
    totalXp: number;
    usdcReward: string | number;
    rewardSymbol: string;
    onClaim: () => void;
    onClose: () => void;
    isClaiming: boolean;
    claimed: boolean;
}) {
    const shareText = `🎉 I just completed the "${campaign.title}" mission on Crypto Disco and earned ${totalXp} XP + ${usdcReward} ${rewardSymbol}!\n\nJoin me: https://app.cryptodisco.xyz?ref=ugc`;

    const shareLinks = [
        { label: 'X / Twitter', icon: <Twitter className="w-4 h-4" />, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` },
        { label: 'Warpcast',    icon: <span className="text-sm">⬣</span>,   url: `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}` },
        { label: 'Telegram',   icon: <MessageCircle className="w-4 h-4" />, url: `https://t.me/share/url?url=${encodeURIComponent('https://app.cryptodisco.xyz')}&text=${encodeURIComponent(shareText)}` },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <div
                className="relative max-w-sm w-full glass-card bg-gradient-to-br from-violet-900/40 to-indigo-900/30 border border-violet-500/30 rounded-[2.5rem] p-8 space-y-6 shadow-2xl shadow-violet-500/20 animate-[fadeInUp_0.3s_ease]"
                onClick={e => e.stopPropagation()}
            >
                {/* Close */}
                <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 transition-all">
                    <X className="w-4 h-4" />
                </button>

                {/* Trophy Icon */}
                <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                        <Trophy className="w-10 h-10 text-violet-400" />
                    </div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight text-center">Mission <span className="text-violet-400">Complete!</span></h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">{campaign.title}</p>
                </div>

                {/* Rewards Preview */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/40 rounded-2xl p-4 text-center border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total XP</p>
                        <p className="text-2xl font-black text-violet-400 font-mono">{totalXp}</p>
                    </div>
                    <div className="bg-black/40 rounded-2xl p-4 text-center border border-emerald-500/10">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Reward</p>
                        <p className="text-2xl font-black text-emerald-400 font-mono">{parseFloat(String(usdcReward)).toFixed(2)}</p>
                        <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">{rewardSymbol}</p>
                    </div>
                </div>

                {/* Claim Button */}
                {!claimed ? (
                    <button
                        onClick={onClaim}
                        disabled={isClaiming}
                        className="w-full p-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/30"
                    >
                        {isClaiming ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trophy className="w-5 h-5" /> CLAIM REWARDS</>}
                    </button>
                ) : (
                    <div className="flex items-center justify-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Reward Claimed!</span>
                    </div>
                )}

                {/* Share Buttons */}
                <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] text-center">Share Achievement</p>
                    <div className="flex gap-2 justify-center">
                        {shareLinks.map(s => (
                            <a
                                key={s.label}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-wider transition-all hover:text-white"
                            >
                                {s.icon} {s.label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main UGC Campaign Card Component
// ─────────────────────────────────────────────
export function UGCCampaignCard({ campaign, subTasks, userClaimedTaskIds = new Set(), refetchStats }: {
    campaign: UGCCampaign;
    subTasks: UGCSubTask[];
    userClaimedTaskIds?: Set<string | number>;
    refetchStats?: () => void;
}) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { profileData } = useFarcaster();
    const { verifyTask, registerTaskStart, isVerifying, lastActionTime } = useVerification(refetchStats);

    const [showModal, setShowModal] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimed, setClaimed] = useState(false);
    const [claimResult, setClaimResult] = useState<any>(null);
    const [localStarted, setLocalStarted] = useState<Record<string | number, boolean>>({});

    // Identity Verification Status (v3.42.1)
    const isBaseVerified = useMemo(() => (profileData as any)?.is_base_social_verified === true, [profileData]);

    const totalTasks = subTasks.length;
    const completedCount = subTasks.filter(t => userClaimedTaskIds.has(String(t.id))).length;
    const allDone = completedCount === totalTasks && totalTasks > 0;
    const alreadyCampaignClaimed = userClaimedTaskIds.has(`ugc_campaign_${campaign.id}`);

    // Auto-show modal when all tasks just completed
    useEffect(() => {
        if (allDone && !alreadyCampaignClaimed) {
            setShowModal(true);
        }
    }, [allDone, alreadyCampaignClaimed]);

    const handleGoToTask = (task: UGCSubTask) => {
        if (task.is_base_social_required && !isBaseVerified) {
            return toast.error("IDENTITY LOCKED: Please verify your Base Social profile first.");
        }
        registerTaskStart(task.id);
        setLocalStarted(prev => ({ ...prev, [task.id]: true }));
        window.open(task.link, '_blank');
    };

    const handleVerifySubTask = async (task: UGCSubTask) => {
        if (!address) return toast.error("Connect wallet first.");
        const success = await verifyTask(task, address, task.id, (profileData as any)?.fid);
        if (success && refetchStats) refetchStats();
    };

    const handleClaim = useCallback(async () => {
        if (!address) return toast.error('Connect wallet first.');
        setIsClaiming(true);
        const tid = toast.loading('Claiming campaign rewards...');
        try {
            // Check if any sub-task is still gated and user is unverified
            const hasGatedRemaining = subTasks.some(t => t.is_base_social_required && !userClaimedTaskIds.has(String(t.id)) && !isBaseVerified);
            if (hasGatedRemaining) throw new Error("IDENTITY LOCKED: Complete gated tasks first.");

            const timestamp = new Date().toISOString();
            const message = `Claim UGC Campaign: ${campaign.title}\nID: ${campaign.id}\nWallet: ${address.toLowerCase()}\nTime: ${timestamp}`;
            
            // Re-use unified verification logic for the campaign claim too
            const response = await fetch('/api/tasks-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'claim-ugc-campaign', 
                    wallet_address: address, 
                    campaign_id: campaign.id,
                    signature: await signMessageAsync({ message }),
                    message 
                })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Claim failed");
            
            if (data.already_claimed) {
                toast.success('Already claimed!', { id: tid });
                setClaimed(true);
                return;
            }
            setClaimResult(data);
            setClaimed(true);
            toast.success(`🎉 +${data.xp} XP & ${data.usdc_reward} ${data.reward_symbol} claimed!`, { id: tid, duration: 6000 });
        } catch (err: any) {
            toast.error(err.message || 'Claim failed.', { id: tid });
        } finally {
            setIsClaiming(false);
        }
    }, [address, campaign.id, campaign.title, subTasks, userClaimedTaskIds, isBaseVerified]);

    return (
        <>
            <div className={`glass-card rounded-[2.5rem] border overflow-hidden transition-all ${allDone ? 'border-violet-500/30 bg-violet-900/10 shadow-lg shadow-violet-500/10' : 'border-white/5 bg-slate-900/20'}`}>
                {/* Header */}
                <div className="p-6 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black transition-all ${allDone ? 'bg-violet-600/30 text-violet-300' : 'bg-white/5 text-slate-400'}`}>
                            {(PLATFORM_ICON as Record<string, string>)[campaign.platform_code] || '●'}
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight">{campaign.title}</h3>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{campaign.platform_code}</p>
                        </div>
                    </div>
                    {/* Progress Badge */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${allDone ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
                            {completedCount}/{totalTasks}
                        </div>
                        {!allDone && (
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                {totalTasks - completedCount} TASK SISA
                            </span>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="px-6 pb-2">
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-700"
                            style={{ width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* Sub-Task List */}
                <div className="px-6 pb-4 space-y-2 mt-2">
                    {subTasks.map((task, i) => {
                        const isDone = userClaimedTaskIds.has(String(task.id));
                        const lastTime = (lastActionTime as any)[task.id] || 0;
                        const diff = Math.floor((Date.now() - lastTime) / 1000);
                        const isCountingDown = lastTime > 0 && diff < APP_CONFIG.SOCIAL_INDEX_DELAY_SEC;
                        const timeLeft = Math.max(0, APP_CONFIG.SOCIAL_INDEX_DELAY_SEC - diff);
                        const isGated = task.is_base_social_required && !isBaseVerified;

                        return (
                            <div key={task.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isDone ? 'bg-emerald-500/5 border-emerald-500/20' : isGated ? 'bg-slate-900/40 border-white/5 opacity-80' : 'bg-white/3 border-white/5'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-all ${isDone ? 'bg-emerald-500 text-white' : isGated ? 'bg-slate-800 text-slate-500' : 'bg-white/10 text-slate-500'}`}>
                                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : isGated ? <Lock className="w-3.5 h-3.5" /> : i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className={`text-[11px] font-black uppercase tracking-widest truncate ${isDone ? 'text-emerald-400' : isGated ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {ACTION_VERB[task.action_type] || task.action_type}
                                        </p>
                                        {task.is_base_social_required && (
                                            <ShieldCheck className={`w-3 h-3 ${isBaseVerified ? 'text-indigo-400' : 'text-slate-600'}`} />
                                        )}
                                    </div>
                                    {isGated && <p className="text-[8px] font-bold text-indigo-500/80 uppercase tracking-tighter">Requires Base Social</p>}
                                </div>

                                {!isDone && (
                                    <div className="flex items-center gap-2">
                                        {isCountingDown ? (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-500 uppercase tracking-widest">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                <span className="tabular-nums">{timeLeft}s</span>
                                            </div>
                                        ) : localStarted[task.id] || (lastTime > 0) ? (
                                            <button
                                                onClick={() => handleVerifySubTask(task)}
                                                disabled={isVerifying}
                                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                                            >
                                                {isVerifying ? '...' : 'VERIFY'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleGoToTask(task)}
                                                disabled={isGated}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isGated ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40'}`}
                                            >
                                                Go <ExternalLink className="w-2.5 h-2.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Reward Info + Claim CTA */}
                <div className="px-6 pb-6 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Reward</p>
                        <p className="text-sm font-black text-emerald-400 font-mono">{campaign.reward_amount_per_user} {campaign.reward_symbol || 'USDC'}</p>
                    </div>
                    {alreadyCampaignClaimed ? (
                        <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Rewards Claimed</span>
                        </div>
                    ) : allDone ? (
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-violet-500/30 animate-pulse active:scale-95"
                        >
                            <Trophy className="w-4 h-4" /> CLAIM ALL REWARDS
                        </button>
                    ) : (
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/5">
                                <Zap className="w-3.5 h-3.5 text-slate-600" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selesaikan {totalTasks - completedCount} Lagi</span>
                            </div>
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter mr-2">ALL-OR-NOTHING REWARD</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Completion Modal */}
            {showModal && (
                <CompletionModal
                    campaign={campaign}
                    totalXp={claimResult?.xp || 0}
                    usdcReward={campaign.reward_amount_per_user || '0'}
                    rewardSymbol={campaign.reward_symbol || 'USDC'}
                    onClaim={handleClaim}
                    onClose={() => setShowModal(false)}
                    isClaiming={isClaiming}
                    claimed={claimed || alreadyCampaignClaimed}
                />
            )}
        </>
    );
}

export default UGCCampaignCard;
