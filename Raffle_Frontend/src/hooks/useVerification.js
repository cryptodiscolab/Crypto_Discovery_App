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
            toast.error(`Anti-Fraud: Please wait ${remaining} seconds for social changes to be indexed.`);
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
                // ── CALL TASKS-BUNDLE (SOCIAL VERIFY) ──
                // Routes to tasks-bundle.js handleSocialVerify()
                response = await fetch('/api/tasks-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'social-verify',
                        wallet_address: address,
                        signature,
                        message,
                        task_id: taskId,
                        platform: platform,
                        action_type: task.action_type || 'like',
                        fid: platform === 'farcaster' ? (userFid || task.socialId || 0) : undefined,
                        userId: platform === 'twitter' ? (userFid || task.socialId || 0) : undefined,
                        targetFid: task.targetFid,
                        castHash: task.castHash,
                        tweetId: task.tweetId,
                        targetUserId: task.targetUserId,
                        xp_reward: task.reward_points || task.baseReward || 0
                    })
                });
            } else {
                // ── NON-SOCIAL: TASKS-BUNDLE (SOCIAL-VERIFY INTERNAL) ──
                response = await fetch('/api/tasks-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'social-verify',
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

            let result;
            try {
                result = await response.json();
            } catch (jsonErr) {
                // If the response is not JSON, the server likely crashed or returned the Vercel error page
                throw new Error(`Server returned an invalid response (${response.status}). The Verifier API might be down.`);
            }

            if (response.ok && result.success) {
                // NEW: Record claim in Supabase immediately for Real-Time UX
                // This ensures XP shows up before the next cron sync
                if (isSocialTask) {
                    try {
                        await fetch('/api/tasks/social-verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                wallet_address: address,
                                signature,
                                message,
                                task_id: taskId,
                                platform: platform,
                                action_type: task.action_type || 'social'
                            })
                        });
                    } catch (e) {
                        console.warn("[Sync] Instant XP update skipped:", e.message);
                    }
                }

                toast.success(result.message || "Verified! Points added successfully.", { id: tid });
                if (refetchStats) refetchStats();
                return true;
            } else {
                // Return descriptive error from server or fallback
                const detail = result?.error || "Social action not detected or indexing delay.";
                toast.error(detail, { id: tid, duration: 5000 });
                return false;
            }
        } catch (error) {
            console.error('[Verification Error]', error);
            const errMsg = error.message || "Unknown Verification error";

            if (error.code === 4001 || error.message?.includes('rejected')) {
                toast.error("Signature rejected by user.", { id: tid });
            } else if (error.message?.includes('failed to fetch') || error.message?.includes('NetworkError')) {
                toast.error("Network Error: Verification server is unreachable.", { id: tid });
            } else {
                toast.error(errMsg, { id: tid });
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
