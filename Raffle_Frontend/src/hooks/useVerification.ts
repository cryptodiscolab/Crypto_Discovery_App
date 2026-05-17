import { useState, useRef } from 'react';
import { useSignMessage } from 'wagmi';
import { APP_CONFIG } from '../lib/contracts';
import toast from 'react-hot-toast';

export function useVerification(refetchStats?: () => void) {
    const [isVerifying, setIsVerifying] = useState(false);
    const [lastActionTime, setLastActionTime] = useState<Record<string | number, number>>({});
    const lastActionTimeRef = useRef<Record<string | number, number>>({});
    const { signMessageAsync } = useSignMessage();

    const verifyTask = async (task: unknown, address: string, taskId: string | number, userFid: number | null = null) => {
        // 0. Anti-Fraud: 30s Delay Check
        const now = Date.now();
        const lastTime = lastActionTimeRef.current[taskId] || 0;
        const diff = Math.floor((now - lastTime) / 1000);
        const WAIT_DELAY = APP_CONFIG.SOCIAL_INDEX_DELAY_SEC;

        if (diff < WAIT_DELAY) {
            const remaining = Math.ceil(WAIT_DELAY - diff);
            toast.error(`Anti-Fraud: Please wait ${remaining} seconds for social changes to be indexed.`);
            return false;
        }

        if (!address) {
            toast.error("Wallet not connected");
            return false;
        }

        setIsVerifying(true);
        const tid = toast.loading("Requesting signature for Verification...");

        const t = task as {
            title?: string;
            platform?: string;
            action_type?: string;
            socialId?: number | string;
            tiktokHandle?: string;
            instagramHandle?: string;
            targetFid?: number | string;
            castHash?: string;
            tweetId?: string;
            targetUserId?: string;
            reward_points?: number;
            baseReward?: number;
        };

        try {
            // 1. Request Signature for Zero-Trust verification
            const timestamp = new Date().toISOString();
            const message = `Verify Task Action\nTask: ${t.title}\nID: ${taskId}\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            toast.loading("Verifying on server...", { id: tid });

            const platform = t.platform?.toLowerCase() || 'farcaster';
            const isSocialTask = ['farcaster', 'twitter', 'tiktok', 'instagram'].includes(platform);

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
                        action_type: t.action_type || 'like',
                        fid: platform === 'farcaster' ? (userFid || t.socialId || 0) : undefined,
                        userId: platform === 'twitter' ? (userFid || t.socialId || 0) : undefined,
                        tiktokHandle: platform === 'tiktok' ? (t.socialId || t.tiktokHandle || '') : undefined,
                        instagramHandle: platform === 'instagram' ? (t.socialId || t.instagramHandle || '') : undefined,
                        targetFid: t.targetFid,
                        castHash: t.castHash,
                        tweetId: t.tweetId,
                        targetUserId: t.targetUserId,
                        xp_reward: t.reward_points || t.baseReward || 0
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
                        action_type: t.action_type || 'task',
                        xp_reward: t.reward_points || t.baseReward || 0
                    })
                });
            }

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (jsonErr) {
                void jsonErr;
                // If the response is not JSON, the server likely crashed or returned the Vercel error page
                throw new Error(`Server returned an invalid response (${response.status}): ${text.slice(0, 100)}...`);
            }

            if (response.ok && result.success) {
                // NEW: Verification and recorded in Supabase is now consolidated in /api/tasks-bundle
                toast.success(result.message || "Verified! Points added successfully.", { id: tid });
                if (refetchStats) refetchStats();
                return true;
            } else {
                // Return descriptive error from server or fallback
                const detail = result?.error || "Social action not detected or indexing delay.";
                toast.error(detail, { id: tid, duration: 5000 });
                return false;
            }
        } catch (error: unknown) {
            console.error('[Verification Error]', error);
            const e = error as { code?: number | string; message?: string };
            const errMsg = e.message || "Unknown Verification error";

            if (e.code === 4001 || e.message?.includes('rejected')) {
                toast.error("Signature rejected by user.", { id: tid });
            } else if (e.message?.includes('failed to fetch') || e.message?.includes('NetworkError')) {
                toast.error("Network Error: Verification server is unreachable.", { id: tid });
            } else {
                toast.error(errMsg, { id: tid });
            }
            return false;
        } finally {
            setIsVerifying(false);
        }
    };

    const registerTaskStart = (taskId: string | number) => {
        lastActionTimeRef.current = { ...lastActionTimeRef.current, [taskId]: Date.now() };
        setLastActionTime(prev => ({ ...prev, [taskId]: Date.now() }));
    };

    return {
        verifyTask,
        registerTaskStart,
        isVerifying,
        lastActionTime
    };
}
