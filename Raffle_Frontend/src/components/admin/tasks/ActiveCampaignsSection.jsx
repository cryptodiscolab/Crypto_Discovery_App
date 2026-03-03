import React, { useState } from 'react';
import { Shield, RefreshCw, Zap, Clock, List, Share2 } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../../../lib/contracts';

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
        <div className="space-y-8 animate-in fade-in duration-700 text-left">
            <div className="flex gap-1 bg-slate-950/50 p-1 rounded-2xl w-fit border border-white/5">
                <button
                    onClick={() => setAuditSubMode('SPONSORS')}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${auditSubMode === 'SPONSORS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Sponsorship Audit
                </button>
                <button
                    onClick={() => setAuditSubMode('ORGANIC')}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${auditSubMode === 'ORGANIC' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Organic Tasks
                </button>
            </div>

            {auditSubMode === 'SPONSORS' ? (
                <>
                    <div className="glass-card p-8 bg-indigo-950/10 border border-indigo-500/10 shadow-2xl relative overflow-hidden rounded-3xl">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                                    <Shield className="w-6 h-6 text-indigo-400" /> SPONSOR AUDIT HUB
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Review and verify paid campaign requests</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onRefetchSponsors}
                                    className="p-3 bg-slate-900 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase">Total Requests: {nextSponsorId ? Number(nextSponsorId) - 1 : 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Audit Table */}
                        <div className="space-y-4">
                            {nextSponsorId && Number(nextSponsorId) > 1 ? (
                                Array.from({ length: Number(nextSponsorId) - 1 }).map((_, i) => (
                                    <AuditRequestRow key={i + 1} id={BigInt(i + 1)} onApprove={onApproveSponsor} onReject={onRejectSponsor} />
                                ))
                            ) : (
                                <p className="text-center text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] py-10 opacity-50">
                                    NO PENDING AUDIT LOGS
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatusCard icon={Zap} color="yellow" label="Global Points Flow" value="2.4M" />
                        <StatusCard icon={Clock} color="indigo" label="Avg. TTR" value="12.4s" />
                        <StatusCard icon={List} color="purple" label="Success Rate" value="99.8%" valueColor="emerald" />
                    </div>

                    <div className="glass-card p-8 bg-slate-900/40 border border-white/5 rounded-3xl">
                        <h4 className="text-sm font-black text-white uppercase tracking-widest mb-6">Active Campaigns (Live Tasks)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {nextSponsorId && Number(nextSponsorId) > 1 ? (
                                Array.from({ length: Number(nextSponsorId) - 1 }).map((_, i) => (
                                    <SponsorCardItem key={i + 1} id={BigInt(i + 1)} />
                                ))
                            ) : (
                                <div className="col-span-full py-10 text-center text-slate-700 text-[10px] font-black uppercase tracking-widest">
                                    No live campaigns found
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="glass-card p-8 bg-slate-900/20 border border-white/5 rounded-3xl">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-2xl font-black text-white">ORGANIC TASKS</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">In-house engagement tasks management</p>
                        </div>
                        <div className="px-4 py-2 bg-slate-800 rounded-full">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Live: {nextTaskId ? Number(nextTaskId) - 1 : 0}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {nextTaskId && Number(nextTaskId) > 1 ? (
                            Array.from({ length: Number(nextTaskId) - 1 }).map((_, i) => (
                                <OrganicTaskRow
                                    key={i + 1}
                                    id={BigInt(i + 1)}
                                    onToggle={onToggleTaskStatus}
                                />
                            ))
                        ) : (
                            <div className="py-20 text-center opacity-30">
                                <Clock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-[0.5em]">No Organic Tasks Deployed</p>
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
        yellow: 'text-yellow-500',
        indigo: 'text-indigo-400',
        purple: 'text-purple-500',
        emerald: 'text-emerald-400'
    };
    return (
        <div className="glass-card p-6 bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center text-center group transition-all hover:bg-slate-900/60 rounded-2xl">
            <Icon className={`w-6 h-6 mb-2 group-hover:scale-125 transition-transform ${colorClasses[color]}`} />
            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</h5>
            <p className={`text-2xl font-black mt-1 ${colorClasses[valueColor] || 'text-white'}`}>{value}</p>
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

    if (!task || task[0] === "") return null;

    const baseReward = task[0];
    const isActive = task[1];
    const title = task[4];
    const requiresVerification = task[7];

    return (
        <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex items-center justify-between group hover:border-indigo-500/20 transition-all">
            <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                    {requiresVerification ? <Shield className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>
                <div>
                    <h5 className="text-xs font-black text-white uppercase">{title}</h5>
                    <div className="flex gap-2 mt-1">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{Number(baseReward)} XP</span>
                        <span className={`text-[8px] font-bold uppercase ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isActive ? '● PUBLIC' : '○ DISABLED'}
                        </span>
                    </div>
                </div>
            </div>
            <button
                onClick={() => onToggle(id, isActive)}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${isActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
            >
                {isActive ? 'Disable' : 'Enable'}
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

    if (!request || Number(request[8]) === 2) return null; // REJECTED

    const sponsor = request[0];
    const title = request[2];
    const link = request[3];
    const rewardPerUserUSD = request[6];
    const targetClaims = request[7];
    const status = Number(request[8]);

    return (
        <div className="p-6 rounded-2xl border border-white/5 bg-slate-950/50 flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-indigo-500/30 transition-all">
            <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                    <Share2 className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="text-left">
                    <h4 className="font-black text-white uppercase text-sm">{title}</h4>
                    <p className="text-[10px] text-slate-500 font-mono">ID: #{id.toString()} | From: {sponsor.slice(0, 6)}...{sponsor.slice(-4)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-[9px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-bold">{targetClaims.toString()} Targets</span>
                        <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-bold">${(Number(rewardPerUserUSD) / 1e18).toFixed(2)} USD</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${status === 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}`}>
                            {status === 0 ? 'PENDING AUDIT' : 'APPROVED'}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {status === 0 && (
                    <>
                        <button
                            onClick={() => onReject(id.toString())}
                            className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase rounded-xl hover:bg-red-500/20 transition-all"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => onApprove(id.toString())}
                            className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-500 transition-all shadow-lg"
                        >
                            Approve
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
        abi: DAILY_APP_ABI,
        functionName: 'sponsorRequests',
        args: [id]
    });

    if (!request || Number(request[8]) !== 1) return null; // ONLY SHOW APPROVED

    const title = request[2];
    const link = request[3];
    const rewardPerUserUSD = request[6];
    const targetClaims = request[7];

    return (
        <div className="p-5 bg-slate-900/30 border border-white/5 rounded-2xl relative overflow-hidden group hover:bg-slate-900/50 transition-all text-left">
            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <span className="text-[8px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded">ID #{id.toString()}</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <span className="font-black text-white text-xs">{title.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                    <h4 className="font-bold text-white text-sm truncate max-w-[120px]">{title}</h4>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Live Campaign</p>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">Value per Claim:</span>
                    <span className="font-black text-emerald-400">${(Number(rewardPerUserUSD) / 1e18).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">Target Users:</span>
                    <span className="font-black text-white">{targetClaims.toString()}</span>
                </div>
            </div>

            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 border border-white/5 py-2.5 rounded-xl text-white text-[9px] font-black uppercase text-center block hover:border-indigo-500/50 transition-all group-hover:bg-indigo-600 group-hover:border-indigo-500"
            >
                Preview Mission
            </a>
        </div>
    );
}
