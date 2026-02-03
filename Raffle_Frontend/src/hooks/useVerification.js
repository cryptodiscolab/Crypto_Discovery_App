import { useState } from 'react';
import toast from 'react-hot-toast';

export function useVerification(refetchStats) {
    const [isVerifying, setIsVerifying] = useState(false);

    const verifyTask = async (task, address, taskId) => {
        setIsVerifying(true);
        const tid = toast.loading("Verifying action...");

        try {
            // This would call the verification-server
            // In production, use import.meta.env.VITE_VERIFY_SERVER_URL
            const SERVER_URL = import.meta.env.VITE_VERIFY_SERVER_URL || "http://localhost:3000";
            const API_SECRET = import.meta.env.VITE_VERIFY_API_SECRET;

            const response = await fetch(`${SERVER_URL}/api/verify/social`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-SECRET': API_SECRET
                },
                body: JSON.stringify({
                    platform: task.title.toLowerCase().includes('twitter') ? 'twitter' : 'farcaster',
                    action: 'follow', // simplified for demo
                    userAddress: address,
                    taskId: Number(taskId),
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success("Task Verified! Points awarded.", { id: tid });
                if (refetchStats) refetchStats();
                return true;
            } else {
                toast.error(result.error || "Verification failed. Did you complete the action?", { id: tid });
                return false;
            }
        } catch (error) {
            console.error(error);
            toast.error("Verification server unreachable", { id: tid });
            return false;
        } finally {
            setIsVerifying(false);
        }
    };

    return {
        verifyTask,
        isVerifying
    };
}
