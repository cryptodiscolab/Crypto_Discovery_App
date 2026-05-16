import { useEffect, useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSignMessage } from 'wagmi';
import { useWriteContracts } from 'wagmi/experimental';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Abi } from 'viem';

export interface AdminContractCall {
    to: `0x${string}`;
    abi?: Abi | unknown[];
    functionName?: string;
    args?: unknown[];
    value?: bigint;
    data?: `0x${string}`;
}

export interface AdminTransactionButtonProps {
    calls: AdminContractCall[];
    onSuccess?: (_hash: string) => void;
    text: React.ReactNode;
    disabled?: boolean;
    className?: string;
    successMessage?: string;
}

/**
 * Shared Admin Transaction Button for v3.41.2 Hardening
 * Replaces OnchainKit Transaction components in Admin views.
 * Supports single calls via useWriteContract or batches via useWriteContracts.
 * Auto-logs to admin_audit_logs via LOG_ONCHAIN_TX.
 */
export function AdminTransactionButton({
    calls,
    onSuccess,
    text,
    disabled,
    className = "",
    successMessage = "Transaction Successful!"
}: AdminTransactionButtonProps) {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    // 1. Single Transaction Hook
    const { writeContract, data: hash, isPending: isSinglePending, error: singleError } = useWriteContract();

    // 2. Batch Transaction Hook (Experimental / Smart Wallets)
    const { writeContracts, data: bundleId, isPending: isBatchPending, error: batchError } = useWriteContracts();

    // 3. Wait for Receipt
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash: hash as `0x${string}` | undefined
    });

    const [isLogging, setIsLogging] = useState(false);

    useEffect(() => {
        if (isSuccess && (hash || bundleId)) {
            toast.success(successMessage);
            const finalId = hash || (typeof bundleId === 'string' ? bundleId : (bundleId as unknown)?.id);
            if (onSuccess && finalId) onSuccess(finalId);
        }
    }, [isSuccess, hash, bundleId, onSuccess, successMessage]);

    useEffect(() => {
        if (singleError) toast.error((singleError as unknown).shortMessage || "Transaction failed");
        if (batchError) toast.error((batchError as unknown).shortMessage || "Batch failed");
    }, [singleError, batchError]);

    const handleClick = async () => {
        if (!calls || calls.length === 0 || !address) return;

        setIsLogging(true);
        try {
            // 1. Sign Audit Log
            const message = `Authorize Admin Onchain Tx\nTime: ${new Date().toISOString()}`;
            const signature = await signMessageAsync({ message });

            // 2. Send Audit Log
            await fetch('/api/admin-bundle?action=LOG_ONCHAIN_TX', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    message,
                    signature,
                    payload: { functionName: calls.map(c => c.functionName).join(', ') }
                })
            });

            // 3. Execute On-chain
            if (calls.length === 1) {
                // Standard single call
                writeContract({
                    address: calls[0].to,
                    abi: calls[0].abi || [], // Parent should provide ABI or use generic
                    functionName: calls[0].functionName,
                    args: calls[0].args || [],
                    value: calls[0].value || 0n,
                });
            } else {
                // Try Batch (Atomic)
                writeContracts({
                    contracts: calls.map(c => ({
                        address: c.to,
                        abi: (c.abi || []) as unknown,
                        functionName: (c.functionName || '') as unknown,
                        args: c.args || [],
                        value: c.value,
                        data: c.data
                    })) as unknown
                });
            }
        } catch (e: unknown) {
            toast.error(e.shortMessage || e.message || "Failed to authorize or execute");
        } finally {
            setIsLogging(false);
        }
    };

    const isPending = isSinglePending || isBatchPending || isConfirming || isLogging;

    return (
        <button
            onClick={handleClick}
            disabled={disabled || isPending}
            className={`${className} flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed`}
        >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isPending ? "PROCESSING..." : text}
        </button>
    );
}
