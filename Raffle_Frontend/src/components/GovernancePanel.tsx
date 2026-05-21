import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ShieldCheck, Clock, RefreshCw, Inbox } from 'lucide-react';

interface PendingMission {
    id: string | number;
    title: string;
    reward_amount?: number | string;
    reward_amount_per_user?: number | string;
}

export function GovernancePanel() {
    const { address, status } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [pendingMissions, setPendingMissions] = useState<PendingMission[]>([]);
    const [actionLoading, setActionLoading] = useState<string | number | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const isUserRejectedRequest = (err: unknown) => {
        const reason = err instanceof Error ? `${err.name} ${err.message}` : String(err);
        return reason.includes('UserRejectedRequestError') || reason.includes('User rejected') || reason.includes('Request rejected');
    };

    const fetchPending = async () => {
        if (!address || status !== 'connected') return;
        setIsFetching(true);
        try {
            const timestamp = new Date().toISOString();
            const message = `Fetch Pending Missions\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });
            const res = await fetch(`/api/user-bundle?action=pending-missions&wallet=${address}&signature=${encodeURIComponent(signature)}&message=${encodeURIComponent(message)}`);
            if (res.ok) {
                const result = await res.json();
                const data = result.success ? (result.data || []) : (Array.isArray(result) ? result : []);
                setPendingMissions(data);
                setHasLoaded(true);
            }
        } catch (err) {
            if (!isUserRejectedRequest(err)) {
                console.error('[GovPanel] Fetch error:', err);
            }
        } finally {
            setIsFetching(false);
        }
    };

    const approveMission = async (campaignId: string | number) => {
        if (!address || status !== 'connected') return;
        setActionLoading(campaignId);
        try {
            const timestamp = new Date().toISOString();
            const message = `Approve Mission\nCampaign: ${campaignId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });
            const res = await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve-mission',
                    wallet_address: address,
                    wallet: address,
                    mission_id: campaignId,
                    signature,
                    message
                })
            });

            if (res.ok) {
                setPendingMissions(prev => prev.filter(p => p.id !== campaignId));
            }
        } catch (err) {
            if (!isUserRejectedRequest(err)) {
                console.error('[GovPanel] Approve error:', err);
            }
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-400">
                    <ShieldCheck className="w-5 h-5" />
                    <h3 className="font-black uppercase tracking-widest text-[11px]">Governance Moderation</h3>
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest bg-indigo-500/20 px-2.5 py-1 rounded-full text-indigo-400">
                    {pendingMissions.length} Pending
                </span>
            </div>

            <div className="flex items-center justify-between gap-3 bg-zinc-900/40 border border-white/5 p-4 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center shrink-0">
                        <Inbox className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-black text-white uppercase tracking-widest">Moderation Queue</p>
                        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">
                            {hasLoaded ? 'Signature-verified admin queue' : 'Click to load pending missions'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchPending}
                    disabled={isFetching || status !== 'connected'}
                    className="btn-primary py-2 px-4 text-[11px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 min-w-[100px] transition-all disabled:opacity-50"
                >
                    {isFetching ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : 'LOAD'}
                </button>
            </div>

            {hasLoaded && pendingMissions.length === 0 && (
                <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl">
                    <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">NO PENDING MISSIONS</p>
                </div>
            )}

            {pendingMissions.length > 0 && (
                <div className="space-y-3">
                    {pendingMissions.map((mission) => (
                        <div key={mission.id} className="bg-zinc-900/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black text-white uppercase tracking-widest">{mission.title?.toUpperCase() || 'UNTITLED MISSION'}</p>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">ID: {mission.id} • Reward: {mission.reward_amount_per_user ?? mission.reward_amount ?? 0} XP</p>
                                </div>
                            </div>
                            <button
                                onClick={() => approveMission(mission.id)}
                                disabled={actionLoading === mission.id}
                                className="btn-primary py-2 px-4 text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 min-w-[100px] transition-all"
                            >
                                {actionLoading === mission.id ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : 'APPROVE'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
