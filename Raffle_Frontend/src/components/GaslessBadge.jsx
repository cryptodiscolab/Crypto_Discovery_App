import { usePaymaster } from '../hooks/usePaymaster';

/**
 * GaslessBadge
 *
 * Badge kecil yang muncul jika wallet user mendukung gasless transactions.
 * Hanya tampil jika Coinbase Smart Wallet terdeteksi (EIP-5792).
 */
export function GaslessBadge({ className = '' }) {
    const { isGaslessSupported } = usePaymaster();

    if (!isGaslessSupported) return null;

    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 ${className}`}
            title="Gasless transaction via Coinbase Paymaster"
        >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Gasless
        </span>
    );
}
