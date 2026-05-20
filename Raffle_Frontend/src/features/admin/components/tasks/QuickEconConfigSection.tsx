import { TrendingUp } from 'lucide-react';
import { AdminTransactionButton, AdminContractCall } from '../AdminTransactionButton';

interface QuickEconConfigSectionProps {
    configPlatformFee: string;
    onConfigPlatformFeeChange: (_val: string) => void;
    configMinPool: string;
    onConfigMinPoolChange: (_val: string) => void;
    configMinReward: string;
    onConfigMinRewardChange: (_val: string) => void;
    buildConfigCall: () => AdminContractCall[];
    handleTxSuccess: () => void;
}

export function QuickEconConfigSection({
    configPlatformFee, onConfigPlatformFeeChange,
    configMinPool, onConfigMinPoolChange,
    configMinReward, onConfigMinRewardChange,
    buildConfigCall,
    handleTxSuccess
}: QuickEconConfigSectionProps) {
    return (
        <div className="bg-[#121214] p-5 rounded-2xl border border-white/5 space-y-4 text-left">
            <h3 className="label-native text-white flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" /> Economic Command Center
            </h3>
            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl mb-2">
                <p className="label-native text-red-400 leading-relaxed text-left">
                    Warning: Adjusting these parameters immediately affects all new sponsorship requests and operational profit margins.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                    <label className="block label-native text-slate-600 px-1 mb-1">Sponsorship Listing Fee (USDC)</label>
                    <input value={configPlatformFee} onChange={e => onConfigPlatformFeeChange(e.target.value)} placeholder="e.g. 1.00" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 value-native text-white outline-none focus:border-red-500/30 transition-colors" />
                </div>
                <div className="space-y-1.5">
                    <label className="block label-native text-slate-600 px-1 mb-1">Minimum Aggregate Pool (USD)</label>
                    <input value={configMinPool} onChange={e => onConfigMinPoolChange(e.target.value)} placeholder="e.g. 5.00" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 value-native text-white outline-none focus:border-red-500/30 transition-colors" />
                </div>
                <div className="space-y-1.5">
                    <label className="block label-native text-slate-600 px-1 mb-1">Minimum Reward Per User (USD)</label>
                    <input value={configMinReward} onChange={e => onConfigMinRewardChange(e.target.value)} placeholder="e.g. 0.01" className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 value-native text-white outline-none focus:border-red-500/30 transition-colors" />
                </div>
            </div>
            <AdminTransactionButton
                calls={buildConfigCall()}
                onSuccess={handleTxSuccess}
                text="UPDATE PROTOCOL ECONOMICS"
                className="w-full py-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-xl label-native shadow-lg shadow-indigo-500/10"
            />
        </div>
    );
}
