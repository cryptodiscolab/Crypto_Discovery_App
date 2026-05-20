import { TrendingUp, Trash2 } from 'lucide-react';

interface SbtThreshold {
    id: string;
    level: number;
    min_xp: number;
    tier_name: string;
    badge_url: string;
}

interface SbtThresholdsSectionProps {
    thresholds: SbtThreshold[];
    onAddLevel: () => void;
    onRemoveLevel: (_id: string) => void;
    onChange: (_id: string, _field: string, _value: string | number) => void;
    onSave: () => void;
    saving: boolean;
}

export function SbtThresholdsSection({ thresholds, onAddLevel, onRemoveLevel, onChange, onSave, saving }: SbtThresholdsSectionProps) {
    return (
        <div className="space-y-4 max-w-[100vw] overflow-x-hidden">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em]">Dynamic SBT Levels</h2>
                </div>
                <button onClick={onAddLevel} className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 px-3 py-1.5 rounded-lg label-native transition-all">
                    Add Level
                </button>
            </div>
            <div className="bg-[#121214] rounded-2xl border border-white/5 overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 label-native text-slate-500 sticky top-0 backdrop-blur-sm z-10">
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
                                            onChange={(e) => onChange(item.id, 'level', Number(e.target.value))}
                                            className="w-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-indigo-400 font-black value-native"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="number"
                                            value={item.min_xp}
                                            onChange={(e) => onChange(item.id, 'min_xp', Number(e.target.value))}
                                            className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white font-mono value-native"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="text"
                                            value={item.tier_name}
                                            onChange={(e) => onChange(item.id, 'tier_name', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-slate-200 value-native"
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
            <button onClick={onSave} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-3 rounded-xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30">
                {saving ? 'SAVING...' : 'SYNC SBT THRESHOLDS (OFF-CHAIN)'}
            </button>
        </div>
    );
}
