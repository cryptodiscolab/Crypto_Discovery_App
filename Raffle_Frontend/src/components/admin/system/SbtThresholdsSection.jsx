import React from 'react';
import { TrendingUp, Plus, Trash2, Save } from 'lucide-react';

export function SbtThresholdsSection({ thresholds, onAddLevel, onRemoveLevel, onChange, onSave, saving }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-lg font-bold text-white">Dynamic SBT Levels</h2>
                </div>
                <button onClick={onAddLevel} className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all">
                    <Plus className="w-3.5 h-3.5" /> Add Level
                </button>
            </div>
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold sticky top-0 backdrop-blur-sm z-10">
                            <tr>
                                <th className="px-4 py-3">Lvl</th>
                                <th className="px-4 py-3">Min XP</th>
                                <th className="px-4 py-3">Tier Name</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {thresholds.map((item) => (
                                <tr key={item.id} className="hover:bg-white/[0.02] transition-all">
                                    <td className="px-4 py-4">
                                        <input
                                            type="number"
                                            value={item.level}
                                            onChange={(e) => onChange(item.id, 'level', e.target.value)}
                                            className="w-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-emerald-400 font-black text-xs"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="number"
                                            value={item.min_xp}
                                            onChange={(e) => onChange(item.id, 'min_xp', e.target.value)}
                                            className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white font-mono text-xs"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="text"
                                            value={item.tier_name}
                                            onChange={(e) => onChange(item.id, 'tier_name', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-slate-200 text-xs"
                                            placeholder="Tier Name"
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button onClick={() => onRemoveLevel(item.id)} className="text-red-500/50 hover:text-red-500 p-1.5 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <button onClick={onSave} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-white transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Sync SBT Thresholds (Off-chain)'}
            </button>
        </div>
    );
}
