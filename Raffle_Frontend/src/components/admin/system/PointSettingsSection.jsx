import React from 'react';
import { Settings, Plus, Trash2, Save } from 'lucide-react';

export function PointSettingsSection({ pointSettings, onAddActivity, onRemoveActivity, onChange, onSave, saving }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    <h2 className="text-lg font-bold text-white">Advanced Points</h2>
                </div>
                <button onClick={onAddActivity} className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition-all">
                    <Plus className="w-3.5 h-3.5" /> Add Point Activity
                </button>
            </div>
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold sticky top-0 backdrop-blur-sm z-10">
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
                                                    className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-white font-black text-[10px] cursor-pointer outline-none focus:border-blue-500"
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
                                                    className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-indigo-300 font-bold text-[10px] cursor-pointer outline-none focus:border-blue-500"
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
                                                className="bg-black/30 border border-white/5 rounded-lg px-2 py-1 text-[10px] text-slate-400 font-mono outline-none"
                                                placeholder="activity_key (internal)"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="number"
                                            value={item.points_value}
                                            onChange={(e) => onChange(item.id, 'points_value', e.target.value)}
                                            className="w-16 bg-slate-800/60 border border-white/10 rounded-lg px-2 py-1 text-white focus:border-blue-500 font-mono text-xs"
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
            <button onClick={onSave} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-black text-white transition-all shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Sync Point Settings'}
            </button>
        </div>
    );
}
