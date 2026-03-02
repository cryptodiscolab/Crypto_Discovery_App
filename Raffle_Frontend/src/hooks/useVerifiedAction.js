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

        const serverUrl = import.meta.env.VITE_VERIFY_SERVER_URL || 'http://localhost:3000';
        const apiSecret = import.meta.env.VITE_VERIFY_API_SECRET;

        // Build a deterministic, human-readable message
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Crypto Disco App\nAction: ${action}\nWallet: ${address.toLowerCase()}\nTimestamp: ${timestamp}`;

        // Sign the message via wagmi
        const signature = await signMessageAsync({ message });

        // Map generic actions to specific verification server endpoints
        let endpoint = `${serverUrl}/api/verify/${action.replace('_', '/')}`;

        // Special case for legacy 'claim_task' or social tasks
        if (action === 'claim_task' || payload.platform) {
            const platform = payload.platform || 'farcaster';
            const actionType = payload.actionType || 'follow';
            endpoint = `${serverUrl}/api/verify/${platform}/${actionType}`;
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-secret': apiSecret
            },
            body: JSON.stringify({
                userAddress: address.toLowerCase(),
                taskId: payload.task_id_contract || payload.task_id, // contract ID
                dbTaskId: payload.task_id, // database UUID
                xpEarned: payload.xp_earned,
                fid: payload.fid,
                targetFid: payload.targetFid,
                castHash: payload.castHash,
                userId: payload.userId,
                tweetId: payload.tweetId,
                targetUserId: payload.targetUserId,
                signature,
                message,
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
