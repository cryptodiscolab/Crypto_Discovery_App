import { useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignMessage } from 'wagmi';
import { V12_ABI } from '../shared/constants/abis';
import { awardTaskXP } from '../dailyAppLogic';
import toast from 'react-hot-toast';

const V12_ADDRESS = import.meta.env.VITE_V12_CONTRACT_ADDRESS || "0xEF8ab11E070359B9C0aA367656893B029c1d04d4";

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
            minTier: Number(task[3] || 0),
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
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
    const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

    const doTask = async (taskId, referrer = "0x0000000000000000000000000000000000000000") => {
        const hash = await writeContractAsync({
            address: V12_ADDRESS,
            abi: V12_ABI,
            functionName: 'doTask',
            args: [BigInt(taskId), referrer],
        });

        if (hash) {
            toast.success("Task submitted! Requesting signature for XP rewards...");
            try {
                // Secure Awarding Logic
                const timestamp = new Date().toISOString();
                const message = `Claim XP for Task Completion\nID: ${taskId}\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                await awardTaskXP(address, signature, message, taskId, 0); // Reward value handled by backend Activity Key
            } catch (e) {
                console.warn("XP Awarding skipped or failed:", e.message);
            }
        }
        return hash;
    };

    return {
        doTask,
        isLoading: isConfirming || isWaiting
    };
}
