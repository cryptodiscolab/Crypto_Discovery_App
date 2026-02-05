import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { V12_ABI } from '../shared/constants/abis';

const V12_ADDRESS = import.meta.env.VITE_V12_CONTRACT_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS;
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';

export function useUserInfo(address) {
    const { data: userInfo, isLoading } = useReadContract({
        address: V12_ADDRESS,
        abi: V12_ABI,
        functionName: 'getUserStats',
        args: [address],
        query: { enabled: !!address }
    });

    if (!address) return { stats: null, isLoading: false };

    return {
        stats: userInfo ? {
            points: userInfo[0],
            totalTasksCompleted: userInfo[1],
            referralCount: userInfo[2],
            currentTier: userInfo[3],
            tasksForReferralProgress: userInfo[4],
            lastDailyBonusClaim: userInfo[5],
            isBlacklisted: userInfo[6]
        } : null,
        isLoading
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
    const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
    const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

    const doTask = async (taskId, referrer = "0x0000000000000000000000000000000000000000") => {
        if (MOCK_MODE) {
            console.log("Mock Task Done:", taskId);
            return;
        }
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: V12_ABI,
            functionName: 'doTask',
            args: [BigInt(taskId), referrer],
        });
    };

    return {
        doTask,
        isLoading: isConfirming || isWaiting
    };
}
