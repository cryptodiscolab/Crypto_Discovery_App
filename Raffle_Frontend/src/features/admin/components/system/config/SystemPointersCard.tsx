import { Cpu } from 'lucide-react';
import { useAccount, useSignMessage, useWriteContract, usePublicClient } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI, MASTER_X_ABI } from '../../../../../lib/contracts';
import axios from 'axios';
import toast from 'react-hot-toast';
import { SystemPointers, TokenWhitelist } from '../../../../types/admin';

interface SystemPointersCardProps {
    pointers: SystemPointers;
    setPointers: (p: SystemPointers) => void;
    tokens: any[];
    newTokenWhitelist: TokenWhitelist;
    setNewTokenWhitelist: (t: TokenWhitelist) => void;
    handleSyncTokenToDb: (action: string, payload: any) => Promise<void>;
    isSaving: boolean;
    setIsSaving: (s: boolean) => void;
}

export function SystemPointersCard({
    pointers, setPointers,
    tokens,
    newTokenWhitelist, setNewTokenWhitelist,
    handleSyncTokenToDb,
    isSaving, setIsSaving
}: SystemPointersCardProps) {
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const handleUpdatePointer = async (targetContract: `0x${string}`, abi: any, functionName: string, value: string | any[]) => {
        setIsSaving(true);
        const tid = toast.loading(`Updating ${functionName}...`);
        try {
            const hash = await writeContractAsync({
                address: targetContract,
                abi: abi,
                functionName: functionName,
                args: Array.isArray(value) ? value : [value],
            });
            await publicClient!.waitForTransactionReceipt({ hash });
            toast.success("Pointer Updated!", { id: tid });
        } catch (e: any) { 
            toast.error(e.shortMessage || e.message, { id: tid }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    return (
        <div className="glass-card p-6 bg-red-950/10 border border-red-500/10 space-y-6 rounded-2xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-red-400" /> SYSTEM ARCHITECTURE POINTERS
            </h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                DANGEROUS: Core contract linkages. Only modify if redeploying modules.
            </p>

            <div className="space-y-4">
                {/* DailyApp -> MasterX Link */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">DailyApp → MasterX Pointer</label>
                        <input type="text" value={pointers.masterX} onChange={e => setPointers({ ...pointers, masterX: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-white" placeholder="0x..." />
                    </div>
                    <button onClick={() => handleUpdatePointer(CONTRACTS.DAILY_APP as `0x${string}`, DAILY_APP_ABI, 'setMasterX', pointers.masterX)} className="bg-red-600/20 hover:bg-red-600/40 border border-red-600/20 py-2 rounded-xl text-[9px] font-black uppercase text-red-400">Update MasterX Link</button>
                </div>

                {/* MasterX -> Raffle Link */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">MasterX → Raffle Pointer</label>
                        <input type="text" value={pointers.raffleContract} onChange={e => setPointers({ ...pointers, raffleContract: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-white" placeholder="0x..." />
                    </div>
                    <button onClick={() => handleUpdatePointer(CONTRACTS.MASTER_X as `0x${string}`, MASTER_X_ABI, 'setRaffleContract', pointers.raffleContract)} className="bg-red-600/20 hover:bg-red-600/40 border border-red-600/20 py-2 rounded-xl text-[9px] font-black uppercase text-red-400">Update Raffle Link</button>
                </div>

                {/* DailyApp Tokens */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end border-t border-white/5 pt-4">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">USDCToken Address (DailyApp)</label>
                        <input type="text" value={pointers.usdcToken} onChange={e => setPointers({ ...pointers, usdcToken: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-white" placeholder="0x..." />
                    </div>
                    <button onClick={() => handleUpdatePointer(CONTRACTS.DAILY_APP as `0x${string}`, DAILY_APP_ABI, 'setUSDCToken', pointers.usdcToken)} className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-[9px] font-black uppercase text-white">Set USDC Token</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">CreatorToken Address (DailyApp)</label>
                        <input type="text" value={pointers.creatorToken} onChange={e => setPointers({ ...pointers, creatorToken: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-white" placeholder="0x..." />
                    </div>
                    <button onClick={() => handleUpdatePointer(CONTRACTS.DAILY_APP as `0x${string}`, DAILY_APP_ABI, 'setCreatorToken', pointers.creatorToken)} className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-[9px] font-black uppercase text-white">Set Creator Token</button>
                </div>

                {/* Payment Token Whitelist Management */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Payment Token Whitelist Management</label>
                    
                    <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-white/5 text-slate-400 uppercase font-black">
                                <tr>
                                    <th className="px-4 py-2">Symbol</th>
                                    <th className="px-4 py-2">Chain</th>
                                    <th className="px-4 py-2">Address</th>
                                    <th className="px-4 py-2">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-white">
                                {tokens.map((token: any, i: number) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-2 font-black">{token.symbol}</td>
                                        <td className="px-4 py-2 text-slate-400">{token.chain_id}</td>
                                        <td className="px-4 py-2 font-mono text-[9px]">{token.address.slice(0,6)}...{token.address.slice(-4)}</td>
                                        <td className="px-4 py-2">
                                            <button 
                                                onClick={() => {
                                                    const p = { address: token.address, chain_id: token.chain_id };
                                                    handleUpdatePointer(CONTRACTS.DAILY_APP as `0x${string}`, DAILY_APP_ABI, 'setAllowedToken', [p.address, false, 18, '']);
                                                    handleSyncTokenToDb('REMOVE_TOKEN_DB', p);
                                                }}
                                                className="text-red-400 hover:text-red-300 font-bold uppercase"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {tokens.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-4 text-center text-slate-500 italic">No custom tokens whitelisted.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-[9px] font-black text-indigo-400 uppercase">Add New Token</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase font-bold">Address</label>
                                <input type="text" value={newTokenWhitelist.address} onChange={e => setNewTokenWhitelist({...newTokenWhitelist, address: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white" placeholder="0x..." />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase font-bold">Symbol</label>
                                <input type="text" value={newTokenWhitelist.symbol} onChange={e => setNewTokenWhitelist({...newTokenWhitelist, symbol: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" placeholder="USDC" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase font-bold">Decimals</label>
                                <input type="number" value={newTokenWhitelist.decimals} onChange={e => setNewTokenWhitelist({...newTokenWhitelist, decimals: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase font-bold">Chain ID</label>
                                <input type="number" value={newTokenWhitelist.chain_id} onChange={e => setNewTokenWhitelist({...newTokenWhitelist, chain_id: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                if (!newTokenWhitelist.address || !newTokenWhitelist.symbol) return toast.error("Missing fields");
                                handleUpdatePointer(CONTRACTS.DAILY_APP as `0x${string}`, DAILY_APP_ABI, 'setAllowedToken', [newTokenWhitelist.address, true, parseInt(newTokenWhitelist.decimals) || 18, newTokenWhitelist.symbol || '']);
                                handleSyncTokenToDb('WHITELIST_TOKEN_DB', {
                                    ...newTokenWhitelist,
                                    decimals: parseInt(newTokenWhitelist.decimals),
                                    chain_id: parseInt(newTokenWhitelist.chain_id)
                                });
                            }}
                            className="w-full bg-green-600/20 hover:bg-green-600/40 border border-green-600/20 py-2 rounded-xl text-[9px] font-black uppercase text-green-400"
                        >
                            Whitelist & Sync to Database
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
