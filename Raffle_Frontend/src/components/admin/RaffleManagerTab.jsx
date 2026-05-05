import React, { useState, useEffect } from 'react';
import { Plus, Ticket, Trophy, RefreshCw, AlertCircle, Loader2, Medal, Users, Clock, ArrowRight } from 'lucide-react';
import { useAccount, useReadContract, usePublicClient, useSignMessage } from 'wagmi';
import { AdminTransactionButton } from './AdminTransactionButton';
import { encodeFunctionData } from 'viem';
import { RAFFLE_ABI, CONTRACTS } from '../../lib/contracts';
import { useRaffleList, useRaffleInfo, useRaffle } from '../../hooks/useRaffle';
import toast from 'react-hot-toast';

const RAFFLE_ADDRESS = import.meta.env.VITE_RAFFLE_ADDRESS || CONTRACTS?.RAFFLE || "0xE7CB85c307f1c368DCB9FFcfa5f3e02324eaf1f3";

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
        abi: RAFFLE_ABI,
        functionName: 'adminCreateRaffle',
        args: [
            BigInt(form.winnerCount || 1),
            BigInt(form.maxTickets || 100),
            BigInt(form.durationDays || 1),
            form.metadataURI || 'ipfs://admin-raffle'
        ],
    }];

    const handleSuccess = async () => {
        try {
            const currentId = await publicClient.readContract({
                address: RAFFLE_ADDRESS,
                abi: RAFFLE_ABI,
                functionName: 'currentRaffleId',
            });
            const actualId = Number(currentId);

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
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Winner Distribution</label>
                    <div className="relative group">
                        <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500/50 group-focus-within:text-indigo-400 transition-colors" />
                        <input type="number" min="1" max="50"
                            value={form.winnerCount}
                            onChange={e => setForm({ ...form, winnerCount: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white font-black outline-none focus:border-indigo-500/50 transition-all"
                            placeholder="Count"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Ticket Capacity</label>
                    <div className="relative group">
                        <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50 group-focus-within:text-emerald-400 transition-colors" />
                        <input type="number" min="1" max="100000"
                            value={form.maxTickets}
                            onChange={e => setForm({ ...form, maxTickets: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white font-black outline-none focus:border-emerald-500/50 transition-all"
                            placeholder="Capacity"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Campaign Duration</label>
                    <div className="relative group">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/50 group-focus-within:text-amber-400 transition-colors" />
                        <select
                            value={form.durationDays}
                            onChange={e => setForm({ ...form, durationDays: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white font-black outline-none appearance-none focus:border-amber-500/50 transition-all cursor-pointer"
                        >
                            {[1, 2, 3, 5, 7, 14, 25, 30].map(d => (
                                <option key={d} value={d} className="bg-[#0a0a0c]">{d} Day{d > 1 ? 's' : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Prize Metadata (JSON)</label>
                    <div className="relative group">
                        <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-white transition-colors" />
                        <input type="text"
                            value={form.metadataURI}
                            onChange={e => setForm({ ...form, metadataURI: e.target.value })}
                            placeholder="ipfs://... (Prize details)"
                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white font-mono focus:border-white/20 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            <AdminTransactionButton 
                calls={calls} 
                onSuccess={handleSuccess}
                text="INITIALIZE ON-CHAIN RAFFLE"
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 py-5 rounded-[2rem] text-white text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all"
            />
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Create Raffle */}
                <div className="glass-card p-8 bg-indigo-950/10 border-indigo-500/10 rounded-[2.5rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
                        <Plus className="w-48 h-48 text-indigo-500" />
                    </div>
                    
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                            <Plus className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-widest leading-none">CREATE <span className="text-indigo-500">ADMIN RAFFLE</span></h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Free deployment • No ETH required</p>
                        </div>
                    </div>
                    
                    <AdminRaffleCreateForm />
                </div>

                {/* Raffle List */}
                <div className="glass-card p-8 bg-slate-900/10 border-white/5 rounded-[2.5rem]">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-600/20 flex items-center justify-center border border-amber-500/30">
                                <Trophy className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-widest leading-none">ON-CHAIN <span className="text-amber-500">RAFFLES</span></h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Live management & Winners</p>
                            </div>
                        </div>
                        <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL: {raffleIds?.length ?? 0}</span>
                        </div>
                    </div>

                    {!raffleIds || raffleIds.length === 0 ? (
                        <div className="py-20 text-center glass-card bg-white/2 border-white/5 rounded-3xl">
                            <Ticket className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No raffles found in contract.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {[...raffleIds].reverse().map(id => (
                                <AdminRaffleRow key={id.toString()} raffleId={id} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Leaderboard Sidebar */}
            <div className="space-y-8">
                <div className="glass-card p-8 bg-yellow-500/5 border-yellow-500/10 rounded-[2.5rem] sticky top-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Medal className="w-5 h-5 text-yellow-400" />
                            <h3 className="text-sm font-black text-yellow-300 uppercase tracking-widest">TOP WINNERS</h3>
                        </div>
                        <button onClick={fetchWinners} className={`p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all ${loadingWinners ? 'animate-spin' : ''}`}>
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {loadingWinners ? (
                        <div className="py-12 flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-yellow-500/20" />
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">Querying Indexer...</span>
                        </div>
                    ) : winners.length === 0 ? (
                        <div className="py-12 text-center opacity-30">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No winners recorded.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {winners.map((w, i) => (
                                <div key={w.wallet_address} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-yellow-500/20 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-900 text-slate-500'}`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-mono text-white group-hover:text-yellow-400 transition-colors">
                                                {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-4)}
                                            </span>
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">WIN STREAK: {w.streak_count || 0}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-yellow-400 font-black">🏆 {w.raffle_wins} WINS</span>
                                        <span className="text-[9px] text-indigo-400 font-mono">{(w.total_xp || 0).toLocaleString()} XP</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function WinnersPanel({ winners, raffleId }) {
    if (!winners || winners.length === 0) return null;
    const zeroAddr = '0x0000000000000000000000000000000000000000';
    const realWinners = winners.filter(w => w && w !== zeroAddr);
    if (realWinners.length === 0) return null;

    return (
        <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-2xl space-y-2">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Trophy size={12} /> RAFFLE #{raffleId} WINNERS
            </p>
            {realWinners.map((w, i) => (
                <div key={w} className="flex items-center gap-3 p-2.5 bg-black/40 rounded-xl border border-emerald-500/10">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0 ${
                        i === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'
                    }`}>{i === 0 ? '🏆' : `#${i + 1}`}</div>
                    <a
                        href={`https://sepolia.basescan.org/address/${w}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-emerald-300 hover:text-emerald-200 transition-colors truncate"
                    >
                        {w.slice(0, 10)}...{w.slice(-8)}
                    </a>
                </div>
            ))}
        </div>
    );
}

function AdminRaffleRow({ raffleId }) {
    const { raffle, isLoading, refetch } = useRaffleInfo(raffleId);
    const { drawRaffle, isDrawing } = useRaffle();
    const [drawPending, setDrawPending] = useState(false);
    const publicClient = usePublicClient();

    const handleDraw = async () => {
        try {
            setDrawPending(true);
            const hash = await drawRaffle(raffleId);

            // Wait for tx confirmation
            if (hash && publicClient) {
                toast.loading('Menunggu konfirmasi on-chain...', { id: 'draw-confirm' });
                await publicClient.waitForTransactionReceipt({ hash });
                toast.success('Draw request confirmed! Menunggu QRNG callback...', { id: 'draw-confirm' });
            }

            // Poll until raffle is finalized (Airnode callback can take 30-120s)
            let attempts = 0;
            const poll = setInterval(async () => {
                await refetch();
                attempts++;
                if (attempts >= 30) {
                    clearInterval(poll);
                    setDrawPending(false);
                    toast('QRNG masih diproses. Refresh manual jika perlu.', { icon: '⏳' });
                }
            }, 4000);

            // Watch raffle.isFinalized via refetch
            const stopWhenDone = setInterval(async () => {
                const result = await refetch();
                if (result?.data?.isFinalized) {
                    clearInterval(stopWhenDone);
                    clearInterval(poll);
                    setDrawPending(false);
                    toast.success('🏆 Pemenang telah ditentukan!', { duration: 6000 });
                }
            }, 4000);

        } catch (e) {
            console.error("Draw error:", e);
            setDrawPending(false);
        }
    };

    if (isLoading || !raffle) return (
        <div className="p-6 bg-white/2 border border-white/5 rounded-3xl animate-pulse">
            <div className="h-4 w-32 bg-white/5 rounded-full mb-3" />
            <div className="h-3 w-48 bg-white/5 rounded-full" />
        </div>
    );

    const canDraw = raffle.isActive && (raffle.totalTickets >= raffle.maxTickets || Date.now() / 1000 >= raffle.endTime);
    const isQrngPending = !raffle.isActive && !raffle.isFinalized;
    const timeLeft = Math.max(0, Number(raffle.endTime) - Date.now() / 1000);
    const hoursLeft = Math.floor(timeLeft / 3600);

    return (
        <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-black/40 border border-white/5 rounded-[2rem] hover:border-indigo-500/20 transition-all gap-4">
            <div className="flex items-center gap-5 flex-1 w-full">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 relative">
                    <Ticket className="w-6 h-6 text-indigo-400" />
                    <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-lg shadow-lg">
                        #{raffle.id}
                    </div>
                </div>

                <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">PRIZE RAFFLE</h4>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${raffle.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                            {raffle.isActive ? 'ACTIVE' : raffle.isFinalized ? 'FINALIZED' : 'CLOSED'}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                        <span className="flex items-center gap-1.5"><Users size={12} className="text-slate-700" /> {Number(raffle.totalTickets || 0)} / {Number(raffle.maxTickets || 0)} PARTICIPANTS</span>
                        <span className="flex items-center gap-1.5"><Trophy size={12} className="text-slate-700" /> {raffle.winnerCount} WINNERS SELECTED</span>
                        {raffle.isActive && (
                            <span className="flex items-center gap-1.5 text-amber-500/60"><Clock size={12} /> {hoursLeft}H REMAINING</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full md:w-auto">
                {raffle.isActive ? (
                    <button
                        onClick={handleDraw}
                        disabled={isDrawing || drawPending || !canDraw}
                        className={`relative w-full md:w-auto px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                            canDraw && !drawPending
                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 hover:scale-105'
                            : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                        }`}
                    >
                        {(isDrawing || drawPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <>DRAW WINNERS <ArrowRight className="w-4 h-4" /></>
                        )}
                        {canDraw && !isDrawing && !drawPending && <div className="absolute inset-0 rounded-2xl border-2 border-amber-400 animate-ping opacity-20 pointer-events-none" />}
                    </button>
                ) : isQrngPending || drawPending ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
                        <Loader2 size={14} className="animate-spin" /> QRNG PENDING...
                    </div>
                ) : raffle.isFinalized ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                        <Trophy size={14} /> FINALIZED
                    </div>
                ) : (
                    <div className="px-6 py-3 bg-slate-800/30 border border-white/5 rounded-2xl text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        CLOSED
                    </div>
                )}
            </div>
        </div>
        {/* Winners Panel — tampil setelah QRNG callback selesai */}
        {raffle.isFinalized && raffle.winners && raffle.winners.length > 0 && (
            <WinnersPanel winners={raffle.winners} raffleId={raffle.id} />
        )}
    </div>
    );
}
