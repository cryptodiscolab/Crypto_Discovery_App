import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';
import { CheckCircle2, Loader2, Trophy, Share2, X, Zap, ExternalLink, Twitter, MessageCircle } from 'lucide-react';

// Platform display icon (text-based since we avoid external deps)
const PLATFORM_ICON = {
    farcaster: '⬣',
    twitter: '𝕏',
    tiktok: '♪',
    instagram: '◎',
    onchain: '⛓'
};

const ACTION_VERB = {
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
function CompletionModal({ campaign, totalXp, usdcReward, rewardSymbol, onClaim, onClose, isClaiming, claimed }) {
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
                        <p className="text-2xl font-black text-emerald-400 font-mono">{parseFloat(usdcReward).toFixed(2)}</p>
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
export function UGCCampaignCard({ campaign, subTasks, userClaimedTaskIds = new Set() }) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const [showModal, setShowModal] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimed, setClaimed] = useState(false);
    const [claimResult, setClaimResult] = useState(null);

    const totalTasks = subTasks.length;
    const completedCount = subTasks.filter(t => userClaimedTaskIds.has(t.id)).length;
    const allDone = completedCount === totalTasks && totalTasks > 0;
    const alreadyCampaignClaimed = userClaimedTaskIds.has(`ugc_campaign_${campaign.id}`);

    // Auto-show modal when all tasks just completed
    useEffect(() => {
        if (allDone && !alreadyCampaignClaimed) {
            setShowModal(true);
        }
    }, [allDone, alreadyCampaignClaimed]);

    const handleClaim = useCallback(async () => {
        if (!address) return toast.error('Connect wallet first.');
        setIsClaiming(true);
        const tid = toast.loading('Claiming rewards...');
        try {
            const message = `Claim UGC Campaign: ${campaign.id}\nTime: ${new Date().toISOString()}`;
            const signature = await signMessageAsync({ message });
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'claim-ugc-campaign', wallet_address: address, campaign_id: campaign.id, signature, message })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.already_claimed) {
                toast.success('Already claimed!', { id: tid });
                setClaimed(true);
                return;
            }
            setClaimResult(data);
            setClaimed(true);
            toast.success(`🎉 +${data.xp} XP & ${data.usdc_reward} ${data.reward_symbol} claimed!`, { id: tid, duration: 5000 });
        } catch (err) {
            toast.error(err.message || 'Claim failed.', { id: tid });
        } finally {
            setIsClaiming(false);
        }
    }, [address, campaign.id, signMessageAsync]);

    return (
        <>
            <div className={`glass-card rounded-[2.5rem] border overflow-hidden transition-all ${allDone ? 'border-violet-500/30 bg-violet-900/10 shadow-lg shadow-violet-500/10' : 'border-white/5 bg-slate-900/20'}`}>
                {/* Header */}
                <div className="p-6 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black transition-all ${allDone ? 'bg-violet-600/30 text-violet-300' : 'bg-white/5 text-slate-400'}`}>
                            {PLATFORM_ICON[campaign.platform_code] || '●'}
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight">{campaign.title}</h3>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{campaign.platform_code}</p>
                        </div>
                    </div>
                    {/* Progress Badge */}
                    <div className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${allDone ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                        {completedCount}/{totalTasks}
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
                        const done = userClaimedTaskIds.has(task.id);
                        return (
                            <div key={task.id} className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${done ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/3 border border-white/5'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-all ${done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] font-black uppercase tracking-widest ${done ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {ACTION_VERB[task.action_type] || task.action_type}
                                    </p>
                                </div>
                                {!done && (
                                    <a href={task.link} target="_blank" rel="noopener noreferrer"
                                       className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:bg-indigo-600/40 transition-all">
                                        Go <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
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
                        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Claimed</span>
                        </div>
                    ) : allDone ? (
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-violet-500/20 animate-pulse"
                        >
                            <Trophy className="w-4 h-4" /> CLAIM
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/5 border border-white/5">
                            <Zap className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selesaikan semua tugas</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Completion Modal */}
            {showModal && (
                <CompletionModal
                    campaign={campaign}
                    totalXp={claimResult?.xp ?? 0}
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
