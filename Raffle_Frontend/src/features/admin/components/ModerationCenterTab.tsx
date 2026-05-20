import { useState, useEffect } from 'react';
import { Shield, XCircle, Trash2, RefreshCw, Ticket, Zap, AlertTriangle } from 'lucide-react';
import { useAccount, useChainId, useSignMessage, useWriteContract } from 'wagmi';
import { RAFFLE_ADDRESS, RAFFLE_ABI } from '../../../lib/contracts';
import { usePendingSyncRecovery } from '../../../hooks/usePendingSyncRecovery';
import toast from 'react-hot-toast';

interface Raffle {
    id: number | string;
    title: string;
    creator_address: string;
    prize_pool: string | number;
    max_tickets: number;
    created_at: string;
    sponsor_address?: string;
}

interface Mission {
    id: number | string;
    title: string;
    created_at?: string;
    is_verified_payment: boolean;
    reward_amount_per_user: string | number;
    reward_symbol?: string;
    listing_fee?: string | number;
    max_participants: number | string;
    sponsor_address: string;
    payment_tx_hash?: string;
    link: string;
}

export function ModerationCenterTab() {
    const { address } = useAccount();
    const chainId = useChainId();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useWriteContract();
    const { recordFailure: recordPendingSync } = usePendingSyncRecovery();
    const [pendingRaffles, setPendingRaffles] = useState<Raffle[]>([]);
    const [pendingMissions, setPendingMissions] = useState<Mission[]>([]);
    const [activeSubTab, setActiveSubTab] = useState('raffles');
    const [loading, setLoading] = useState(false);

    // Feature Flags & Environment
    const isMainnet = import.meta.env.VITE_CHAIN_ID === '8453';

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Raffle | null>(null);
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
            const raffResponse = await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pending-raffles', wallet: address, signature, message })
            });
            if (!raffResponse.ok) throw new Error(`Fetch pending raffles failed: ${raffResponse.status}`);
            const raffData = await raffResponse.json();
            if (Array.isArray(raffData)) {
                 setPendingRaffles(raffData);
            } else if (raffData.success) {
                 setPendingRaffles(raffData.data || []);
            }

            // Fetch Missions
            const missResponse = await fetch('/api/user-bundle', {
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

    const handleRejectRaffle = (raffle: Raffle) => {
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
        let txHash: `0x${string}` | undefined;

        try {
            // 1. Contract Call: cancelRaffle
            txHash = await writeContractAsync({
                address: RAFFLE_ADDRESS as `0x${string}`,
                abi: RAFFLE_ABI,
                functionName: 'cancelRaffle',
                args: [BigInt(selectedItem.id)],
            });

            toast.loading("Refunding... syncing with database", { id: tid });

            // 2. DB Sync
            const timestamp = new Date().toISOString();
            const message = `Reject UGC Raffle\nID: ${selectedItem.id}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/user-bundle', {
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
        } catch (error: unknown) {
            console.error("Rejection Error:", error);
            const err = error as { shortMessage?: string; message?: string };
            const errMsg = err.shortMessage || err.message || "Rejection failed";
            if (txHash) {
                recordPendingSync({
                    actionType: 'raffle_reject',
                    txHash,
                    chainId,
                    contractAddress: RAFFLE_ADDRESS,
                    payload: {
                        raffle_id: selectedItem.id,
                        reason: rejectionReason
                    },
                    errorMessage: errMsg
                }).catch(() => {});
                toast.error("Refund succeeded on-chain. DB sync pending — will retry automatically.", { id: tid, duration: 10000 });
            } else {
                toast.error(errMsg, { id: tid });
            }
        } finally {
            setIsRejecting(false);
        }
    };

    const handleApproveRaffle = async (raffleId: number | string) => {
        const tid = toast.loading("Approving raffle...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Approve UGC Raffle\nID: ${raffleId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/user-bundle', {
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
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast.error(err.message || "Approval failed", { id: tid });
        }
    };

    const handleVerifyOnchain = async (missionId: number | string) => {
        const tid = toast.loading("Verifying on-chain payment...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Verify UGC Payment\nMission: ${missionId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin-bundle', {
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
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast.error(err.message || "Verification failed", { id: tid });
        }
    };

    const handleRejectMission = async (mission: Mission) => {
        if (!window.confirm('Reject this mission? Funds will need manual refund.')) return;
        const tid = toast.loading("Rejecting mission...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Reject Mission ${mission.id}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject-mission', mission_id: mission.id, wallet_address: address, signature, message })
            });

            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Rejection failed');
            toast.success("Mission rejected!", { id: tid });
            fetchPending();
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast.error(err.message || "Rejection failed", { id: tid });
        }
    };

    const handleApproveMission = async (missionId: number | string) => {
        const tid = toast.loading("Approving mission...");
        try {
            const timestamp = new Date().toISOString();
            const message = `Approve UGC Mission\nID: ${missionId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/user-bundle', {
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
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast.error(err.message || "Approval failed", { id: tid });
        }
    };

    return (
        <div className="space-y-6 max-w-[100vw] overflow-x-hidden">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        Moderation Center
                    </h2>
                    <p className="label-native text-slate-500 mt-2">Reviewing User-Generated Content</p>
                </div>
                <button onClick={fetchPending} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex gap-4 border-b border-white/5 pb-4 mb-8">
                <button
                    onClick={() => setActiveSubTab('raffles')}
                    className={`pb-2 transition-all flex items-center gap-2 label-native ${activeSubTab === 'raffles' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-white'}`}
                >
                    <Ticket className="w-3 h-3" /> Pending Raffles ({pendingRaffles.length})
                </button>
                <button
                    onClick={() => setActiveSubTab('missions')}
                    className={`pb-2 transition-all flex items-center gap-2 label-native ${activeSubTab === 'missions' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-white'}`}
                >
                    <Zap className="w-3 h-3" /> Pending Missions ({pendingMissions.length})
                </button>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <p className="label-native text-slate-500">Scanning Blockchain & DB...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {activeSubTab === 'raffles' && (
                        pendingRaffles.length === 0 ? (
                            <div className="py-20 text-center bg-white/2 rounded-3xl border border-dashed border-white/5">
                                <Ticket className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-30" />
                                <p className="label-native text-slate-600">No pending raffles</p>
                            </div>
                        ) : (
                            pendingRaffles.map(raffle => (
                                <div key={raffle.id} className="bg-[#121214] p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-indigo-500/30 transition-all">
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="label-native text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">Raffle #{raffle.id}</span>
                                            <span className="label-native font-mono text-slate-500">{new Date(raffle.created_at).toLocaleString()}</span>
                                        </div>
                                        <h3 className="value-native text-white truncate max-w-md">{raffle.title || `Raffle #${raffle.id}`}</h3>
                                        <p className="label-native text-slate-500 font-mono mt-1">Creator: {raffle.creator_address}</p>
                                        <div className="flex gap-4 mt-3">
                                            <div className="label-native text-slate-400">Pool: {raffle.prize_pool || 0} ETH</div>
                                            <div className="label-native text-slate-400">Tickets: {raffle.max_tickets}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApproveRaffle(raffle.id)}
                                            className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl label-native transition-all active:scale-[0.98] disabled:opacity-30"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleRejectRaffle(raffle)}
                                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all"
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
                                <Zap className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-30" />
                                <p className="label-native text-slate-600">No pending missions</p>
                            </div>
                        ) : (
                            pendingMissions.map(mission => (
                                <div key={mission.id} className="bg-[#121214] p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-purple-500/30 transition-all">
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="label-native text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">UGC Mission</span>
                                            <span className="label-native font-mono text-slate-500">{new Date(mission.created_at || Date.now()).toLocaleString()}</span>
                                            {mission.is_verified_payment ? (
                                                <span className="label-native text-emerald-400">
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="label-native text-amber-500">
                                                    Unverified
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="value-native text-white truncate max-w-md">{mission.title}</h3>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                            <p className="label-native text-slate-500 font-mono">
                                                Reward: <span className="text-purple-400">{mission.reward_amount_per_user}</span> {mission.reward_symbol || 'USDC'}
                                            </p>
                                            {mission.listing_fee && (
                                                <p className="label-native text-slate-500 font-mono">
                                                    Fee: <span className="text-indigo-400">{mission.listing_fee}</span> {mission.reward_symbol || 'USDC'}
                                                </p>
                                            )}
                                            <p className="label-native text-slate-500 font-mono">
                                                Users: <span className="text-slate-300">{mission.max_participants}</span>
                                            </p>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-3">
                                            <div className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                                                <p className="label-native text-slate-500 mb-1">Sponsor Wallet</p>
                                                <p className="label-native text-slate-300 font-mono">{mission.sponsor_address}</p>
                                            </div>
                                            {mission.payment_tx_hash && (
                                                <div className="px-3 py-1.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                                                    <p className="label-native text-indigo-400 mb-1">Payment Proof (TX)</p>
                                                    <a
                                                        href={isMainnet ? `https://basescan.org/tx/${mission.payment_tx_hash}` : `https://sepolia.basescan.org/tx/${mission.payment_tx_hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="label-native text-blue-400 font-mono hover:underline truncate block max-w-[120px]"
                                                    >
                                                        {mission.payment_tx_hash.substring(0, 10)}...{mission.payment_tx_hash.substring(54)}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        <a href={mission.link} target="_blank" rel="noopener noreferrer" className="label-native text-blue-400 hover:underline flex items-center gap-1 mt-4 bg-blue-500/5 w-fit px-2.5 py-1 rounded-lg">View Mission Source</a>
                                    </div>
                                    <div className="flex gap-2">
                                        {!mission.is_verified_payment ? (
                                            <button
                                                onClick={() => handleVerifyOnchain(mission.id)}
                                                className="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30"
                                            >
                                                Verify Payment
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleApproveMission(mission.id)}
                                                className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl label-native transition-all active:scale-[0.98] disabled:opacity-30 animate-in fade-in"
                                            >
                                                Approve
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRejectMission(mission)}
                                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all"
                                        >
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
                                    <h3 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">Reject Raffle</h3>
                                    <p className="label-native text-slate-500 mt-2">Moderation Action Required</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="p-2 hover:bg-white/5 rounded-xl transition-all"
                                disabled={isRejecting}
                            >
                                <XCircle className="w-5 h-5 text-slate-600" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-6">
                            <div className="p-5 bg-white/2 rounded-3xl border border-white/5 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="label-native text-slate-500">Target Raffle</span>
                                    <span className="label-native text-indigo-400">#{selectedItem?.id}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="label-native text-slate-500">Refund Amount</span>
                                    <span className="text-[12px] font-black text-white">{selectedItem?.prize_pool || 0} ETH</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                    <span className="label-native text-slate-500">Recipient</span>
                                    <span className="label-native text-slate-400 font-mono">{selectedItem?.sponsor_address?.substring(0,6)}...{selectedItem?.sponsor_address?.substring(38)}</span>
                                </div>
                            </div>

                            <div className="space-y-2 text-left">
                                <label className="label-native text-slate-500 ml-2">Reason for Rejection</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="e.g. Inappropriate metadata or spam content..."
                                    className="w-full bg-black/40 border border-white/5 rounded-3xl p-5 value-native text-white placeholder:text-slate-700 focus:outline-none focus:border-red-500/50 transition-all min-h-[120px] resize-none"
                                    disabled={isRejecting}
                                />
                            </div>

                            <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-start gap-3 text-left">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="label-native text-amber-500/80 leading-relaxed">
                                    IMPORTANT: This action will trigger an on-chain transaction to refund the ETH deposit back to the sponsor. This cannot be undone.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 pt-0 flex gap-3">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white label-native transition-all active:scale-[0.98]"
                                disabled={isRejecting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReject}
                                disabled={isRejecting || !rejectionReason.trim()}
                                className={`flex-[2] py-4 rounded-2xl flex items-center justify-center gap-2 label-native transition-all active:scale-[0.98] border border-red-500/30 ${isRejecting || !rejectionReason.trim() ? 'bg-[#121214] text-slate-500 border-none' : 'bg-red-600/20 hover:bg-red-600/30 text-red-400'}`}
                            >
                                {isRejecting ? "Processing..." : "Reject & Refund"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-12 p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10 flex items-start gap-4 text-left">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="space-y-1">
                    <p className="label-native text-amber-500">Governance Notice</p>
                    <p className="label-native text-slate-500 leading-relaxed">Approved content will become visible to all users across the global dashboard. Every approval action is cryptographically signed and recorded in the permanent admin audit logs.</p>
                </div>
            </div>
        </div>
    );
}
