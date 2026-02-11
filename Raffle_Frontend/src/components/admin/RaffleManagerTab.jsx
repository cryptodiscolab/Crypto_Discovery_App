import React, { useState } from 'react';

import { Plus, Ticket, Timer, Trophy, ExternalLink, RefreshCw, Send, AlertCircle } from 'lucide-react';
import { useRaffle } from '../../hooks/useRaffle';
import { useReadContract } from 'wagmi';
import { RAFFLE_ABI } from '../../shared/constants/abis';
import toast from 'react-hot-toast';

const RAFFLE_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

export function RaffleManagerTab() {
    const { createRaffle, drawRaffle, isDrawing } = useRaffle();
    const [isCreating, setIsCreating] = useState(false);

    // Create Raffle Form State
    const [formData, setFormData] = useState({
        nftAddress: '',
        tokenId: '',
        duration: 86400, // 24 hours default
    });

    // Fetch Total Raffles to list them
    const { data: totalRaffles, refetch: refetchCount } = useReadContract({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: 'raffleIdCounter',
    });

    const handleCreate = async () => {
        if (!formData.nftAddress || !formData.tokenId) {
            toast.error("NFT Address and Token ID are required");
            return;
        }

        setIsCreating(true);
        const tid = toast.loading("Creating raffle on blockchain...");
        try {
            const hash = await createRaffle(
                [formData.nftAddress],
                [BigInt(formData.tokenId)],
                formData.duration
            );
            toast.success("Raffle Created Successfully!", { id: tid });
            if (hash) toast(`TX Hash: ${hash.slice(0, 10)}...`, { duration: 5000 });
            setFormData({ nftAddress: '', tokenId: '', duration: 86400 });
            refetchCount();
        } catch (e) {
            toast.error(e.shortMessage || "Creation failed", { id: tid });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Create Raffle Section */}
            <div className="glass-card p-8 bg-indigo-950/10 border border-indigo-500/10">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Plus className="w-6 h-6 text-indigo-500" /> Create New Raffle
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">NFT Contract Address</label>
                        <input
                            value={formData.nftAddress}
                            onChange={(e) => setFormData({ ...formData, nftAddress: e.target.value })}
                            placeholder="0x..."
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Token ID</label>
                        <input
                            type="number"
                            value={formData.tokenId}
                            onChange={(e) => setFormData({ ...formData, tokenId: e.target.value })}
                            placeholder="1"
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Duration (Seconds)</label>
                        <select
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none"
                        >
                            <option value={3600}>1 Hour</option>
                            <option value={28800}>8 Hours</option>
                            <option value={86400}>24 Hours (1 Day)</option>
                            <option value={259200}>72 Hours (3 Days)</option>
                            <option value={604800}>1 Week</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleCreate}
                            disabled={isCreating}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 p-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Create Raffle
                        </button>
                    </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200/70 leading-relaxed">
                        <strong>Note:</strong> Pastikan Anda sudah memberikan approval (Approve) NFT dari contract NFT tersebut ke contract Raffle ini sebelum pembuatan, supaya contract bisa mentransfer hadiah NFT nantinya.
                    </p>
                </div>
            </div>

            {/* Raffle List Placeholder */}
            <div className="glass-card p-8 bg-slate-900/40">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" /> Active & Past Raffles
                    </h3>
                    <div className="bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        Total: {totalRaffles ? totalRaffles.toString() : '0'}
                    </div>
                </div>

                <div className="space-y-4">
                    {totalRaffles === 0n ? (
                        <div className="text-center py-12 text-slate-500">
                            <Ticket className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p>No raffles found on-chain.</p>
                        </div>
                    ) : (
                        <p className="text-center py-4 text-xs text-slate-500 italic">
                            Syncing with blockchain events... List functionality coming in next sub-task.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
