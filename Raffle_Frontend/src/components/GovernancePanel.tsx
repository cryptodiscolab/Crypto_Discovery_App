import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ShieldCheck, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { cleanWallet } from '../utils/cleanWallet';

interface PendingMission {
    id: string | number;
    title: string;
    reward_amount: number | string;
}

export function GovernancePanel() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [pendingMissions, setPendingMissions] = useState<PendingMission[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | number | null>(null);

    const fetchPending = async () => {
        if (!address) return;
        setLoading(true);
        try {
            const timestamp = new Date().toISOString();
            const message = `Fetch Pending Missions\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });
            const res = await fetch(`/api/user-bundle?action=pending-missions&wallet=${address}&signature=${encodeURIComponent(signature)}&message=${encodeURIComponent(message)}`);
            if (res.ok) {
                const data = await res.json();
                setPendingMissions(data);
            }
        } catch (err) {
            console.error('[GovPanel] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const approveMission = async (campaignId: string | number) => {
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
                    campaign_id: campaignId,
                    signature,
                    message
                })
            });

            if (res.ok) {
                setPendingMissions(prev => prev.filter(p => p.id !== campaignId));
            }
        } catch (err) {
            console.error('[GovPanel] Approve error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    useEffect(() => {
        if (address) fetchPending();
    }, [address]);

    if (!pendingMissions || pendingMissions.length === 0) return null;

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

            <div className="space-y-3">
                {pendingMissions.map((mission) => (
                    <div key={mission.id} className="bg-zinc-900/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-white uppercase tracking-widest">{mission.title?.toUpperCase() || 'UNTITLED MISSION'}</p>
                                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">ID: {mission.id} • Reward: {mission.reward_amount} XP</p>
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
        </div>
    );
}
