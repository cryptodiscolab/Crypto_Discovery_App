import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, Clock, Trash2, RefreshCw, Ticket, Zap, AlertTriangle } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';

export function ModerationCenterTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [pendingRaffles, setPendingRaffles] = useState([]);
    const [pendingMissions, setPendingMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState('raffles');

    const fetchPending = async () => {
        setLoading(true);
        try {
            // Fetch Raffles
            const raffResponse = await fetch('/api/user/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pending-raffles', wallet_address: address })
            });
            const raffData = await raffResponse.json();
            if (raffData.success) setPendingRaffles(raffData.data || []);

            // Fetch Missions (Assuming endpoint exists or using similar logic)
            const missResponse = await fetch('/api/user/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pending-missions', wallet_address: address })
            });
            const missData = await missResponse.json();
            if (missData.success) setPendingMissions(missData.data || []);

        } catch (error) {
            console.error('Fetch pending failed:', error);
            toast.error("Failed to load moderation queue");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (address) fetchPending();
    }, [address]);

    const handleApproveRaffle = async (raffleId) => {
        const tid = toast.loading("Approving raffle...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Approve UGC Raffle\nID: ${raffleId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/user/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve-raffle',
                    wallet_address: address,
                    signature,
                    message,
                    raffle_id: raffleId
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success("Raffle approved & live!", { id: tid });
                setPendingRaffles(prev => prev.filter(r => r.id !== raffleId));
            } else {
                throw new Error(result.error || "Approval failed");
            }
        } catch (error) {
            toast.error(error.message, { id: tid });
        }
    };

    const handleApproveMission = async (missionId) => {
        const tid = toast.loading("Approving mission...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Approve UGC Mission\nID: ${missionId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/user/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve-mission',
                    wallet_address: address,
                    signature,
                    message,
                    mission_id: missionId
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success("Mission approved & live!", { id: tid });
                setPendingMissions(prev => prev.filter(m => m.id !== missionId));
            } else {
                throw new Error(result.error || "Approval failed");
            }
        } catch (error) {
            toast.error(error.message, { id: tid });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        UGC Moderation Center
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Reviewing User-Generated Content</p>
                </div>
                <button onClick={fetchPending} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex gap-4 border-b border-white/5 pb-4 mb-8">
                <button
                    onClick={() => setActiveSubTab('raffles')}
                    className={`text-xs font-black uppercase tracking-widest pb-2 transition-all flex items-center gap-2 ${activeSubTab === 'raffles' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-white'}`}
                >
                    <Ticket className="w-3 h-3" /> Pending Raffles ({pendingRaffles.length})
                </button>
                <button
                    onClick={() => setActiveSubTab('missions')}
                    className={`text-xs font-black uppercase tracking-widest pb-2 transition-all flex items-center gap-2 ${activeSubTab === 'missions' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-white'}`}
                >
                    <Zap className="w-3 h-3" /> Pending Missions ({pendingMissions.length})
                </button>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Scanning Blockchain & DB...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {activeSubTab === 'raffles' && (
                        pendingRaffles.length === 0 ? (
                            <div className="py-20 text-center bg-white/2 rounded-3xl border border-dashed border-white/5">
                                <Ticket className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                <p className="text-xs text-slate-600 font-bold uppercase">No pending raffles</p>
                            </div>
                        ) : (
                            pendingRaffles.map(raffle => (
                                <div key={raffle.id} className="bg-[#121214] p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-indigo-500/30 transition-all">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">UGC Raffle #{raffle.id}</span>
                                            <span className="text-[10px] font-mono text-slate-500">{new Date(raffle.created_at).toLocaleString()}</span>
                                        </div>
                                        <h3 className="text-lg font-black text-white truncate max-w-md">Metadata: {raffle.metadata_uri}</h3>
                                        <p className="text-[10px] text-slate-500 font-mono mt-1">Creator: {raffle.creator_address}</p>
                                        <div className="flex gap-4 mt-3">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">Tickets: {raffle.max_tickets}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">Winners: {raffle.winner_count}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleApproveRaffle(raffle.id)}
                                            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" /> Approve & Go Live
                                        </button>
                                        <button className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}

                    {activeSubTab === 'missions' && (
                        pendingMissions.length === 0 ? (
                            <div className="py-20 text-center bg-white/2 rounded-3xl border border-dashed border-white/5">
                                <Zap className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                <p className="text-xs text-slate-600 font-bold uppercase">No pending missions</p>
                            </div>
                        ) : (
                            pendingMissions.map(mission => (
                                <div key={mission.id} className="bg-[#121214] p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-purple-500/30 transition-all">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-[10px] font-black text-purple-400 uppercase bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">UGC Mission</span>
                                            <span className="text-[10px] font-mono text-slate-500">{new Date(mission.created_at || Date.now()).toLocaleString()}</span>
                                        </div>
                                        <h3 className="text-lg font-black text-white truncate max-w-md">{mission.title}</h3>
                                        <p className="text-[10px] text-slate-500 font-mono mt-1">Reward: {mission.reward_points} XP | Platform: {mission.platform}</p>
                                        <a href={mission.link} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:underline flex items-center gap-1 mt-2 font-bold uppercase tracking-widest">View Source Link</a>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleApproveMission(mission.id)}
                                            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" /> Approve & Go Live
                                        </button>
                                        <button className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            )}

            <div className="mt-12 p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10 flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="space-y-1">
                    <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest font-mono">Goverance Notice</p>
                    <p className="text-[9px] text-slate-500 leading-relaxed font-bold">Approved content will become visible to all users across the global dashboard. Every approval action is cryptographically signed and recorded in the permanent admin audit logs.</p>
                </div>
            </div>
        </div>
    );
}
