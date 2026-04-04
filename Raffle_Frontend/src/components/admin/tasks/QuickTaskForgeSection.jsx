import React from 'react';
import { Calendar } from 'lucide-react';
import { AdminTransactionButton } from '../AdminTransactionButton';

export function QuickTaskForgeSection({
    dailyDesc, onDailyDescChange,
    dailyPoints, onDailyPointsChange,
    dailyCooldown, onDailyCooldownChange,
    dailyRequiresVerify, onDailyRequiresVerifyChange,
    dailyIsBaseSocialRequired, onDailyIsBaseSocialRequiredChange,
    dailyMinTier, onDailyMinTierChange,
    pointSettings,
    buildAdminTaskCall,
    handleTxSuccess
}) {
    return (
        <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4 text-left">
            <h3 className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Administrative Task Forge
            </h3>
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Activity Template (From DB)</label>
                    <select
                        onChange={(e) => {
                            const s = pointSettings.find(x => x.activity_key === e.target.value);
                            if (s) {
                                onDailyPointsChange(s.points_value);
                                onDailyDescChange(s.activity_key.replace(/_/g, ' ').toUpperCase());
                            }
                        }}
                        className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors"
                    >
                        <option value="">-- Manual Configuration --</option>
                        {pointSettings.map(s => <option key={s.id} value={s.activity_key}>{s.activity_key} (+{s.points_value} XP)</option>)}
                    </select>
                </div>
                <input
                    placeholder="Detailed Description"
                    value={dailyDesc}
                    onChange={e => onDailyDescChange(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50"
                />
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[7px] font-black text-slate-700 uppercase px-1">XP Points</label>
                        <input
                            type="number"
                            placeholder="100"
                            value={dailyPoints}
                            onChange={e => onDailyPointsChange(e.target.value)}
                            className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-indigo-400 font-black outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[7px] font-black text-slate-700 uppercase px-1">Cooldown</label>
                        <select
                            value={dailyCooldown}
                            onChange={e => onDailyCooldownChange(e.target.value)}
                            className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none"
                        >
                            <option value="1h">1 Hour (Flash)</option>
                            <option value="12h">12 Hours</option>
                            <option value="24h">24 Hours (Daily)</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-4 px-2 bg-[#0a0a0c] py-3 rounded-xl border border-white/5">
                        <label className="flex items-center gap-2 cursor-pointer group flex-1">
                            <input type="checkbox" checked={dailyRequiresVerify} onChange={e => onDailyRequiresVerifyChange(e.target.checked)} className="rounded border-white/5 bg-slate-900 text-indigo-600" />
                            <span className="text-[9px] font-black text-slate-500 uppercase group-hover:text-white transition-colors">Requires Human verification</span>
                        </label>
                        <div className="h-4 w-px bg-white/5" />
                        <select value={dailyMinTier} onChange={e => onDailyMinTierChange(Number(e.target.value))} className="bg-transparent text-[9px] font-black text-indigo-500 uppercase outline-none">
                            <option value={0}>Min Tier: ALL</option>
                            <option value={1}>Tier: Bronze</option>
                            <option value={2}>Tier: Silver+</option>
                        </select>
                    </div>

                    {/* IDENTITY GUARD (v3.42.0) */}
                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${dailyIsBaseSocialRequired ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-[#0a0a0c] border-white/5 hover:border-white/10'}`}
                         onClick={() => onDailyIsBaseSocialRequiredChange(!dailyIsBaseSocialRequired)}>
                        <div className="flex items-center gap-2">
                            <svg className={`w-3 h-3 ${dailyIsBaseSocialRequired ? 'text-blue-400' : 'text-slate-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${dailyIsBaseSocialRequired ? 'text-blue-400' : 'text-slate-500'}`}>Identity Guard (v3.42.0)</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full p-1 transition-colors ${dailyIsBaseSocialRequired ? 'bg-blue-600' : 'bg-slate-800'}`}>
                            <div className={`w-2 h-2 bg-white rounded-full transition-transform transform ${dailyIsBaseSocialRequired ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </div>
            </div>
            
            <AdminTransactionButton 
                calls={buildAdminTaskCall()} 
                onSuccess={handleTxSuccess}
                text="DEPLOY SYSTEM TASK"
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20"
            />
        </div>
    );
}
