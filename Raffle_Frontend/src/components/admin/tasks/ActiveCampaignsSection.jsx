import React, { useState } from 'react';
import { Shield, RefreshCw, Zap, Clock, List, Share2, ShieldAlert } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../../../lib/contracts';
import { supabase } from '../../../lib/supabaseClient';

const DAILY_APP_ADDRESS = CONTRACTS.DAILY_APP;

export function ActiveCampaignsSection({
    nextSponsorId,
    nextTaskId,
    onToggleTaskStatus,
    onApproveSponsor,
    onRejectSponsor,
    onRefetchSponsors
}) {
    const [auditSubMode, setAuditSubMode] = useState('SPONSORS');

    return (
        <div className="space-y-10 animate-in fade-in duration-700 text-left relative">
            <div className="flex p-1.5 bg-black/40 rounded-3xl w-fit border border-white/5 backdrop-blur-xl">
                <button
                    onClick={() => setAuditSubMode('SPONSORS')}
                    className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${auditSubMode === 'SPONSORS' ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Sponsorship Audit
                </button>
                <button
                    onClick={() => setAuditSubMode('ORGANIC')}
                    className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${auditSubMode === 'ORGANIC' ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Organic Tasks
                </button>
            </div>

            {auditSubMode === 'SPONSORS' ? (
                <>
                    <div className="glass-card p-10 bg-indigo-950/5 border border-indigo-500/10 rounded-[3rem] relative overflow-hidden group/audit">
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -mr-64 -mt-64 transition-all duration-1000 group-hover/audit:bg-indigo-600/10" />
                        
                        <div className="flex flex-col md:flex-row justify-between items-center mb-12 relative">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
                                    <Shield className="w-8 h-8 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] leading-none">AUDIT <span className="text-indigo-500">GATEWAY</span></h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Paid Campaign Verification</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mt-6 md:mt-0">
                                <button
                                    onClick={onRefetchSponsors}
                                    className="w-12 h-12 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                                <div className="px-6 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">PENDING: {nextSponsorId ? Number(nextSponsorId) - 1 : 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Audit Table */}
                        <div className="space-y-6 relative">
                            {nextSponsorId && Number(nextSponsorId) > 1 ? (
                                Array.from({ length: Number(nextSponsorId) - 1 }).map((_, i) => (
                                    <AuditRequestRow key={i + 1} id={BigInt(i + 1)} onApprove={onApproveSponsor} onReject={onRejectSponsor} />
                                ))
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center opacity-40">
                                    <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin mb-6" />
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.5em]">System Idle / Monitoring Logs</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <StatusCard icon={Zap} color="yellow" label="Global Velocity" value="2.4M" />
                        <StatusCard icon={Clock} color="indigo" label="Verification TTR" value="12.4s" />
                        <StatusCard icon={List} color="purple" label="Network Health" value="99.8%" valueColor="emerald" />
                    </div>

                    <div className="glass-card p-10 bg-white/5 border border-white/5 rounded-[3rem]">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-2 h-8 bg-indigo-500 rounded-full" />
                            <h4 className="text-sm font-black text-white uppercase tracking-[0.3em]">ACTIVE PROTOCOLS (LIVE CAMPAIGNS)</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {nextSponsorId && Number(nextSponsorId) > 1 ? (
                                Array.from({ length: Number(nextSponsorId) - 1 }).map((_, i) => (
                                    <SponsorCardItem key={i + 1} id={BigInt(i + 1)} />
                                ))
                            ) : (
                                <div className="col-span-full py-20 text-center">
                                    <p className="text-slate-700 text-xs font-black uppercase tracking-[0.4em]">Zero Active Deployments</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="glass-card p-10 bg-white/5 border border-white/5 rounded-[3rem] relative overflow-hidden group/organic">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-30" />
                    
                    <div className="flex flex-col md:flex-row justify-between items-center mb-12">
                        <div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] leading-none">ORGANIC <span className="text-indigo-500">ENGINE</span></h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">In-House Engagement Matrix</p>
                        </div>
                        <div className="mt-6 md:mt-0 px-6 py-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LIVE NODES: {nextTaskId ? Number(nextTaskId) - 1 : 0}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {nextTaskId && Number(nextTaskId) > 1 ? (
                            Array.from({ length: Number(nextTaskId) - 1 }).map((_, i) => (
                                <OrganicTaskRow
                                    key={i + 1}
                                    id={BigInt(i + 1)}
                                    onToggle={onToggleTaskStatus}
                                />
                            ))
                        ) : (
                            <div className="py-32 flex flex-col items-center justify-center opacity-20">
                                <Clock className="w-16 h-16 text-slate-500 mb-6" />
                                <p className="text-[10px] font-black uppercase tracking-[1em] text-center ml-[1em]">NO NODES DEPLOYED</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusCard({ icon: Icon, color, label, value, valueColor = 'white' }) {
    const colorClasses = {
        yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20 shadow-yellow-400/10',
        indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20 shadow-indigo-400/10',
        purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20 shadow-purple-400/10',
        emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-emerald-400/10'
    };
    
    return (
        <div className="glass-card p-10 bg-white/5 border border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center group transition-all duration-500 hover:bg-white/10 hover:-translate-y-2">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 border ${colorClasses[color]}`}>
                <Icon className="w-7 h-7" />
            </div>
            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">{label}</h5>
            <p className={`text-3xl font-black tracking-tighter ${valueColor === 'emerald' ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
        </div>
    );
}

function OrganicTaskRow({ id, onToggle }) {
    const { data: task } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: ABIS.DAILY_APP,
        functionName: 'tasks',
        args: [id]
    });

    const [dbMeta, setDbMeta] = React.useState(null);

    React.useEffect(() => {
        if (!id) return;
        const fetchMeta = async () => {
            const { data } = await supabase.from('daily_tasks').select('is_base_social_required, reward_symbol, reward_amount_per_user').eq('id', Number(id)).maybeSingle();
            if (data) setDbMeta(data);
        };
        fetchMeta();
    }, [id]);

    if (!task || task[0] === "") return null;

    const baseReward = task[0];
    const isActive = task[1];
    const title = task[4];
    const requiresVerification = task[7];

    return (
        <div className="p-6 rounded-[2rem] border border-white/5 bg-white/5 flex items-center justify-between group/row hover:bg-white/10 hover:border-indigo-500/30 transition-all duration-500">
            <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-emerald-500/10 text-emerald-500 shadow-xl shadow-emerald-500/10' : 'bg-slate-900 text-slate-700'}`}>
                    {dbMeta?.is_base_social_required ? <ShieldAlert className="w-6 h-6 text-blue-400" /> : requiresVerification ? <Shield className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-600 font-mono tracking-widest">#{id.toString()}</span>
                        <h5 className="text-sm font-black text-white uppercase tracking-widest group-hover/row:text-indigo-400 transition-colors">
                            {title}
                        </h5>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/40 rounded-lg border border-white/5">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{Number(baseReward)} XP</span>
                        </div>
                        {dbMeta?.reward_amount_per_user > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                    {dbMeta.reward_amount_per_user} {dbMeta.reward_symbol}
                                </span>
                            </div>
                        )}
                        <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-500 shadow-emerald-500/20 text-glow' : 'text-slate-700'}`}>
                            {isActive ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                </div>
            </div>
            <button
                onClick={() => onToggle(id, isActive)}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/30 shadow-xl shadow-red-500/10' : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-400/30 shadow-xl shadow-emerald-500/40'}`}
            >
                {isActive ? 'DEACTIVATE' : 'ACTIVATE'}
            </button>
        </div>
    );
}

function AuditRequestRow({ id, onApprove, onReject }) {
    const { data: request } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: ABIS.DAILY_APP,
        functionName: 'sponsorRequests',
        args: [id]
    });

    const [dbMeta, setDbMeta] = React.useState(null);

    React.useEffect(() => {
        if (!id) return;
        const fetchMeta = async () => {
            const { data } = await supabase.from('daily_tasks').select('is_base_social_required, created_at').eq('onchain_id', Number(id)).maybeSingle();
            if (data) setDbMeta(data);
        };
        fetchMeta();
    }, [id]);

    if (!request || Number(request[8]) === 2) return null; // REJECTED

    const sponsor = request[0];
    const title = request[2];
    const link = request[3];
    const rewardPerUserUSD = request[6];
    const targetClaims = request[7];
    const status = Number(request[8]);

    return (
        <div className="p-8 rounded-[2.5rem] border border-white/5 bg-black/40 flex flex-col lg:flex-row justify-between items-center gap-8 group/audit-row hover:bg-black/60 hover:border-indigo-500/40 transition-all duration-500">
            <div className="flex gap-8 items-start w-full">
                <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center shadow-2xl group-hover/audit-row:scale-110 transition-transform duration-500">
                    <Share2 className="w-8 h-8 text-indigo-400" />
                </div>
                <div className="text-left flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-indigo-500 font-mono tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">ID: #{id.toString()}</span>
                        <h4 className="font-black text-white uppercase text-lg tracking-widest">{title}</h4>
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono font-bold tracking-tight mb-4">CREATOR: {sponsor}</p>
                    
                    <div className="flex flex-wrap gap-3">
                        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CAPACITY:</span>
                            <span className="text-xs font-black text-white">{targetClaims.toString()}</span>
                        </div>
                        <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">UNIT VALUE:</span>
                            <span className="text-xs font-black text-emerald-400">${(Number(rewardPerUserUSD) / 1e18).toFixed(2)} USD</span>
                        </div>
                        <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${status === 0 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${status === 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${status === 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                                {status === 0 ? 'AWAITING_REVIEW' : 'SYSTEM_ACTIVE'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 w-full lg:w-auto">
                {status === 0 && (
                    <>
                        <button
                            onClick={() => onReject(id.toString())}
                            className="flex-1 lg:flex-none px-10 py-4 bg-transparent border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-500 hover:text-white transition-all duration-300"
                        >
                            REJECT
                        </button>
                        <button
                            onClick={() => onApprove(id.toString())}
                            className="flex-1 lg:flex-none px-10 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-500 transition-all duration-300 shadow-2xl shadow-indigo-500/40"
                        >
                            APPROVE
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function SponsorCardItem({ id }) {
    const { data: request } = useReadContract({
        address: DAILY_APP_ADDRESS,
        abi: ABIS.DAILY_APP,
        functionName: 'sponsorRequests',
        args: [id]
    });

    const [dbMeta, setDbMeta] = React.useState(null);

    React.useEffect(() => {
        if (!id) return;
        const fetchMeta = async () => {
            const { data } = await supabase.from('daily_tasks').select('is_base_social_required, created_at, expires_at').eq('onchain_id', Number(id)).maybeSingle();
            if (data) setDbMeta(data);
        };
        fetchMeta();
    }, [id]);

    if (!request || Number(request[8]) !== 1) return null; // ONLY SHOW APPROVED

    const title = request[2];
    const link = request[3];
    const rewardPerUserUSD = request[6];
    const targetClaims = request[7];

    return (
        <div className="p-8 bg-black/40 border border-white/5 rounded-[2.5rem] relative overflow-hidden group/item hover:bg-black/60 hover:border-emerald-500/30 transition-all duration-500 text-left">
            <div className="absolute top-0 right-0 p-6 opacity-40 group-hover/item:opacity-100 transition-opacity">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest font-mono">ID #{id.toString()}</span>
            </div>

            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                    <span className="font-black text-white text-lg">{title.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                    <h4 className="font-black text-white text-sm uppercase tracking-widest truncate max-w-[180px]">{title}</h4>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">
                        {dbMeta?.is_base_social_required ? (
                            <span className="text-blue-400">IDENTITY GUARDED</span>
                        ) : "PUBLIC NODE"}
                    </p>
                </div>
            </div>

            <div className="space-y-4 mb-8 p-6 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">LIQUIDITY</span>
                    <span className="text-xs font-black text-emerald-400">${(Number(rewardPerUserUSD) / 1e18).toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-white/5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TARGETS</span>
                    <span className="text-xs font-black text-white">{targetClaims.toString()} USERS</span>
                </div>
            </div>

            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 border border-white/5 py-4 rounded-2xl text-white text-[10px] font-black uppercase tracking-[0.2em] text-center block hover:border-emerald-500/50 hover:bg-emerald-600 transition-all duration-300"
            >
                PREVIEW MISSION
            </a>
        </div>
    );
}
