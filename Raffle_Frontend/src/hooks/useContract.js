import { useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignMessage, usePublicClient } from 'wagmi';
import { ABIS, CONTRACTS, APP_CONFIG } from '../lib/contracts'; // BUG-7 fix: use canonical ABI
import { awardTaskXP } from '../dailyAppLogic';
import toast from 'react-hot-toast';

const V12_ADDRESS = CONTRACTS.DAILY_APP;

export function useUserInfo(address) {
    const { data: userInfo, isLoading, refetch } = useReadContract({
        address: V12_ADDRESS,
        abi: ABIS.DAILY_APP,
        functionName: 'userStats',
        args: [address],
        query: { enabled: !!address }
    });

    const { data: lastActivity } = useReadContract({
        address: V12_ADDRESS,
        abi: ABIS.DAILY_APP,
        functionName: 'lastActivityTime',
        args: [address],
        query: { enabled: !!address }
    });

    const stats = useMemo(() => {
        if (!userInfo) return null;
        // In Ethers/Wagmi, return value can be array-like or object with keys
        return {
            points: userInfo.points !== undefined ? Number(userInfo.points) : Number(userInfo[0]),
            totalTasksCompleted: userInfo.totalTasksCompleted !== undefined ? Number(userInfo.totalTasksCompleted) : Number(userInfo[1]),
            referralCount: userInfo.referralCount !== undefined ? Number(userInfo.referralCount) : Number(userInfo[2]),
            currentTier: userInfo.currentTier !== undefined ? Number(userInfo.currentTier) : Number(userInfo[3]),
            tasksForReferralProgress: userInfo.tasksForReferralProgress !== undefined ? Number(userInfo.tasksForReferralProgress) : Number(userInfo[4]),
            lastDailyBonusClaim: userInfo.lastDailyBonusClaim !== undefined ? Number(userInfo.lastDailyBonusClaim) : Number(userInfo[5]),
            isBlacklisted: userInfo.isBlacklisted !== undefined ? userInfo.isBlacklisted : userInfo[6],
            lastActivity: lastActivity ? Number(lastActivity) : 0
        };
    }, [userInfo, lastActivity]);

    if (!address) return { stats: null, isLoading: false, refetch: () => { } };

    return {
        stats,
        isLoading,
        refetch
    };
}

export function useV12Stats() {
    const { data: userCount } = useReadContract({
        address: V12_ADDRESS,
        abi: ABIS.DAILY_APP,
        functionName: 'userCount',
    });

    const { data: totalSponsors } = useReadContract({
        address: V12_ADDRESS,
        abi: ABIS.DAILY_APP,
        functionName: 'totalSponsorRequests',
    });

    return {
        totalUsers: userCount ? Number(userCount) : 0,
        totalTransactions: 0, // Not explicitly tracked
        totalSponsors: totalSponsors ? Number(totalSponsors) : 0,
    };
}

export function useUserV12Stats(address) {
    return useUserInfo(address);
}

export function useAllTasks() {
    const { data: totalTasks, isLoading } = useReadContract({
        address: V12_ADDRESS,
        abi: ABIS.DAILY_APP,
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
        abi: ABIS.DAILY_APP,
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

    const publicClient = usePublicClient();

    const doTask = async (taskId, referrer = APP_CONFIG.ZERO_ADDRESS) => {
        const hash = await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'doTask',
            args: [BigInt(taskId), referrer],
        });

        if (hash) {
            // BUG-5 fix: tunggu block confirmation sebelum award XP
            await publicClient.waitForTransactionReceipt({ hash });
            toast.success("Task confirmed! Requesting signature for XP rewards...");
            try {
                // Secure Awarding Logic
                const timestamp = new Date().toISOString();
                const message = `Claim XP for Task Completion\nID: ${taskId} \nUser: ${address.toLowerCase()} \nTime: ${timestamp} `;
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

export function useDailyAppAdmin() {
    const { writeContractAsync } = useWriteContract();

    const grantRole = async (role, account) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'grantRole',
            args: [role, account],
        });
    };

    const revokeRole = async (role, account) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'revokeRole',
            args: [role, account],
        });
    };

    const approveSponsorship = async (requestId) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'approveSponsorship',
            args: [BigInt(requestId)],
        });
    };

    const rejectSponsorship = async (requestId, reason) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'rejectSponsorship',
            args: [BigInt(requestId), reason],
        });
    };

    return { grantRole, revokeRole, approveSponsorship, rejectSponsorship };
}

export function useSyncXP() {
    const { writeContractAsync, isPending: isConfirming } = useWriteContract();
    
    const syncXP = async () => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'syncMasterXPoints',
        });
    };

    return {
        syncXP,
        isLoading: isConfirming
    };
}
