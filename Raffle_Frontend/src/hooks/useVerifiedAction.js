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

        // [v3.43.0] Robust Routing Logic
        // Determine if we should use the Vercel API or the dedicated Verification Server
        const isSocialTask = payload.platform && payload.platform !== 'regular' && payload.platform !== 'system';
        const verifyServerUrl = import.meta.env.VITE_VERIFY_SERVER_URL;
        
        // Final endpoint selection
        let endpoint = '/api/tasks-bundle';
        let headers = { 'Content-Type': 'application/json' };

        if (isSocialTask && verifyServerUrl) {
            // Social tasks go to the Robust Verification Server
            // Endpoint format: /api/verify/[platform]/[action]
            const platform = payload.platform.toLowerCase();
            const actionType = payload.action_type || 'task';
            endpoint = `${verifyServerUrl}/api/verify/${platform}/${actionType}`;
            
            // Verification Server requires API Secret for auth
            const apiSecret = import.meta.env.VITE_VERIFY_API_SECRET || 'disco-secure-api-key';
            headers['X-API-SECRET'] = apiSecret;
        }

        const bundleAction = (action === 'claim_task') ? 'claim' : action;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                action: bundleAction,
                wallet_address: address.toLowerCase(),
                task_id: payload.task_id,
                signature,
                message,
                // Enhanced payload for Verification Server
                platform: payload.platform,
                action: payload.action_type,
                userAddress: address.toLowerCase(),
                taskId: payload.task_id,
                socialId: payload.socialId || payload.fid || payload.twitterId, // Unified social ID
                actionParams: payload.actionParams || {
                    targetFid: payload.targetFid,
                    castHash: payload.castHash,
                    tweetId: payload.tweetId,
                    targetUserId: payload.targetUserId
                },
                xpEarned: payload.xp_earned,
                // Backward compatibility for tasks-bundle
                fid: payload.fid,
                targetFid: payload.targetFid,
                castHash: payload.castHash,
                tweetId: payload.tweetId,
                targetUserId: payload.targetUserId,
                tiktokHandle: payload.tiktokHandle,
                instagramHandle: payload.instagramHandle,
            }),
        });

        let data;
        const text = await res.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`Server returned non-JSON response: ${text.slice(0, 100)}...`);
        }

        if (!res.ok) {
            throw new Error(data.error || `Request failed: ${res.status}`);
        }

        return data;
    }, [address, signMessageAsync]);

    return { execute };
}
