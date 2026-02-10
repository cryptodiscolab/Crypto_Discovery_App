import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export function useVerification(refetchStats) {
    const [isVerifying, setIsVerifying] = useState(false);
    const [lastActionTime, setLastActionTime] = useState({});

    const verifyTask = async (task, address, taskId) => {
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

        setIsVerifying(true);
        const tid = toast.loading("Verifying quality & action...");

        try {
            // 1. Fetch ALL metadata from Supabase
            const { data: dbTask, error: dbError } = await supabase
                .from('tasks')
                .select('*')
                .eq('title', task.title)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (dbError || !dbTask) {
                console.warn('[Supabase Metadata Missing]', dbError);
            }

            const platform = dbTask?.platform || 'farcaster';
            const action = dbTask?.action_type || 'follow';

            const SERVER_URL = import.meta.env.VITE_VERIFY_SERVER_URL || "http://localhost:3000";
            const API_SECRET = import.meta.env.VITE_VERIFY_API_SECRET;

            const endpoint = `${SERVER_URL}/api/verify/${platform}/${action}`;

            // 2. Call specialized endpoints with quality requirements
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-SECRET': API_SECRET
                },
                body: JSON.stringify({
                    userAddress: address.toLowerCase(),
                    taskId: Number(taskId),
                    requirements: {
                        min_neynar_score: dbTask?.min_neynar_score || 0,
                        min_followers: dbTask?.min_followers || 0,
                        power_badge_required: dbTask?.power_badge_required || false,
                        account_age_limit: dbTask?.account_age_requirement || 0,
                        no_spam: dbTask?.no_spam_filter ?? true
                    }
                })
            });

            const result = await response.json();

            if (result.success || result.verified) {
                // Check for double claim protection (Single Source of Truth)
                const { error: completionError } = await supabase
                    .from('user_task_completions')
                    .insert([{
                        user_address: address.toLowerCase(),
                        task_id: Number(taskId),
                        platform,
                        action_type: action,
                        points_awarded: dbTask?.reward_points || task.baseReward
                    }]);

                if (completionError && completionError.code === '23505') {
                    toast.error("Anda sudah mengklaim task ini!", { id: tid });
                    return false;
                }

                toast.success("Verified! Poin telah ditambahkan ke profil.", { id: tid });
                if (refetchStats) refetchStats();
                return true;
            } else {
                const errorMsg = result.message || result.error || "Gagal verifikasi. Pastikan syarat terpenuhi.";
                toast.error(errorMsg, { id: tid });
                return false;
            }
        } catch (error) {
            console.error(error);
            toast.error("Server Verifikasi tidak merespon", { id: tid });
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
