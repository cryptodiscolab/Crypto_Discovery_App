import { TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { SponsorSettings } from '../../../../types/admin';

interface EconomicIndicatorsCardProps {
    withdrawFee: string;
    setWithdrawFee: (_f: string) => void;
    sponsorSettings: SponsorSettings;
    setSponsorSettings: (_s: SponsorSettings) => void;
    autoApprove: boolean;
    setAutoApprove: (_a: boolean) => void;
    getUsdValue: (_humanAmount: string, _isUsdc?: boolean) => number;
    isSaving: boolean;
    setIsSaving: (_s: boolean) => void;
}

export function EconomicIndicatorsCard({
    withdrawFee, setWithdrawFee,
    sponsorSettings, setSponsorSettings,
    autoApprove, setAutoApprove,
    getUsdValue,
    isSaving, setIsSaving
}: EconomicIndicatorsCardProps) {
    const handleSaveEconomical = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Economic Indicators...");
        try {
            void withdrawFee;
            void sponsorSettings;
            void autoApprove;
            toast.error("DailyApp V16 does not expose legacy sponsorship or withdrawal-fee setters. Use Raffle, MasterX, and system settings.", { id: tid });
        } catch (e: unknown) {
            const error = e as { shortMessage?: string; message?: string };
            toast.error(error.shortMessage || error.message || "Action failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 rounded-2xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" /> ECONOMIC INDICATORS
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Withdrawal Fee BP</label>
                    <input type="number" value={withdrawFee} onChange={e => setWithdrawFee(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Sponsor Fee (USDC)</label>
                    <input type="number" value={sponsorSettings.fee} onChange={e => setSponsorSettings({ ...sponsorSettings, fee: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Min Pool Value (ETH Equiv)</label>
                    <input type="number" value={sponsorSettings.minPool} onChange={e => setSponsorSettings({ ...sponsorSettings, minPool: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    <p className="text-[9px] text-indigo-400/60 font-mono pl-1">≈ ${getUsdValue(sponsorSettings.minPool).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</p>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Reward Per Claim (ETH Equiv)</label>
                    <input type="number" value={sponsorSettings.reward} onChange={e => setSponsorSettings({ ...sponsorSettings, reward: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    <p className="text-[9px] text-indigo-400/60 font-mono pl-1">≈ ${getUsdValue(sponsorSettings.reward).toLocaleString(undefined, { maximumFractionDigits: 4 })} USD</p>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Tasks Goal</label>
                    <input type="number" value={sponsorSettings.tasks} onChange={e => setSponsorSettings({ ...sponsorSettings, tasks: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2">Auto Approve</label>
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black ${!autoApprove ? 'text-white' : 'text-slate-500'}`}>OFF</span>
                        <button onClick={() => setAutoApprove(!autoApprove)} className={`w-12 h-6 rounded-full p-1 transition-colors ${autoApprove ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoApprove ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-[10px] font-black ${autoApprove ? 'text-white' : 'text-slate-500'}`}>ON</span>
                    </div>
                </div>
            </div>
            <button onClick={handleSaveEconomical} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                Update Economic Indicators
            </button>
        </div>
    );
}

