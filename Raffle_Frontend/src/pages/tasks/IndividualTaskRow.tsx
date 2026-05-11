import { Shield, Zap, CheckCircle, ExternalLink } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../../lib/contracts';
import { Task } from '../../types/tasks';

interface IndividualTaskRowProps {
    task: Task;
    address: string | undefined;
    onAction: () => void;
    offChainClaims: Set<string>;
}

export function IndividualTaskRow({ task, address, onAction, offChainClaims }: IndividualTaskRowProps) {
    const { data: isVerified } = useReadContract({
        address: CONTRACTS.DAILY_APP as `0x${string}`,
        abi: DAILY_APP_ABI,
        functionName: 'isTaskVerified',
        args: [address as `0x${string}`, BigInt(task.id)],
        query: { enabled: !!address }
    });

    const { data: isCompleted } = useReadContract({
        address: CONTRACTS.DAILY_APP as `0x${string}`,
        abi: DAILY_APP_ABI,
        functionName: 'hasCompletedTask',
        args: [address as `0x${string}`, BigInt(task.id)],
        query: { enabled: !!address }
    });

    const isCompletedOffChain = offChainClaims?.has(String(task.id).toLowerCase());

    if (isCompleted || isCompletedOffChain) return null;

    return (
        <div className="flex items-center justify-between px-4 py-4 hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isVerified ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-white/5 text-slate-500 border-white/5'}`}>
                    {isVerified ? <CheckCircle size={18} /> : <Zap size={18} />}
                </div>
                <div>
                    <h4 className={`value-native ${isVerified ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</h4>
                    <p className="label-native text-slate-500 font-mono opacity-60">Task ID #{task.id}</p>
                </div>
            </div>

            {!isVerified ? (
                <button
                    onClick={() => {
                        window.open(task.link, '_blank');
                        onAction();
                    }}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all active:scale-90"
                >
                    <ExternalLink size={16} />
                </button>
            ) : (
                <div className="w-10 h-10 flex items-center justify-center text-green-500">
                    <CheckCircle size={20} />
                </div>
            )}
        </div>
    );
}
