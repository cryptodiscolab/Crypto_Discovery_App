import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useReadContract, usePublicClient, useSignMessage } from 'wagmi';
import { AdminTransactionButton } from './AdminTransactionButton';
import { RAFFLE_ABI, CONTRACTS } from '../../../lib/contracts';
import { useRaffle } from '../../../hooks/useRaffle';
import { useRaffleInfo } from '../../raffle/hooks/useRaffleQueries';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabaseClient';
import { useAdminRaffleQueries } from '../hooks/useAdminQueries';
import { Clock, Loader2, Medal, RefreshCw, ShieldCheck, Ticket, Trophy, Users, Plus } from 'lucide-react';

const RAFFLE_ADDRESS = import.meta.env.VITE_RAFFLE_ADDRESS || CONTRACTS?.RAFFLE;

interface AdminRaffleCreateFormProps {
    syncRaffle: (_payload: {
        wallet_address: `0x${string}`;
        signature: string;
        message: string;
        action_type: 'SYNC_RAFFLE';
        payload: Record<string, unknown>;
    }) => Promise<void>;
}

function AdminRaffleCreateForm({ syncRaffle }: AdminRaffleCreateFormProps) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const publicClient = usePublicClient();
    const [form, setForm] = useState({
        winnerCount: '1',
        maxTickets: '100',
        durationDays: '3',
        metadataURI: '',
        title: '',
        description: '',
        image_url: '',
        external_link: '',
        twitter_link: '',
        min_sbt_level: '0',
        is_base_social_required: true
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
            if (!publicClient) throw new Error("Public client not ready");
            const currentId = await publicClient.readContract({
                address: RAFFLE_ADDRESS as `0x${string}`,
                abi: RAFFLE_ABI,
                functionName: 'currentRaffleId',
            });
            const actualId = Number(currentId);

            if (address) {
                try {
                    const timestamp = new Date().toISOString();
                    const message = `Sync Admin Raffle\nID: ${actualId}\nTime: ${timestamp}`;
                    const signature = await signMessageAsync({ message });

                    await syncRaffle({
                        wallet_address: address,
                        signature,
                        message,
                        action_type: 'SYNC_RAFFLE',
                        payload: {
                            raffle_id: actualId,
                            creator: address,
                            end_time: new Date(Date.now() + Number(form.durationDays) * 86400 * 1000).toISOString(),
                            max_tickets: Number(form.maxTickets),
                            metadata_uri: form.metadataURI || 'ipfs://admin-raffle',
                            title: form.title,
                            description: form.description,
                            image_url: form.image_url,
                            external_link: form.external_link,
                            twitter_link: form.twitter_link,
                            min_sbt_level: Number(form.min_sbt_level),
                            is_base_social_required: form.is_base_social_required
                        }
                    });
                } catch (e: unknown) {
                    console.warn("DB Sync failed locally:", e instanceof Error ? e.message : String(e));
                }
            }

            toast.success(`Raffle #${actualId} created successfully!`);
            setForm({
                winnerCount: '1',
                maxTickets: '100',
                durationDays: '3',
                metadataURI: '',
                title: '',
                description: '',
                image_url: '',
                external_link: '',
                twitter_link: '',
                min_sbt_level: '0',
                is_base_social_required: true
            });
        } catch (e: unknown) {
            console.error("Read currentId failed:", e);
            toast.success('Raffle created on-chain!');
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Title */}
                <div className="md:col-span-2 space-y-2">
                    <label className="label-native text-slate-500 px-1">Campaign Title</label>
                    <input type="text"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 value-native text-white outline-none focus:border-indigo-500/50 transition-all"
                        placeholder="e.g. Genesis Gacha Pass"
                    />
                </div>

                <div className="space-y-2">
                    <label className="label-native text-slate-500 px-1">SBT Requirement</label>
                    <select
                        value={form.min_sbt_level}
                        onChange={e => setForm({ ...form, min_sbt_level: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 value-native text-white outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                    >
                        {[0, 1, 2, 3, 4, 5].map(lv => (
                            <option key={lv} value={lv} className="bg-zinc-950">Level {lv}+</option>
                        ))}
                    </select>
                </div>

                {/* Description */}
                <div className="md:col-span-3 space-y-2">
                    <label className="label-native text-slate-500 px-1">Description</label>
                    <textarea
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 value-native text-white outline-none focus:border-indigo-500/50 transition-all h-24 resize-none"
                        placeholder="Describe the raffle and its prizes..."
                    />
                </div>

                <div className="space-y-2">
                    <label className="label-native text-slate-500 px-1">Winner Distribution</label>
                    <div className="relative group">
                        <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500/50 group-focus-within:text-indigo-400 transition-colors" />
                        <input type="number" min="1" max="50"
                            value={form.winnerCount}
                            onChange={e => setForm({ ...form, winnerCount: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 value-native text-white outline-none focus:border-indigo-500/50 transition-all"
                            placeholder="Count"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="label-native text-slate-500 px-1">Ticket Capacity</label>
                    <div className="relative group">
                        <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50 group-focus-within:text-emerald-400 transition-colors" />
                        <input type="number" min="1" max="100000"
                            value={form.maxTickets}
                            onChange={e => setForm({ ...form, maxTickets: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 value-native text-white outline-none focus:border-emerald-500/50 transition-all"
                            placeholder="Capacity"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="label-native text-slate-500 px-1">Campaign Duration</label>
                    <div className="relative group">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/50 group-focus-within:text-amber-400 transition-colors" />
                        <select
                            value={form.durationDays}
                            onChange={e => setForm({ ...form, durationDays: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 value-native text-white outline-none appearance-none focus:border-amber-500/50 transition-all cursor-pointer"
                        >
                            {[1, 2, 3, 5, 7, 14, 25, 30].map(d => (
                                <option key={d} value={d} className="bg-[#0a0a0c]">{d} Day{d > 1 ? 's' : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="label-native text-slate-500 px-1">Hero Image URL</label>
                    <input type="text"
                        value={form.image_url}
                        onChange={e => setForm({ ...form, image_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 value-native text-white font-mono focus:border-white/20 outline-none transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="label-native text-slate-500 px-1">Twitter / X Link</label>
                    <input type="text"
                        value={form.twitter_link}
                        onChange={e => setForm({ ...form, twitter_link: e.target.value })}
                        placeholder="https://x.com/..."
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 value-native text-white font-mono focus:border-white/20 outline-none transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="label-native text-slate-500 px-1">Website Link</label>
                    <input type="text"
                        value={form.external_link}
                        onChange={e => setForm({ ...form, external_link: e.target.value })}
                        placeholder="https://..."
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 value-native text-white font-mono focus:border-white/20 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 bg-white/3 border border-white/5 p-4 rounded-2xl">
                <div
                    onClick={() => setForm({ ...form, is_base_social_required: !form.is_base_social_required })}
                    className={`w-12 h-6 rounded-full transition-all cursor-pointer relative ${form.is_base_social_required ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.is_base_social_required ? 'left-7' : 'left-1'}`} />
                </div>
                <div className="flex-1">
                    <p className="label-native text-white">Identity Guard (Basenames)</p>
                    <p className="label-native text-slate-500 mt-1">Require Farcaster/Twitter verification</p>
                </div>
            </div>

            <AdminTransactionButton
                calls={calls}
                onSuccess={handleSuccess}
                text="INITIALIZE ON-CHAIN RAFFLE"
                className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-5 rounded-[2.5rem] label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30"
            />
        </div>
    );
}

function CreatorEarningsCard() {
    const { address } = useAccount();
    const { data: balance, refetch } = useReadContract({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI as readonly unknown[],
        functionName: 'sponsorBalances',
        args: [address],
        query: { enabled: !!address }
    });

    const calls = [{
        to: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: 'withdrawSponsorBalance',
    }];

    if (!address || !balance || balance === 0n) return null;

    return (
        <div className="bg-[#121214] p-6 border border-white/5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Trophy className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                    <h3 className="label-native text-emerald-400 mb-1">Creator Earnings Available</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white">{(Number(balance) / 1e18).toFixed(4)}</span>
                        <span className="label-native text-emerald-500">ETH</span>
                    </div>
                    <p className="label-native text-slate-500 mt-1">Accumulated from 80% Ticket Revenue share</p>
                </div>
            </div>

            <AdminTransactionButton
                calls={calls}
                onSuccess={() => {
                    toast.success("Earnings withdrawn successfully!");
                    refetch();
                }}
                text="WITHDRAW EARNINGS"
                className="w-full md:w-auto px-10 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl label-native transition-all active:scale-[0.98] disabled:opacity-30"
            />
        </div>
    );
}

function AdminRaffleSettings() {
    const [fees, setFees] = useState({ rake: '20', surcharge: '10' });

    // Fetch current settings
    const { data: rake } = useReadContract({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: 'maintenanceFeeBP' });
    const { data: surcharge } = useReadContract({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: 'surchargeBP' });

    useEffect(() => {
        if (rake !== undefined) setFees(f => ({ ...f, rake: (Number(rake) / 100).toString() }));
        if (surcharge !== undefined) setFees(f => ({ ...f, surcharge: (Number(surcharge) / 100).toString() }));
    }, [rake, surcharge]);

    return (
        <div className="bg-[#121214] p-8 border border-white/5 rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:rotate-12 transition-transform duration-1000">
                <ShieldCheck className="w-40 h-40 text-white" />
            </div>

            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center border border-white/10">
                    <ShieldCheck className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                    <h3 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">PROTOCOL ECONOMICS</h3>
                    <p className="label-native text-slate-500 mt-2">Platform Fee Configuration</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                    <label className="label-native text-slate-500">Project Rake (%)</label>
                    <div className="relative">
                        <input type="number" value={fees.rake} onChange={e => setFees({...fees, rake: e.target.value})}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 value-native text-white focus:border-indigo-500/50 outline-none" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 label-native text-slate-600">BP: {Number(fees.rake)*100}</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="label-native text-slate-500">Gas Surcharge (%)</label>
                    <div className="relative">
                        <input type="number" value={fees.surcharge} onChange={e => setFees({...fees, surcharge: e.target.value})}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 value-native text-white focus:border-amber-500/50 outline-none" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 label-native text-slate-600">BP: {Number(fees.surcharge)*100}</span>
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={() => toast.error("Protocol fee setter is unavailable on the deployed raffle contract. Redeploy/upgrade before fee writes.")}
                className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-5 rounded-2xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30"
            >
                UPDATE PROTOCOL FEES
            </button>
        </div>
    );
}

export function RaffleManagerTab() {
    const {
        raffles, isLoadingRaffles, refetchRaffles,
        recentTickets, refetchTickets,
        winners, isLoadingWinners, refetchWinners
    } = useAdminRaffleQueries();

    useEffect(() => {
        // Setup real-time subscription for new tickets
        const sub = supabase
            .channel('public:raffle_tickets')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raffle_tickets' }, () => {
                refetchTickets();
                toast(`New Ticket Purchased!`, { icon: '🎟️' });
            })
            .subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [refetchTickets]);

    return (
        <div className="space-y-8">
            <CreatorEarningsCard />

            <AdminRaffleSettings />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Create Raffle */}
                    <div className="bg-[#121214] p-8 border border-white/5 rounded-[2.5rem] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
                            <Plus className="w-48 h-48 text-indigo-500" />
                        </div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                                <Plus className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">CREATE ADMIN RAFFLE</h3>
                                <p className="label-native text-slate-500 mt-2">Free deployment • No ETH required</p>
                            </div>
                        </div>

                        <AdminRaffleCreateForm syncRaffle={useAdminRaffleQueries().syncRaffle} />
                    </div>

                    {/* Live Tickets Feed */}
                    {recentTickets.length > 0 && (
                        <div className="bg-[#121214] p-6 border border-white/5 rounded-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <h3 className="label-native text-emerald-400">LIVE TICKET PURCHASES</h3>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {recentTickets.map((t, i: number) => {
                                    const ticket = t as { wallet_address: string; ticket_count: number; raffle_id: number };
                                    return (
                                        <div key={i} className="px-4 py-2 bg-black/40 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                                            <Ticket size={12} className="text-emerald-500" />
                                            <span className="label-native font-mono text-white">{ticket.wallet_address.slice(0, 6)}...</span>
                                            <span className="label-native text-slate-400">bought {ticket.ticket_count} for #{ticket.raffle_id}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Raffle List */}
                    <div className="bg-[#121214] p-8 border border-white/5 rounded-[2.5rem]">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-600/20 flex items-center justify-center border border-amber-500/30">
                                    <Trophy className="w-6 h-6 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">DATABASE RAFFLES</h3>
                                    <p className="label-native text-slate-500 mt-2">Live Indexed Management</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => { refetchRaffles(); refetchTickets(); }} className={`p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all ${isLoadingRaffles ? 'animate-spin' : ''}`}>
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                    <span className="label-native text-slate-400">TOTAL: {raffles.length}</span>
                                </div>
                            </div>
                        </div>

                        {isLoadingRaffles ? (
                            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500/30" /></div>
                        ) : raffles.length === 0 ? (
                            <div className="py-20 text-center bg-white/2 border-white/5 rounded-3xl">
                                <Ticket className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                                <p className="label-native text-slate-600">No indexed raffles found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {raffles.map((r: unknown) => {
                                    const raffle = r as { id: number | string };
                                    return <AdminRaffleRow key={raffle.id.toString()} raffleId={raffle.id} />;
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Leaderboard Sidebar */}
                <div className="space-y-8">
                    <div className="bg-[#121214] p-8 border border-white/5 rounded-[2.5rem] sticky top-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Medal className="w-5 h-5 text-yellow-400" />
                                <h3 className="label-native text-yellow-300">TOP WINNERS</h3>
                            </div>
                            <button onClick={() => refetchWinners()} className={`p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all ${isLoadingWinners ? 'animate-spin' : ''}`}>
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        {isLoadingWinners ? (
                            <div className="py-12 flex flex-col items-center gap-4">
                                <Loader2 className="w-8 h-8 animate-spin text-yellow-500/20" />
                                <span className="label-native text-slate-700">Querying Indexer...</span>
                            </div>
                        ) : winners.length === 0 ? (
                            <div className="py-12 text-center opacity-30">
                                <p className="label-native text-slate-500">No winners recorded.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {winners.map((w: unknown, i: number) => {
                                    const winner = w as { wallet_address: string; streak_count?: number; raffle_wins: number; total_xp?: number };
                                    return (
                                        <div key={winner.wallet_address} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-yellow-500/20 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[11px] ${i === 0 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-900 text-slate-500'}`}>
                                                    {i + 1}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="label-native font-mono text-white group-hover:text-yellow-400 transition-colors">
                                                        {winner.wallet_address.slice(0, 6)}...{winner.wallet_address.slice(-4)}
                                                    </span>
                                                    <span className="label-native text-slate-600 mt-0.5">WIN STREAK: {winner.streak_count || 0}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="label-native text-yellow-400">🏆 {winner.raffle_wins} WINS</span>
                                                <span className="label-native text-indigo-400 font-mono">{(winner.total_xp || 0).toLocaleString()} XP</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface WinnersPanelProps {
    winners: (string | undefined)[];
    raffleId: number | string;
}

function WinnersPanel({ winners, raffleId }: WinnersPanelProps) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { announceWinner, isAnnouncing } = useAdminRaffleQueries();
    if (!winners || winners.length === 0) return null;
    const zeroAddr = '0x0000000000000000000000000000000000000000';
    const realWinners = winners.filter(w => w && w !== zeroAddr);
    if (realWinners.length === 0) return null;

    const handleAnnounce = async () => {
        if (!address) return toast.error("Wallet not connected");
        try {
            const timestamp = new Date().toISOString();
            const message = `Announce Winner for Raffle #${raffleId}\nAdmin: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            await announceWinner({
                raffle_id: raffleId.toString(),
                wallet: address,
                signature,
                message
            });
        } catch (e: unknown) {
            console.error(e);
            const err = e as { message?: string };
            toast.error(err.message || "Failed to announce winner");
        }
    };

    return (
        <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-2xl space-y-2">
            <div className="flex items-center justify-between mb-3 px-1">
                <p className="label-native text-emerald-400">
                    RAFFLE #{raffleId} WINNERS
                </p>
                <button
                    onClick={handleAnnounce}
                    disabled={isAnnouncing}
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-lg label-native transition-all active:scale-[0.98] disabled:opacity-30"
                >
                    {isAnnouncing ? "Announcing..." : "Announce"}
                </button>
            </div>
            {realWinners.map((w, i) => (
                <div key={w} className="flex items-center gap-3 p-2.5 bg-black/40 rounded-xl border border-emerald-500/10">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0 ${
                        i === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'
                    }`}>{i === 0 ? '🏆' : `#${i + 1}`}</div>
                    <a
                        href={`https://sepolia.basescan.org/address/${w}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="label-native font-mono text-emerald-300 hover:text-emerald-200 transition-colors truncate"
                    >
                        {w?.slice(0, 10)}...{w?.slice(-8)}
                    </a>
                </div>
            ))}
        </div>
    );
}

interface AdminRaffleRowProps {
    raffleId: number | string;
}

function AdminRaffleRow({ raffleId }: AdminRaffleRowProps) {
    const { raffle, isLoading, refetch } = useRaffleInfo(raffleId);
    const { drawRaffle, isDrawing } = useRaffle();
    const [drawPending, setDrawPending] = useState(false);
    const publicClient = usePublicClient();
    const navigate = useNavigate();

    const handleDraw = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!publicClient) return toast.error("Public Client not ready");

        try {
            setDrawPending(true);
            const hash = await drawRaffle(raffleId);

            // Wait for tx confirmation
            if (hash) {
                toast.loading('Waiting for on-chain confirmation...', { id: 'draw-confirm' });
                await publicClient.waitForTransactionReceipt({ hash });
                toast.success('Draw request confirmed! Waiting for QRNG callback...', { id: 'draw-confirm' });
            }

            // Poll until raffle is finalized (Airnode callback can take 30-120s)
            let attempts = 0;
            const poll = setInterval(async () => {
                await refetch();
                attempts++;
                if (attempts >= 30) {
                    clearInterval(poll);
                    setDrawPending(false);
                    toast('QRNG is still processing. Refresh manually if needed.', { icon: '⏳' });
                }
            }, 4000);

            // Watch raffle.isFinalized via refetch
            const stopWhenDone = setInterval(async () => {
                const result = await (refetch as () => Promise<{ data?: { raffle?: { isFinalized?: boolean } } }>)();
                if (result?.data?.raffle?.isFinalized) {
                    clearInterval(stopWhenDone);
                    clearInterval(poll);
                    setDrawPending(false);
                    toast.success('🏆 Winners have been determined!', { duration: 6000 });
                }
            }, 4000);

        } catch (e: unknown) {
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
        <div className="space-y-4">
            <div
                onClick={() => navigate(`/raffles/${raffle.id}`)}
                className="flex flex-col md:flex-row items-center justify-between p-6 bg-black/40 border border-white/5 rounded-[2rem] hover:border-indigo-500/20 transition-all gap-4 cursor-pointer group"
            >
                <div className="flex items-center gap-5 flex-1 w-full">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 relative overflow-hidden group-hover:border-indigo-400 transition-colors">
                        {raffle.image_url ? (
                            <img src={raffle.image_url} alt={raffle.title} className="w-full h-full object-cover" />
                        ) : (
                            <Ticket className="w-6 h-6 text-indigo-400" />
                        )}
                        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-lg shadow-lg">
                            #{raffle.id}
                        </div>
                    </div>

                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                            <h4 className="value-native text-white truncate max-w-[200px]">
                                {raffle.title || "ADMIN RAFFLE"}
                            </h4>
                            <span className={`label-native px-2 py-0.5 rounded-full uppercase tracking-widest ${raffle.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                {raffle.isActive ? 'ACTIVE' : raffle.isFinalized ? 'FINALIZED' : 'CLOSED'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 label-native">
                            <span className="flex items-center gap-1.5"><Users size={12} className="text-slate-700" /> {Number(raffle.totalTickets || 0)} / {Number(raffle.maxTickets || 0)} PARTICIPANTS</span>
                            <span className="flex items-center gap-1.5"><Trophy size={12} className="text-slate-700" /> {raffle.winnerCount} WINNERS</span>
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
                            className={`relative w-full md:w-auto px-8 py-3 rounded-2xl label-native transition-all flex items-center justify-center gap-2 ${
                                canDraw && !drawPending
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 hover:scale-105'
                                : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                            }`}
                        >
                            {(isDrawing || drawPending) ? "Drawing..." : "Draw Winners"}
                            {canDraw && !isDrawing && !drawPending && <div className="absolute inset-0 rounded-2xl border-2 border-amber-400 animate-ping opacity-20 pointer-events-none" />}
                        </button>
                    ) : isQrngPending || drawPending ? (
                        <div className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 label-native animate-pulse">
                            <Loader2 size={14} className="animate-spin" /> QRNG PENDING...
                        </div>
                    ) : raffle.isFinalized ? (
                        <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 label-native">
                            <Trophy size={14} /> FINALIZED
                        </div>
                    ) : (
                        <div className="px-6 py-3 bg-slate-800/30 border border-white/5 rounded-2xl text-slate-500 label-native">
                            CLOSED
                        </div>
                    )}
                </div>
            </div>
            {/* Winners Panel — displayed after QRNG callback completes */}
            {raffle.isFinalized && raffle.winners && raffle.winners.length > 0 && (
                <WinnersPanel winners={raffle.winners} raffleId={raffle.id} />
            )}
        </div>
    );
}
