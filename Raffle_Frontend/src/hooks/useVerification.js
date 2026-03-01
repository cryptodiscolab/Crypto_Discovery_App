import { useState } from 'react';
import { useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';

export function useVerification(refetchStats) {
    const [isVerifying, setIsVerifying] = useState(false);
    const [lastActionTime, setLastActionTime] = useState({});
    const { signMessageAsync } = useSignMessage();

    const verifyTask = async (task, address, taskId, userFid = null) => {
        // 0. Anti-Fraud: 30s Delay Check
        const now = Date.now();
        const lastTime = lastActionTime[taskId] || 0;
        const timeElapsed = (now - lastTime) / 1000;
        const WAIT_DELAY = 30;

        if (timeElapsed < WAIT_DELAY) {
            const remaining = Math.ceil(WAIT_DELAY - timeElapsed);
            toast.error(`Anti-Fraud: Tunggu ${remaining} detik agar perubahan sosial ter-index.`);
            return false;
        }

        if (!address) {
            toast.error("Wallet not connected");
            return false;
        }

        setIsVerifying(true);
        const tid = toast.loading("Requesting signature for Verification...");

        try {
            // 1. Request Signature for Zero-Trust verification
            const timestamp = new Date().toISOString();
            const message = `Verify Task Action\nTask: ${task.title}\nID: ${taskId}\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            toast.loading("Verifying on server...", { id: tid });

            const platform = task.platform?.toLowerCase() || 'farcaster';
            const isSocialTask = ['farcaster', 'twitter'].includes(platform);

            let response;
            if (isSocialTask) {
                // ── CALL VERIFICATION SERVER (SOCIAL) ──
                const serverUrl = import.meta.env.VITE_VERIFY_SERVER_URL || '';
                const apiSecret = import.meta.env.VITE_VERIFY_API_SECRET;

                // Determine social ID (FID for Farcaster, etc.)
                // In production, this should come from the user session/context
                const socialId = task.socialId || 0;

                const endpoint = `${serverUrl}/api/verify/${platform}/${task.action_type || 'like'}`;

                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-secret': apiSecret
                    },
                    body: JSON.stringify({
                        userAddress: address,
                        taskId: taskId,
                        fid: platform === 'farcaster' ? (userFid || task.socialId || 0) : undefined,
                        userId: platform === 'twitter' ? (userFid || task.socialId || 0) : undefined,
                        signature,
                        message,
                        // Add any other specific params needed by the server
                        targetFid: task.targetFid,
                        castHash: task.castHash,
                        tweetId: task.tweetId,
                        targetUserId: task.targetUserId
                    })
                });
            } else {
                // ── CALL INTERNAL API (REGULAR) ──
                // Send to secure API route
                response = await fetch('/api/tasks/social-verify', {
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
                toast.success(result.message || "Verified! Poin telah ditambahkan.", { id: tid });
                if (refetchStats) refetchStats();
                return true;
            } else {
                toast.error(result.error || "Gagal verifikasi.", { id: tid });
                return false;
            }
        } catch (error) {
            console.error('[Verification Error]', error);
            const errMsg = error.message || "Server error";
            if (error.code === 4001) {
                toast.error("Signature rejected", { id: tid });
            } else {
                toast.error(`Error: ${errMsg}`, { id: tid });
            }
            return false;
        } finally {
            setIsVerifying(false);
        }
    };

    const registerTaskStart = (taskId) => {
        setLastActionTime(prev => ({ ...prev, [taskId]: Date.now() }));
    };

    return {
        verifyTask,
        registerTaskStart,
        isVerifying,
        lastActionTime
    };
}
