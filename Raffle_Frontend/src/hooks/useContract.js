import { useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { V12_ABI } from '../shared/constants/abis';
import { addXP, rewardReferrer } from '../dailyAppLogic';

const V12_ADDRESS = import.meta.env.VITE_V12_CONTRACT_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS;
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';

export function useUserInfo(address) {
    const { data: userInfo, isLoading, refetch } = useReadContract({
        address: V12_ADDRESS,
        abi: V12_ABI,
        functionName: 'getUserStats',
        args: [address],
        query: { enabled: !!address }
    });

    const stats = useMemo(() => {
        if (!userInfo) return null;
        return {
            points: userInfo[0],
            totalTasksCompleted: userInfo[1],
            referralCount: userInfo[2],
            currentTier: userInfo[3],
            tasksForReferralProgress: userInfo[4],
            lastDailyBonusClaim: userInfo[5],
            isBlacklisted: userInfo[6]
        };
    }, [userInfo]);

    if (!address) return { stats: null, isLoading: false, refetch: () => { } };

    return {
        stats,
        isLoading,
        refetch
    };
}

export function useV12Stats() {
    const { data } = useReadContract({
        address: V12_ADDRESS,
        abi: V12_ABI,
        functionName: 'getContractStats',
    });

    if (!data) return { totalUsers: 0, totalTransactions: 0, totalSponsors: 0 };

    return {
        totalUsers: Number(data[0]),
        totalTransactions: Number(data[1]),
        totalSponsors: Number(data[2]),
        contractTokenBalance: data[3],
        contractETHBalance: data[4]
    };
}

export function useUserV12Stats(address) {
    return useUserInfo(address);
}

export function useAllTasks() {
    const { data: totalTasks, isLoading } = useReadContract({
        address: V12_ADDRESS,
        abi: V12_ABI,
        functionName: 'nextTaskId',
    });

    return {
        totalTasks: totalTasks ? Number(totalTasks) : 0,
        isLoading
    };
}

export function useTaskInfo(taskId) {
    const { data: task, isLoading } = useReadContract({
        address: V12_ADDRESS,
        abi: V12_ABI,
        functionName: 'getTask',
        args: [BigInt(taskId)],
    });

    if (!task || isLoading) return { task: null, isLoading };

    return {
        task: {
            id: Number(taskId),
            baseReward: Number(task[0]),
            isActive: task[1],
            cooldown: Number(task[2]),
            minTier: task[3],
            title: task[4],
            link: task[5],
            createdAt: Number(task[6]),
            requiresVerification: task[7],
            sponsorshipId: Number(task[8])
        },
        isLoading
    };
}

export function useDoTask() {
    const { address } = useAccount();
    const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
    const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

    const doTask = async (taskId, referrer = "0x0000000000000000000000000000000000000000") => {
        if (MOCK_MODE) {
            console.log("Mock Task Done:", taskId);
            return;
        }
        const hash = await writeContractAsync({
            address: V12_ADDRESS,
            abi: V12_ABI,
            functionName: 'doTask',
            args: [BigInt(taskId), referrer],
        });

        if (hash) {
            // 1. Award Points to User
            const fid = 1477344; // Context needed
            addXP(fid, 'task_complete', address);

            // 2. Reward Referrer if present
            if (referrer && referrer !== "0x0000000000000000000000000000000000000000") {
                // We'd need to find the referrer's FID from their address in a real scenario
                // For now, signaling the logic
                console.log("[Referral] Rewarding referrer:", referrer);
            }
        }
        return hash;
    };

    return {
        doTask,
        isLoading: isConfirming || isWaiting
    };
}
