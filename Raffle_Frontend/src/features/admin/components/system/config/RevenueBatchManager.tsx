import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface RevenueBatchManagerProps {
    qLastDist: bigint | undefined;
    handleDistribute: () => Promise<void>;
    isSaving: boolean;
}

export function RevenueBatchManager({ qLastDist, handleDistribute, isSaving }: RevenueBatchManagerProps) {
    return (
        <div className="glass-card p-6 bg-emerald-900/10 border border-emerald-500/10 space-y-4 rounded-2xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-400" /> REVENUE BATCH MANAGEMENT
            </h3>
            
            <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-xl border border-white/5">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Last Distribution</p>
                    <p className="text-sm font-mono text-white">
                        {qLastDist && qLastDist > 0n
                            ? new Date(Number(qLastDist) * 1000).toLocaleString()
                            : 'Loading...'}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Cycle Strategy</p>
                    <p className="text-sm font-mono text-emerald-400">5-Day Cooldown</p>
                </div>
            </div>

            <button 
                onClick={handleDistribute} 
                disabled={isSaving} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                {isSaving ? "Processing..." : "Force Batch Distribution (Manual)"}
            </button>
            <p className="text-[9px] text-slate-500 italic text-center">* Bypasses cooldown. Updates all user reward pools.</p>
        </div>
    );
}
