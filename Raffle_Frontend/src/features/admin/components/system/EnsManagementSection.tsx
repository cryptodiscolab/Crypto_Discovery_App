import { useState } from 'react';
import { UserCheck, Globe } from 'lucide-react';

interface EligibleUser {
    fid: number | string;
    total_xp?: number | string;
    wallet_address?: string;
}

interface IssuedSubname {
    id: string | number;
    fid?: number | string;
    full_name: string;
    wallet_address?: string;
}

export function EnsManagementSection({ eligibleUsers, issuedSubnames, onIssue, saving }: {
    eligibleUsers: unknown[];
    issuedSubnames: unknown[];
    onIssue: (_user: { fid: number | string; wallet_address?: string; total_xp?: number | string }, _label: string) => void | Promise<unknown>;
    saving: boolean;
}) {
    const [labelMap, setLabelMap] = useState<Record<string, string>>({});
    const typedEligible = eligibleUsers as EligibleUser[];
    const typedIssued = issuedSubnames as IssuedSubname[];

    const handleLabelChange = (fid: number | string, value: string) => {
        setLabelMap(prev => ({ ...prev, [String(fid)]: value }));
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <UserCheck className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">Eligible Candidates</h2>
                </div>
                <div className="bg-[#121214] rounded-2xl border border-white/5 p-4 max-h-[500px] overflow-y-auto space-y-3 custom-scrollbar">
                    {typedEligible.length === 0 ? (
                        <p className="label-native text-slate-500 italic text-center py-10">No eligible candidates found.</p>
                    ) : (
                        typedEligible.map((user) => (
                            <div key={user.fid} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex flex-col gap-3 group hover:border-indigo-500/30 transition-all">
                                <div className="flex items-center justify-between">
                                    <span className="label-native font-mono text-indigo-400 py-1 px-2 bg-indigo-500/10 rounded-lg">FID: {user.fid}</span>
                                    <span className="label-native bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full">XP: {user.total_xp?.toString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="label"
                                        value={labelMap[String(user.fid)] || ''}
                                        onChange={(e) => handleLabelChange(user.fid, e.target.value)}
                                        className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-2 value-native text-white focus:border-indigo-500 outline-none"
                                    />
                                    <span className="label-native text-slate-500">.cryptodiscovery.eth</span>
                                </div>
                                <button
                                    onClick={() => onIssue(user, labelMap[String(user.fid)] || '')}
                                    disabled={saving || !labelMap[String(user.fid)]}
                                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-2.5 rounded-xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
                                >
                                    Issue Subname Identity
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em] leading-none">Issued Identities</h2>
                </div>
                <div className="bg-[#121214] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 label-native text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Label</th>
                                    <th className="px-4 py-3">Wallet</th>
                                    <th className="px-4 py-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {typedIssued.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/[0.02]">
                                        <td className="px-4 py-4">
                                            <p className="value-native text-white">{item.full_name}</p>
                                            <p className="label-native text-slate-500 font-mono mt-1">FID: {item.fid}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="label-native text-slate-400 font-mono">{item.wallet_address?.slice(0, 6)}...{item.wallet_address?.slice(-4)}</p>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="label-native text-emerald-500">
                                                Live
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
