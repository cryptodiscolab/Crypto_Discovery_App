'use client';

import { useState } from 'react';
import { useSignMessage } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';

interface Task {
    id: number;
    title: string;
    platform?: string;
    action_type?: string;
    reward_points?: number;
    baseReward?: number;
    targetFid?: number;
    castHash?: string;
    tweetId?: string;
    targetUserId?: string;
    socialId?: number;
}

export function useVerification(onSuccess?: () => void) {
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { signMessageAsync } = useSignMessage();
    const queryClient = useQueryClient();

    const verifyTask = async (task: Task, address: string, taskId: number) => {
        if (!address) {
            setError("Wallet not connected");
            return false;
        }

        setIsVerifying(true);
        setError(null);

        try {
            // 1. Request Signature for Zero-Trust verification
            const timestamp = new Date().toISOString();
            const message = `Verify Task Action\nTask: ${task.title}\nID: ${taskId}\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const platform = (task.platform || 'farcaster').toLowerCase();
            const isSocialTask = ['farcaster', 'twitter'].includes(platform);

            let response;
            if (isSocialTask) {
                // ── CALL VERIFICATION SERVER (SOCIAL) ──
                const serverUrl = process.env.NEXT_PUBLIC_VERIFY_SERVER_URL || 'http://localhost:3000';
                const apiSecret = process.env.NEXT_PUBLIC_VERIFY_API_SECRET;

                // Determine social ID
                const socialId = task.socialId || 0;

                const endpoint = `${serverUrl}/api/verify/${platform}/${task.action_type || 'like'}`;

                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-secret': apiSecret || ''
                    },
                    body: JSON.stringify({
                        userAddress: address,
                        taskId: taskId,
                        fid: platform === 'farcaster' ? socialId : undefined,
                        userId: platform === 'twitter' ? socialId : undefined,
                        signature,
                        message,
                        targetFid: task.targetFid,
                        castHash: task.castHash,
                        tweetId: task.tweetId,
                        targetUserId: task.targetUserId
                    })
                });
            } else {
                // ── CALL INTERNAL API (REGULAR) ──
                // If daily-frontend has an internal task verification API, call it here.
                // For now, mirroring Raffle_Frontend logic
                response = await fetch('/api/tasks/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: address,
                        signature,
                        message,
                        task_id: taskId,
                        platform: platform,
                        action_type: task.action_type || 'task',
                        xp_reward: task.reward_points || task.baseReward || 0
                    })
                });
            }

            const result = await response.json();

            if (response.ok) {
                if (onSuccess) onSuccess();
                return true;
            } else {
                setError(result.error || "Gagal verifikasi.");
                return false;
            }
        } catch (err: any) {
            console.error('[Verification Error]', err);
            setError(err.message || "Server error");
            return false;
        } finally {
            setIsVerifying(false);
        }
    };

    return {
        verifyTask,
        isVerifying,
        error
    };
}
