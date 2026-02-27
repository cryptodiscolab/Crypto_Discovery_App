import React, { useState } from 'react';
import { Plus, Ticket, Trophy, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
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

// Augment RAFFLE_ABI with adminCreateRaffle (added in new contract deploy)
const ADMIN_RAFFLE_ABI_ENTRIES = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "_winnerCount", "type": "uint256" },
            { "internalType": "uint256", "name": "_maxTickets", "type": "uint256" },
            { "internalType": "uint256", "name": "_durationDays", "type": "uint256" },
            { "internalType": "string", "name": "_metadataURI", "type": "string" }
        ],
        "name": "adminCreateRaffle",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "raffleIdCounter",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
];

const FULL_RAFFLE_ABI = [...(RAFFLE_ABI || []), ...ADMIN_RAFFLE_ABI_ENTRIES];
const RAFFLE_ADDRESS = CONTRACTS?.RAFFLE || import.meta.env.VITE_RAFFLE_ADDRESS || "0x18C64ed185C15F46d17C1888e12168DBA409e2EE";

function AdminRaffleCreateForm() {
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
            abi: FULL_RAFFLE_ABI,
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
            const counter = await publicClient.readContract({
                address: RAFFLE_ADDRESS,
                abi: FULL_RAFFLE_ABI,
                functionName: 'raffleIdCounter',
            });
            const actualId = Number(counter);
            toast.success(`Raffle #${actualId} created successfully!`);
            setForm({ winnerCount: '1', maxTickets: '100', durationDays: '3', metadataURI: '' });
        } catch {
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

    return (
        <div className="space-y-6">
            {/* Create Raffle */}
            <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">Create Admin Raffle (Free)</span>
                </div>
                <p className="text-[9px] text-slate-500 px-1">Buat raffle gratis tanpa deposit ETH. Hadiah bersumber dari ticket revenue.</p>
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
        </div>
    );
}

function AdminRaffleRow({ raffleId }) {
    const { useRaffleInfo: info } = { useRaffleInfo: () => ({ raffle: null, isLoading: true }) };
    const { raffle, isLoading } = useRaffleInfo(raffleId);

    if (isLoading || !raffle) return (
        <div className="p-3 bg-[#0a0a0c] border border-white/5 rounded-xl animate-pulse">
            <div className="h-3 w-32 bg-white/5 rounded" />
        </div>
    );

    return (
        <div className="flex items-center justify-between p-3 bg-[#0a0a0c] border border-white/5 rounded-xl">
            <div>
                <p className="text-[10px] font-black text-white">Raffle #{raffle.id?.toString()}</p>
                <p className="text-[8px] text-slate-500 font-mono mt-0.5">
                    {raffle.isActive ? '🟢 Active' : raffle.isFinalized ? '✅ Finalized' : '⚫ Closed'} •{' '}
                    {Number(raffle.totalTickets || 0)}/{Number(raffle.maxTickets || 0)} tickets
                </p>
            </div>
            <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${raffle.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                }`}>
                {raffle.isActive ? 'LIVE' : 'ENDED'}
            </span>
        </div>
    );
}
