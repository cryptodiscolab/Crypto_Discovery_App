import { useState } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import { useAccount, useSignMessage, usePublicClient } from 'wagmi';
import toast from 'react-hot-toast';
import { useSBT as useSBTData } from '../../../../hooks/useSBT';
import { useUserInfo } from '../../../../hooks/useContract';
import { usePoints } from '../../../../shared/context/PointsContext';

interface RevenueClaimModalProps {
    onClose: () => void;
    claimable: bigint;
    onSuccess?: () => void;
}

/**
 * RevenueClaimModal Component
 */
export function RevenueClaimModal({ onClose, claimable, onSuccess }: RevenueClaimModalProps) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { claimRewards } = useSBTData();
    const [isClaiming, setIsClaiming] = useState(false);
    const publicClient = usePublicClient();

    const handleClaim = async () => {
        if (claimable === 0n) return toast.error("Nothing to claim!");
        setIsClaiming(true);
        const tid = toast.loading("Confirming claim...");
        try {
            const hash = await claimRewards();
            await publicClient!.waitForTransactionReceipt({ hash });
            const timestamp = new Date().toISOString();
            const message = `Claim Dividends for ${address}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });
            await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'sync-pool-claim', wallet: address, signature, message, payload: { amountETH: Number(claimable).toString(), txHash: hash } }),
            });
            toast.success("Dividends claimed!", { id: tid });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err: unknown) {
            toast.error(err.shortMessage || "Claim failed", { id: tid });
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-sm p-8 space-y-6 text-center">
                <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto border border-indigo-500/30">
                    <Coins size={40} className="text-indigo-400" />
                </div>
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">REVENUE <span className="text-indigo-500">SHARE</span></h2>
                <button onClick={handleClaim} disabled={isClaiming} className="w-full py-4 bg-indigo-600 rounded-2xl text-white font-black uppercase tracking-widest">
                    {isClaiming ? 'PROCESSING...' : 'CLAIM DIVIDENDS'}
                </button>
                <button onClick={onClose} className="text-[11px] text-slate-500 font-black uppercase tracking-widest">CANCEL</button>
            </div>
        </div>
    );
}

interface RenewSponsorshipModalProps {
    onClose: () => void;
}

/**
 * RenewSponsorshipModal Component
 */
export function RenewSponsorshipModal({ onClose }: RenewSponsorshipModalProps) {
    const { ecosystemSettings } = usePoints();
    const [reqId, setReqId] = useState('');
    const { address } = useAccount();
    const { refetch: _refetchStats } = useUserInfo(address);
    const feeUsd = Number((ecosystemSettings as unknown)?.ugc_config?.listing_fee_usdc || 0);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-sm p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                        <RefreshCw size={32} className="text-blue-400" />
                    </div>
                    <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Renew <span className="text-blue-500">Visibility</span></h2>
                    <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">Extend for another 3 Days for ${feeUsd} USDC.</p>
                </div>
                <input
                    type="number"
                    placeholder="Sponsorship ID"
                    value={reqId}
                    onChange={(e) => setReqId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none"
                />
                <button onClick={onClose} className="w-full py-4 bg-blue-600 rounded-2xl text-white font-black uppercase tracking-widest">RENEW (3 DAYS)</button>
                <button onClick={onClose} className="w-full text-[11px] text-slate-600 font-black uppercase tracking-widest">CANCEL</button>
            </div>
        </div>
    );
}
