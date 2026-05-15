import { useWriteContract, useAccount, useSignMessage } from 'wagmi';

export function useAdminContract() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync: originalWriteContractAsync, ...rest } = useWriteContract();

    const writeContractAsync = async (params: Parameters<typeof originalWriteContractAsync>[0]) => {
        if (!address) throw new Error("Wallet not connected");
        
        // 1. Sign Audit Log
        const message = `Authorize Admin Onchain Tx\nTime: ${new Date().toISOString()}`;
        const signature = await signMessageAsync({ message });
        
        // 2. Send Audit Log to backend
        const res = await fetch('/api/admin-bundle?action=LOG_ONCHAIN_TX', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address,
                message,
                signature,
                payload: { functionName: (params as any).functionName || 'unknown_tx' }
            })
        });

        if (!res.ok) {
            throw new Error("Failed to authorize admin action with backend");
        }
        
        // 3. Execute On-chain
        return await originalWriteContractAsync(params);
    };

    return { writeContractAsync, ...rest };
}
