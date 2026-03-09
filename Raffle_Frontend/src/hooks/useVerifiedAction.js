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
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Crypto Disco App\nAction: ${action}\nWallet: ${address.toLowerCase()}\nTimestamp: ${timestamp}`;

        // Sign the message via wagmi
        const signature = await signMessageAsync({ message });

        // All task claims go to the Vercel serverless endpoint (never localhost)
        const endpoint = '/api/tasks-bundle';
        const bundleAction = (action === 'claim_task') ? 'claim' : action;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: bundleAction,
                wallet_address: address.toLowerCase(),
                task_id: payload.task_id,
                signature,
                message,
                // Optional social task fields (passed through if present)
                fid: payload.fid,
                targetFid: payload.targetFid,
                castHash: payload.castHash,
                tweetId: payload.tweetId,
                targetUserId: payload.targetUserId,
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
