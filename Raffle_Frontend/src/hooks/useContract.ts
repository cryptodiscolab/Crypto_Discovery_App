import { useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignMessage, usePublicClient } from 'wagmi';
import { ABIS, CONTRACTS, APP_CONFIG } from '../lib/contracts'; // BUG-7 fix: use canonical ABI
import { awardTaskXP } from '../dailyAppLogic';
import toast from 'react-hot-toast';
import { ContractTask } from '../types/tasks';

export type ContractUserStats = readonly [
    bigint,   // points
    bigint,   // totalTasksCompleted
    bigint,   // referralCount
    bigint,   // currentTier
    bigint,   // tasksForReferralProgress
    bigint,   // lastDailyBonusClaim
    boolean   // isBlacklisted
];

const V12_ADDRESS = CONTRACTS.DAILY_APP as `0x${string}`;

export function useUserInfo(address: `0x${string}` | undefined) {
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
        const u = userInfo as ContractUserStats;
        return {
            points: Number(u[0]),
            totalTasksCompleted: Number(u[1]),
            referralCount: Number(u[2]),
            currentTier: Number(u[3]),
            tasksForReferralProgress: Number(u[4]),
            lastDailyBonusClaim: Number(u[5]),
            isBlacklisted: u[6],
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

export function useUserV12Stats(address: `0x${string}` | undefined) {
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

export function useTaskInfo(taskId: string | number) {
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
            baseReward: Number((task as ContractTask)[0]),
            isActive: (task as ContractTask)[1],
            cooldown: Number((task as ContractTask)[2]),
            minTier: Number((task as ContractTask)[3] || 0),
            title: (task as ContractTask)[4],
            link: (task as ContractTask)[5],
            createdAt: Number((task as ContractTask)[6]),
            requiresVerification: (task as ContractTask)[7],
            sponsorshipId: Number((task as ContractTask)[8])
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

    const doTask = async (taskId: string | number, referrer = APP_CONFIG.ZERO_ADDRESS) => {
        const hash = await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'doTask',
            args: [BigInt(taskId), referrer],
        });

        if (hash) {
            // BUG-5 fix: tunggu block confirmation sebelum award XP
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }
            toast.success("Task confirmed! Requesting signature for XP rewards...");
            try {
                // Secure Awarding Logic
                const timestamp = new Date().toISOString();
                const userAddr = address || '0x0000000000000000000000000000000000000000';
                const message = `Claim XP for Task Completion\nID: ${taskId} \nUser: ${userAddr.toLowerCase()} \nTime: ${timestamp} `;
                const signature = await signMessageAsync({ message });

                await awardTaskXP(userAddr, signature, message, taskId, 0); // Reward value handled by backend Activity Key
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                console.warn("XP Awarding skipped or failed:", message);
                toast.error('XP recording failed. Your task is confirmed but XP may sync later.');
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

    const grantRole = async (role: unknown, account: unknown) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'grantRole',
            args: [role, account],
        });
    };

    const revokeRole = async (role: unknown, account: unknown) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'revokeRole',
            args: [role, account],
        });
    };

    return { grantRole, revokeRole };
}

export function useSyncXP() {
    const { writeContractAsync, isPending: isConfirming } = useWriteContract();

    // V13 Signature-based Sync
    const syncOffchainXP = async (totalDbXp: string | number | bigint, deadline: string | number | bigint, signature: unknown) => {
        return await writeContractAsync({
            address: V12_ADDRESS, // This will point to V13 once CONTRACTS.DAILY_APP is updated in lib/contracts
            abi: ABIS.DAILY_APP,
            functionName: 'syncOffchainXP',
            args: [BigInt(totalDbXp), BigInt(deadline), signature]
        });
    };

    return {
        syncOffchainXP,
        isLoading: isConfirming
    };
}
