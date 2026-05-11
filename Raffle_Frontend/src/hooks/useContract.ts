import { useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignMessage, usePublicClient } from 'wagmi';
import { ABIS, CONTRACTS, APP_CONFIG } from '../lib/contracts'; // BUG-7 fix: use canonical ABI
import { awardTaskXP } from '../dailyAppLogic';
import toast from 'react-hot-toast';

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
        // In Ethers/Wagmi, return value can be array-like or object with keys
        return {
            points: (userInfo as any).points !== undefined ? Number((userInfo as any).points) : Number((userInfo as any)[0]),
            totalTasksCompleted: (userInfo as any).totalTasksCompleted !== undefined ? Number((userInfo as any).totalTasksCompleted) : Number((userInfo as any)[1]),
            referralCount: (userInfo as any).referralCount !== undefined ? Number((userInfo as any).referralCount) : Number((userInfo as any)[2]),
            currentTier: (userInfo as any).currentTier !== undefined ? Number((userInfo as any).currentTier) : Number((userInfo as any)[3]),
            tasksForReferralProgress: (userInfo as any).tasksForReferralProgress !== undefined ? Number((userInfo as any).tasksForReferralProgress) : Number((userInfo as any)[4]),
            lastDailyBonusClaim: (userInfo as any).lastDailyBonusClaim !== undefined ? Number((userInfo as any).lastDailyBonusClaim) : Number((userInfo as any)[5]),
            isBlacklisted: (userInfo as any).isBlacklisted !== undefined ? (userInfo as any).isBlacklisted : (userInfo as any)[6],
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
            baseReward: Number((task as any)[0]),
            isActive: (task as any)[1],
            cooldown: Number((task as any)[2]),
            minTier: Number((task as any)[3] || 0),
            title: (task as any)[4],
            link: (task as any)[5],
            createdAt: Number((task as any)[6]),
            requiresVerification: (task as any)[7],
            sponsorshipId: Number((task as any)[8])
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
            } catch (e: any) {
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

    const grantRole = async (role: any, account: any) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'grantRole',
            args: [role, account],
        });
    };

    const revokeRole = async (role: any, account: any) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'revokeRole',
            args: [role, account],
        });
    };

    const approveSponsorship = async (requestId: any) => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'approveSponsorship',
            args: [BigInt(requestId)],
        });
    };

    const rejectSponsorship = async (requestId: any, reason: any) => {
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
    
    // Legacy support (to be deprecated once V13 is fully live)
    const syncXP = async () => {
        return await writeContractAsync({
            address: V12_ADDRESS,
            abi: ABIS.DAILY_APP,
            functionName: 'syncMasterXPoints',
        });
    };

    // V13 Signature-based Sync
    const syncOffchainXP = async (totalDbXp: any, deadline: any, signature: any) => {
        return await writeContractAsync({
            address: V12_ADDRESS, // This will point to V13 once CONTRACTS.DAILY_APP is updated in lib/contracts
            abi: ABIS.DAILY_APP,
            functionName: 'syncOffchainXP',
            args: [BigInt(totalDbXp), BigInt(deadline), signature]
        });
    };

    return {
        syncXP,
        syncOffchainXP,
        isLoading: isConfirming
    };
}
