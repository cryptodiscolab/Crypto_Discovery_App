import React, { useState, useEffect } from 'react';
import { Plus, Ticket, Trophy, RefreshCw, AlertCircle, Loader2, Medal } from 'lucide-react';
import { useAccount, useReadContract, usePublicClient, useSignMessage } from 'wagmi';
import {
    Transaction,
    TransactionButton,
    TransactionStatus,
    TransactionStatusLabel,
    TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';
import { encodeFunctionData } from 'viem';
import { RAFFLE_ABI, CONTRACTS } from '../../lib/contracts';
import { useRaffleList, useRaffleInfo } from '../../hooks/useRaffle';
import toast from 'react-hot-toast';

const RAFFLE_ADDRESS = import.meta.env.VITE_RAFFLE_ADDRESS || CONTRACTS?.RAFFLE || "0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08";

function AdminRaffleCreateForm() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const publicClient = usePublicClient();
    const [form, setForm] = useState({
        winnerCount: '1',
        maxTickets: '100',
        durationDays: '3',
        metadataURI: '',
    });

    const calls = [{
        to: RAFFLE_ADDRESS,
        data: encodeFunctionData({
            abi: RAFFLE_ABI,
            functionName: 'adminCreateRaffle',
            args: [
                BigInt(form.winnerCount || 1),
                BigInt(form.maxTickets || 100),
                BigInt(form.durationDays || 1),
                form.metadataURI || 'ipfs://admin-raffle'
            ],
        }),
    }];

    const handleSuccess = async () => {
        try {
            // real-time read to confirm new ID
            const currentId = await publicClient.readContract({
                address: RAFFLE_ADDRESS,
                abi: RAFFLE_ABI,
                functionName: 'currentRaffleId',
            });
            const actualId = Number(currentId);

            // Sync to Supabase for Real-Time UX
            if (address) {
                try {
                    const timestamp = new Date().toISOString();
                    const message = `Sync Admin Raffle\nID: ${actualId}\nTime: ${timestamp}`;
                    const signature = await signMessageAsync({ message });

                    await fetch('/api/admin/system/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wallet_address: address,
                            signature,
                            message,
                            action_type: 'SYNC_RAFFLE',
                            payload: {
                                raffle_id: actualId,
                                creator: address,
                                end_time: new Date(Date.now() + Number(form.durationDays) * 86400 * 1000).toISOString(),
                                max_tickets: Number(form.maxTickets),
                                metadata_uri: form.metadataURI || 'ipfs://admin-raffle'
                            }
                        })
                    });
                    toast.success(`Raffle #${actualId} synced to DB!`);
                } catch (e) {
                    console.warn("DB Sync failed:", e.message);
                }
            }

            toast.success(`Raffle #${actualId} created successfully!`);
            setForm({ winnerCount: '1', maxTickets: '100', durationDays: '3', metadataURI: '' });
        } catch (e) {
            console.error("Read currentId failed:", e);
            toast.success('Raffle created on-chain!');
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Winners</label>
                    <input type="number" min="1" max="10"
                        value={form.winnerCount}
                        onChange={e => setForm({ ...form, winnerCount: e.target.value })}
                        className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-indigo-400 font-black outline-none focus:border-indigo-500/50"
                    />
                </div>
                <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Max Tickets</label>
                    <input type="number" min="1" max="10000"
                        value={form.maxTickets}
                        onChange={e => setForm({ ...form, maxTickets: e.target.value })}
                        className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50"
                    />
                </div>
                <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Duration (Days)</label>
                    <select
                        value={form.durationDays}
                        onChange={e => setForm({ ...form, durationDays: e.target.value })}
                        className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none"
                    >
                        {[1, 2, 3, 5, 7, 14, 25].map(d => (
                            <option key={d} value={d}>{d} Day{d > 1 ? 's' : ''}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Metadata URI</label>
                    <input type="text"
                        value={form.metadataURI}
                        onChange={e => setForm({ ...form, metadataURI: e.target.value })}
                        placeholder="ipfs://... or https://..."
                        className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50"
                    />
                </div>
            </div>

            <Transaction
                calls={calls}
                onSuccess={handleSuccess}
                onError={(err) => toast.error(err.shortMessage || 'Create failed')}
            >
                <TransactionButton
                    className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                    text="DEPLOY ADMIN RAFFLE (FREE)"
                />
                <div className="mt-2 text-[10px] text-slate-500 font-mono text-center">
                    <TransactionStatus>
                        <TransactionStatusLabel />
                        <TransactionStatusAction />
                    </TransactionStatus>
                </div>
            </Transaction>
        </div>
    );
}

export function RaffleManagerTab() {
    const { raffleIds } = useRaffleList();
    const [winners, setWinners] = useState([]);
    const [loadingWinners, setLoadingWinners] = useState(false);

    const fetchWinners = async () => {
        setLoadingWinners(true);
        try {
            const res = await fetch('/api/raffle/leaderboard');
            const data = await res.json();
            if (data.success) setWinners(data.data || []);
        } catch (e) {
            console.warn('Winner fetch failed:', e.message);
        } finally {
            setLoadingWinners(false);
        }
    };

    useEffect(() => { fetchWinners(); }, []);

    return (
        <div className="space-y-6">
            {/* Create Raffle */}
            <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">Create Admin Raffle (Free)</span>
                </div>
                <p className="text-[9px] text-slate-500 px-1">Create free raffles without an ETH deposit. Rewards come from ticket revenue.</p>
                <AdminRaffleCreateForm />
            </div>

            {/* Raffle List */}
            <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter">On-Chain Raffles</span>
                    </div>
                    <span className="text-[8px] text-slate-600 font-mono">
                        Total: {raffleIds?.length ?? 0}
                    </span>
                </div>

                {!raffleIds || raffleIds.length === 0 ? (
                    <div className="py-8 text-center">
                        <Ticket className="w-6 h-6 text-slate-800 mx-auto mb-2" />
                        <p className="text-[9px] text-slate-600">No raffles found.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {[...raffleIds].reverse().map(id => (
                            <AdminRaffleRow key={id.toString()} raffleId={id} />
                        ))}
                    </div>
                )}
            </div>

            {/* 🏆 Top Raffle Winners Leaderboard */}
            <div className="bg-[#121214] p-5 rounded-2xl border border-yellow-500/10 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Medal className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-[10px] font-black text-yellow-300 uppercase tracking-tighter">Top Raffle Winners</span>
                    </div>
                    <button onClick={fetchWinners} className="p-1 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                        <RefreshCw className={`w-3 h-3 ${loadingWinners ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {loadingWinners ? (
                    <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-600" /></div>
                ) : winners.length === 0 ? (
                    <p className="text-[9px] text-slate-600 text-center py-4">No winners yet.</p>
                ) : (
                    <div className="space-y-1.5">
                        {winners.map((w, i) => (
                            <div key={w.wallet_address} className="flex items-center justify-between p-2 bg-[#0a0a0c] border border-white/5 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-500 w-4">{i + 1}</span>
                                    <span className="text-[9px] font-mono text-white">
                                        {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-4)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[8px] text-yellow-400 font-black">🎟️ {w.raffle_wins}W</span>
                                    <span className="text-[8px] text-indigo-400 font-mono">{(w.total_xp || 0).toLocaleString()} XP</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function AdminRaffleRow({ raffleId }) {
    const { raffle, isLoading, refetch } = useRaffleInfo(raffleId);
    const { drawRaffle, isDrawing } = useRaffle();

    const handleDraw = async () => {
        try {
            await drawRaffle(raffleId);
            refetch();
        } catch (e) {
            // Error handled in hook
        }
    };

    if (isLoading || !raffle) return (
        <div className="p-3 bg-[#0a0a0c] border border-white/5 rounded-xl animate-pulse">
            <div className="h-3 w-32 bg-white/5 rounded" />
        </div>
    );

    const canDraw = raffle.isActive && (raffle.totalTickets >= raffle.maxTickets || Date.now() / 1000 >= raffle.endTime);

    return (
        <div className="flex items-center justify-between p-3 bg-[#0a0a0c] border border-white/5 rounded-xl">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-white uppercase flex items-center gap-1.5">
                        <Ticket size={10} className="text-indigo-400" />
                        Raffle #{raffle.id}
                    </p>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${raffle.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {raffle.isActive ? 'LIVE' : raffle.isFinalized ? 'DONE' : 'CLOSED'}
                    </span>
                </div>
                <p className="text-[8px] text-slate-500 font-mono mt-1">
                    {Number(raffle.totalTickets || 0)}/{Number(raffle.maxTickets || 0)} tickets • {raffle.winnerCount} Winners
                </p>
            </div>

            <div className="flex items-center gap-2">
                {raffle.isActive && (
                    <button
                        onClick={handleDraw}
                        disabled={isDrawing}
                        className={`text-[9px] font-black px-3 py-1.5 rounded uppercase transition-all ${canDraw
                            ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20'
                            : 'bg-slate-800/50 text-slate-600 cursor-not-allowed opacity-50'
                            }`}
                    >
                        {isDrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Draw Winner'}
                    </button>
                )}
                {raffle.isFinalized && (
                    <Trophy size={14} className="text-yellow-500 mr-2" />
                )}
            </div>
        </div>
    );
}
