import { Settings, Trash2 } from 'lucide-react';

interface PointSetting {
    id: string;
    activity_key: string;
    points_value: number;
    platform: string;
    action_type: string;
    is_active: boolean;
    is_hidden?: boolean;
}

interface PointSettingsSectionProps {
    pointSettings: PointSetting[];
    onAddActivity: () => void;
    onRemoveActivity: (_id: string) => void;
    onChange: (_id: string, _field: string, _value: string | number | boolean) => void;
    onSave: () => void;
    saving: boolean;
}

export function PointSettingsSection({ pointSettings, onAddActivity, onRemoveActivity, onChange, onSave, saving }: PointSettingsSectionProps) {
    return (
        <div className="space-y-4 max-w-[100vw] overflow-x-hidden">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em]">Advanced Points</h2>
                </div>
                <button onClick={onAddActivity} className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 px-3 py-1.5 rounded-lg label-native transition-all">
                    Add Point Activity
                </button>
            </div>
            <div className="bg-[#121214] rounded-2xl border border-white/5 overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 label-native text-slate-500 sticky top-0 backdrop-blur-sm z-10">
                            <tr>
                                <th className="px-4 py-3">Platform / Action</th>
                                <th className="px-4 py-3">XP</th>
                                <th className="px-4 py-3 text-center">Active</th>
                                <th className="px-4 py-3 text-center">Hide</th>
                                <th className="px-4 py-3 text-right">Del</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {pointSettings.map((item) => (
                                <tr key={item.id} className={`hover:bg-white/[0.02] transition-all ${item.is_hidden ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex gap-2">
                                                <select
                                                    value={item.platform}
                                                    onChange={(e) => onChange(item.id, 'platform', e.target.value)}
                                                    className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-white label-native cursor-pointer outline-none focus:border-indigo-500"
                                                >
                                                    <option value="farcaster">Farcaster</option>
                                                    <option value="x">X (Twitter)</option>
                                                    <option value="base">Base</option>
                                                    <option value="instagram">Instagram</option>
                                                    <option value="tiktok">TikTok</option>
                                                    <option value="system">System (Internal)</option>
                                                </select>
                                                <select
                                                    value={item.action_type || 'Follow'}
                                                    onChange={(e) => onChange(item.id, 'action_type', e.target.value)}
                                                    className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-indigo-300 label-native cursor-pointer outline-none focus:border-indigo-500"
                                                >
                                                    <option value="Follow">Follow</option>
                                                    <option value="Like">Like</option>
                                                    <option value="Comment">Comment</option>
                                                    <option value="Recast/Repost">Recast</option>
                                                    <option value="Quote">Quote</option>
                                                    <option value="Daily">Daily</option>
                                                    <option value="Buy">Buy</option>
                                                    <option value="Claim">Claim</option>
                                                    <option value="Invite">Invite</option>
                                                </select>
                                            </div>
                                            <input
                                                type="text"
                                                value={item.activity_key}
                                                onChange={(e) => onChange(item.id, 'activity_key', e.target.value)}
                                                className="bg-black/30 border border-white/5 rounded-lg px-2 py-1 label-native text-slate-400 font-mono outline-none"
                                                placeholder="activity_key (internal)"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="number"
                                            value={item.points_value}
                                            onChange={(e) => onChange(item.id, 'points_value', Number(e.target.value))}
                                            className="w-16 bg-slate-800/60 border border-white/10 rounded-lg px-2 py-1 text-white focus:border-indigo-500 font-mono value-native"
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.is_active}
                                            onChange={(e) => onChange(item.id, 'is_active', e.target.checked)}
                                            className="w-4 h-4 accent-emerald-500 bg-black rounded cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.is_hidden}
                                            onChange={(e) => onChange(item.id, 'is_hidden', e.target.checked)}
                                            className="w-4 h-4 accent-red-500 bg-black rounded cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button onClick={() => onRemoveActivity(item.id)} className="text-red-500/30 hover:text-red-500 p-1.5 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <button onClick={onSave} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-3 rounded-xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30">
                {saving ? 'SAVING...' : 'SYNC POINT SETTINGS'}
            </button>
        </div>
    );
}
