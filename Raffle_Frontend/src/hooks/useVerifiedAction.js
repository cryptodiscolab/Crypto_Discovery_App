import { useCallback } from 'react';
import { useSignMessage, useAccount } from 'wagmi';

/**
 * useVerifiedAction
 *
 * Frontend hook that signs a message and sends it to /api/verify-action.
 * Replaces all direct Supabase client writes for sensitive operations.
 *
 * Usage:
 *   const { execute, isLoading, error } = useVerifiedAction();
 *   await execute('claim_task', { task_id: '...', xp_earned: 50 });
 */
export function useVerifiedAction() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const execute = useCallback(async (action, payload) => {
        if (!address) throw new Error('Wallet not connected');

        // Build a deterministic, human-readable message
        // Include wallet + timestamp to prevent replay attacks
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Crypto Disco App\nAction: ${action}\nWallet: ${address.toLowerCase()}\nTimestamp: ${timestamp}`;

        // Sign the message via wagmi (triggers wallet popup)
        const signature = await signMessageAsync({ message });

        // Send to secure API route
        const res = await fetch('/api/tasks/social-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                wallet: address.toLowerCase(),
                message,
                signature,
                payload,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `Request failed: ${res.status}`);
        }

        return data;
    }, [address, signMessageAsync]);

    return { execute };
}
