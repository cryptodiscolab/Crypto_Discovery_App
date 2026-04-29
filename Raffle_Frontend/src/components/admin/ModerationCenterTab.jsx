import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, Clock, Trash2, RefreshCw, Ticket, Zap, AlertTriangle } from 'lucide-react';
import { useAccount, useSignMessage, useWriteContract } from 'wagmi';
import { RAFFLE_ADDRESS, RAFFLE_ABI } from '@/lib/contracts';
import toast from 'react-hot-toast';

export function ModerationCenterTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useWriteContract();
    const [pendingRaffles, setPendingRaffles] = useState([]);
    const [pendingMissions, setPendingMissions] = useState([]);
    const [activeSubTab, setActiveSubTab] = useState('raffles');
    const [loading, setLoading] = useState(false);

    // Feature Flags & Environment
    const isMainnet = import.meta.env.VITE_CHAIN_ID === '8453';

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    const fetchPending = async () => {
        if (!address) return;
        setLoading(true);
        try {
            const timestamp = new Date().toISOString();
            const message = `Fetch Moderation Queue\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            // Fetch Raffles
            const raffResponse = await fetch('/api/user/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pending-raffles', wallet: address, signature, message })
            });
            const raffData = await raffResponse.json();
            if (Array.isArray(raffData)) {
                 setPendingRaffles(raffData);
            } else if (raffData.success) {
                 setPendingRaffles(raffData.data || []);
            }

            // Fetch Missions
            const missResponse = await fetch('/api/user/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pending-missions', wallet: address, signature, message })
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

    const handleRejectRaffle = (raffle) => {
        setSelectedItem(raffle);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    const confirmReject = async () => {
        if (!selectedItem) return;
        if (!rejectionReason.trim()) {
            toast.error("Please enter a rejection reason");
            return;
        }

        setIsRejecting(true);
        const tid = toast.loading("Executing Blockchain Refund...");
        
        try {
            // 1. Contract Call: cancelRaffle
            const txHash = await writeContractAsync({
                address: RAFFLE_ADDRESS,
                abi: RAFFLE_ABI,
                functionName: 'cancelRaffle',
                args: [BigInt(selectedItem.id)],
            });

            toast.loading("Refunding... syncing with database", { id: tid });

            // 2. DB Sync
            const timestamp = new Date().toISOString();
            const message = `Reject UGC Raffle\nID: ${selectedItem.id}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/user/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reject-raffle',
                    wallet: address,
                    signature,
                    message,
                    raffle_id: selectedItem.id,
                    reason: rejectionReason,
                    txHash
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success("Raffle rejected & funds refunded!", { id: tid });
                setPendingRaffles(prev => prev.filter(r => r.id !== selectedItem.id));
                setShowRejectModal(false);
                setSelectedItem(null);
            } else {
                throw new Error(result.error || "DB Sync failed");
            }
        } catch (error) {
            console.error("Rejection Error:", error);
            toast.error(error.shortMessage || error.message || "Rejection failed", { id: tid });
        } finally {
            setIsRejecting(false);
        }
    };

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
                    wallet: address,
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

    const handleVerifyOnchain = async (missionId) => {
        const tid = toast.loading("Verifying on-chain payment...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Verify UGC Payment\nMission: ${missionId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'VERIFY_UGC_PAYMENT_ONCHAIN',
                    wallet: address,
                    signature,
                    message,
                    mission_id: missionId
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success(result.message || "Payment verified & mission activated!", { id: tid });
                setPendingMissions(prev => prev.filter(m => m.id !== missionId));
            } else {
                throw new Error(result.error || "Verification failed");
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
                    wallet: address,
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
                        Moderation Center
                    </h2>
                    <p className="admin-label !mb-0 !text-[11px] mt-1">Reviewing User-Generated Content</p>
                </div>
                <button onClick={fetchPending} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex gap-4 border-b border-white/5 pb-4 mb-8">
                <button
                    onClick={() => setActiveSubTab('raffles')}
                    className={`text-[11px] font-black uppercase tracking-widest pb-2 transition-all flex items-center gap-2 ${activeSubTab === 'raffles' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-white'}`}
                >
                    <Ticket className="w-3 h-3" /> Pending Raffles ({pendingRaffles.length})
                </button>
                <button
                    onClick={() => setActiveSubTab('missions')}
                    className={`text-[11px] font-black uppercase tracking-widest pb-2 transition-all flex items-center gap-2 ${activeSubTab === 'missions' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-white'}`}
                >
                    <Zap className="w-3 h-3" /> Pending Missions ({pendingMissions.length})
                </button>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <p className="admin-label !text-[11px]">Scanning Blockchain & DB...</p>
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
                                            <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">Raffle #{raffle.id}</span>
                                            <span className="text-[11px] font-mono text-slate-500">{new Date(raffle.created_at).toLocaleString()}</span>
                                        </div>
                                        <h3 className="text-lg font-black text-white truncate max-w-md">{raffle.title || `Raffle #${raffle.id}`}</h3>
                                        <p className="text-[11px] text-slate-500 font-mono mt-1">Creator: {raffle.creator_address}</p>
                                        <div className="flex gap-4 mt-3">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">Pool: {raffle.prize_pool || 0} ETH</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">Tickets: {raffle.max_tickets}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleApproveRaffle(raffle.id)}
                                            className="btn-native bg-emerald-600 hover:bg-emerald-500 text-white !py-2.5"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                                        </button>
                                        <button 
                                            onClick={() => handleRejectRaffle(raffle)}
                                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all"
                                            title="Reject & Refund"
                                        >
                                            <XCircle className="w-4 h-4" />
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
                                            <span className="text-[11px] font-mono text-slate-500">{new Date(mission.created_at || Date.now()).toLocaleString()}</span>
                                            {mission.is_verified_payment ? (
                                                <span className="text-[11px] font-black text-emerald-400 uppercase flex items-center gap-1">
                                                    <CheckCircle className="w-2.5 h-2.5" /> Paid
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-black text-amber-500 uppercase flex items-center gap-1">
                                                    <Clock className="w-2.5 h-2.5" /> Unverified
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-black text-white truncate max-w-md">{mission.title}</h3>
                                        <p className="text-[10px] text-slate-500 font-mono mt-1">Reward: {mission.reward_amount_per_user} {mission.reward_symbol || 'USDC'} | Participants: {mission.max_participants}</p>
                                        
                                        <div className="mt-3 flex flex-wrap gap-3">
                                            <div className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                                                <p className="admin-label !mb-1 !text-[9px]">Sponsor Wallet</p>
                                                <p className="text-[11px] text-slate-300 font-mono">{mission.sponsor_address}</p>
                                            </div>
                                            {mission.payment_tx_hash && (
                                                <div className="px-3 py-1.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                                                    <p className="admin-label !mb-1 !text-[9px] !text-indigo-400">Payment Proof (TX)</p>
                                                    <a 
                                                        href={isMainnet ? `https://basescan.org/tx/${mission.payment_tx_hash}` : `https://sepolia.basescan.org/tx/${mission.payment_tx_hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[11px] text-blue-400 font-mono hover:underline truncate block max-w-[120px]"
                                                    >
                                                        {mission.payment_tx_hash.substring(0, 10)}...{mission.payment_tx_hash.substring(54)}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        <a href={mission.link} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:underline flex items-center gap-1 mt-4 font-bold uppercase tracking-widest bg-blue-500/5 w-fit px-2 py-1 rounded">View Mission Source</a>
                                    </div>
                                    <div className="flex gap-2">
                                        {!mission.is_verified_payment ? (
                                            <button 
                                                onClick={() => handleVerifyOnchain(mission.id)}
                                                className="btn-native bg-indigo-600 hover:bg-indigo-500 text-white !py-2.5 shadow-lg shadow-indigo-500/20"
                                            >
                                                <Shield className="w-3.5 h-3.5" /> Verify Payment
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleApproveMission(mission.id)}
                                                className="btn-native bg-emerald-600 hover:bg-emerald-500 text-white !py-2.5 shadow-lg shadow-emerald-500/20"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                                            </button>
                                        )}
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

            {/* Premium Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !isRejecting && setShowRejectModal(false)} />
                    
                    <div className="relative bg-[#1a1a1f] w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        {/* Header */}
                        <div className="p-8 pb-0 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                                    <XCircle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Reject Raffle</h3>
                                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Moderation Action Required</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowRejectModal(false)}
                                className="p-2 hover:bg-white/5 rounded-xl transition-all"
                                disabled={isRejecting}
                            >
                                <Trash2 className="w-5 h-5 text-slate-600" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-6">
                            <div className="p-5 bg-white/2 rounded-3xl border border-white/5 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Target Raffle</span>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase">#{selectedItem?.id}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Refund Amount</span>
                                    <span className="text-sm font-black text-white">{selectedItem?.prize_pool || 0} ETH</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Recipient</span>
                                    <span className="text-[11px] font-mono text-slate-400">{selectedItem?.sponsor_address?.substring(0,6)}...{selectedItem?.sponsor_address?.substring(38)}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Reason for Rejection</label>
                                <textarea 
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="e.g. Inappropriate metadata or spam content..."
                                    className="w-full bg-black/40 border border-white/5 rounded-3xl p-5 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-red-500/50 transition-all min-h-[120px] resize-none"
                                    disabled={isRejecting}
                                />
                            </div>

                            <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-start gap-3">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-amber-500/80 leading-relaxed font-bold">
                                    IMPORTANT: This action will trigger an on-chain transaction to refund the ETH deposit back to the sponsor. This cannot be undone.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 pt-0 flex gap-3">
                            <button 
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest transition-all"
                                disabled={isRejecting}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmReject}
                                disabled={isRejecting || !rejectionReason.trim()}
                                className={`flex-[2] py-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${isRejecting || !rejectionReason.trim() ? 'bg-slate-800 text-slate-500' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'}`}
                            >
                                {isRejecting ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="w-3.5 h-3.5" />
                                        Reject & Refund
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-12 p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10 flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="space-y-1">
                    <p className="admin-label !mb-1 !text-amber-500">Governance Notice</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-bold">Approved content will become visible to all users across the global dashboard. Every approval action is cryptographically signed and recorded in the permanent admin audit logs.</p>
                </div>
            </div>
        </div>
    );
}
