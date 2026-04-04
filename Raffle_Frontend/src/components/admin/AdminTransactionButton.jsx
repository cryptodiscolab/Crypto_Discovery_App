import React, { useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useWriteContracts } from 'wagmi/experimental';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

/**
 * Shared Admin Transaction Button for v3.41.2 Hardening
 * Replaces OnchainKit Transaction components in Admin views.
 * Supports single calls via useWriteContract or batches via useWriteContracts.
 */
export function AdminTransactionButton({ 
    calls, 
    onSuccess, 
    text, 
    disabled, 
    className = "",
    successMessage = "Transaction Successful!"
}) {
    // 1. Single Transaction Hook
    const { writeContract, data: hash, isPending: isSinglePending, error: singleError } = useWriteContract();
    
    // 2. Batch Transaction Hook (Experimental / Smart Wallets)
    const { writeContracts, data: bundleId, isPending: isBatchPending, error: batchError } = useWriteContracts();

    // 3. Wait for Receipt
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
        hash: hash || bundleId 
    });

    useEffect(() => {
        if (isSuccess && (hash || bundleId)) {
            toast.success(successMessage);
            if (onSuccess) onSuccess(hash || bundleId);
        }
    }, [isSuccess, hash, bundleId, onSuccess, successMessage]);

    useEffect(() => {
        if (singleError) toast.error(singleError.shortMessage || "Transaction failed");
        if (batchError) toast.error(batchError.shortMessage || "Batch failed");
    }, [singleError, batchError]);

    const handleClick = () => {
        if (!calls || calls.length === 0) return;

        if (calls.length === 1) {
            // Standard single call
            writeContract({
                address: calls[0].to,
                abi: calls[0].abi || [], // Parent should provide ABI or use generic
                functionName: calls[0].functionName,
                args: calls[0].args || [],
                value: calls[0].value || 0n,
                data: calls[0].data // Fallback for encoded data
            });
        } else {
            // Try Batch (Atomic)
            writeContracts({
                contracts: calls.map(c => ({
                    address: c.to,
                    abi: c.abi,
                    functionName: c.functionName,
                    args: c.args,
                    value: c.value,
                    data: c.data
                }))
            });
        }
    };

    const isPending = isSinglePending || isBatchPending || isConfirming;

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
