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
export interface VerifiedActionPayload {
    task_id?: string;
    xp_earned?: number;
    platform?: string;
    action_type?: string;
    target_id?: string | null;
    socialId?: string | number;
    fid?: number;
    twitterId?: string;
    targetFid?: number;
    castHash?: string;
    tweetId?: string;
    targetUserId?: string;
    tiktokHandle?: string;
    instagramHandle?: string;
    actionParams?: {
        targetFid?: number;
        castHash?: string;
        tweetId?: string;
        targetUserId?: string;
    };
}

export function useVerifiedAction() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const normalizeSocialPlatform = (value?: string) => {
        const normalized = value?.toLowerCase().trim();
        return normalized === 'x' ? 'twitter' : normalized;
    };

    const execute = useCallback(async (action: string, payload: VerifiedActionPayload) => {
        if (!address) throw new Error('Wallet not connected');

        // Build a deterministic, human-readable message including task ID for security verification
        const timestamp = Math.floor(Date.now() / 1000);
        const taskIdStr = payload.task_id ? `\nID: ${payload.task_id}` : '';
        const message = `Crypto Disco App\nAction: ${action}\nWallet: ${address?.toLowerCase()}${taskIdStr}\nTimestamp: ${timestamp}`;

        // Sign the message via wagmi
        const signature = await signMessageAsync({ message });

        // [v3.60.0] All actions route through /api/tasks-bundle (server handles verification secret)
        const bundleAction = (action === 'claim_task') ? 'claim' : action;
        const isClaimAction = (action === 'claim_task');
        const normalizedPlatform = normalizeSocialPlatform(payload.platform);
        const isSocialVerify = !isClaimAction && normalizedPlatform && normalizedPlatform !== 'regular' && normalizedPlatform !== 'system';

        // All requests go through our server — never expose secrets client-side
        const endpoint = isSocialVerify
            ? '/api/tasks-bundle?action=social-verify'
            : '/api/tasks-bundle';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

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
                platform: normalizedPlatform || payload.platform,
                action_type: payload.action_type,
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
                target_id: payload.target_id ?? null, // ✅ v3.64.30: Anti-Sybil deduplication target
                // Backward compatibility for tasks-bundle
                fid: payload.fid,
                userId: normalizedPlatform === 'twitter' ? payload.twitterId : undefined,
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
