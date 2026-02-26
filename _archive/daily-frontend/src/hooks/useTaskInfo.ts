'use client';

import { useReadContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '@/lib/contracts';

export function useTaskInfo(taskId: number) {
    const { data: task, isLoading } = useReadContract({
        address: CONTRACTS.DAILY_APP,
        abi: DAILY_APP_ABI,
        functionName: 'getTask',
        args: [BigInt(taskId)],
    });

    if (!task || isLoading) return { task: null, isLoading };

    // Standard mapping from Contract Tuple to Task Object
    return {
        task: {
            id: Number(taskId),
            baseReward: Number(task[0]),
            isActive: task[1],
            cooldown: Number(task[2]),
            minTier: Number(task[3] || 0),
            title: task[4] as string,
            link: task[5] as string,
            createdAt: Number(task[6]),
            requiresVerification: task[7] as boolean,
            sponsorshipId: Number(task[8]),
            // Default platform/action_type if not in contract (can be supplemented by metadata)
            platform: (task[4] as string).toLowerCase().includes('twitter') ? 'twitter' : 'farcaster',
            action_type: (task[4] as string).toLowerCase().includes('follow') ? 'follow' : 'like'
        },
        isLoading
    };
}
