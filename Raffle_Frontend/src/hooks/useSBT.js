import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { ABIS } from '../lib/contracts';
import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';

const CONTRACT_ADDRESS = import.meta.env.VITE_MASTER_X_ADDRESS || "0x1ED8B135F01522505717D1E620c4EF869D7D25e7";

export function useSBT() {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();

    // 1. Fetch Total Pool Balance
    const { data: totalPoolBalance, refetch: refetchPool } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'totalSBTPoolBalance',
        query: { 
            staleTime: 0,
            refetchInterval: 30000 // Poll every 30 seconds for real-time accuracy
        }
    });

    const { data: totalLockedRewards, refetch: refetchLocked } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'totalLockedRewards',
        query: { 
            staleTime: 0,
            refetchInterval: 30000 
        }
    });

    // 2. Fetch User Data
    const { data: userRawData, refetch: refetchUser } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'users',
        args: [address],
        query: {
            enabled: !!address && isConnected,
        }
    });

    // 3. Fetch Owner for access control
    const { data: contractOwner } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'owner',
    });

    const userTier = useMemo(() => {
        if (!userRawData) return 0;
        // Supports both named and index-based access (tier is index 3 in latest ABI)
        return userRawData.tier !== undefined ? Number(userRawData.tier) : (userRawData[3] !== undefined ? Number(userRawData[3]) : Number(userRawData[1] || 0));
    }, [userRawData]);

    const userOnChainXP = useMemo(() => {
        if (!userRawData) return 0n;
        // totalXP is index 0 in latest ABI
        return userRawData.totalXP !== undefined ? userRawData.totalXP : (userRawData[0] || 0n);
    }, [userRawData]);

    // 3. Fetch User Reward Debt
    const { data: userRewardDebt, refetch: refetchDebt } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'userRewardDebt',
        args: [address],
        query: {
            enabled: !!address && isConnected,
        }
    });

    // 4. Fetch Acc Reward Per Share for user tier
    const { data: accReward, refetch: refetchAcc } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'accRewardPerShare',
        args: [userTier],
        query: {
            enabled: userTier > 0 && isConnected,
        }
    });

    const claimableAmount = (accReward !== undefined && userRewardDebt !== undefined) 
        ? ((accReward - userRewardDebt) * 1n) / 1000000000000000000n
        : 0n;

    // 4. Fetch System Settings
    const { data: maxGasPrice, refetch: refetchGas } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'maxGasPrice',
    });

    const { data: ticketPriceUSDC, refetch: refetchPrice } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'ticketPriceUSDC',
    });

    const { data: pointsPerTicket, refetch: refetchPointsPer } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'pointsPerTicket',
    });

    const { data: lastDistributeTimestamp, refetch: refetchLastDist } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'lastDistributeTimestamp',
    });

    const { data: ticketDescription, refetch: refetchDesc } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'ticketDescription',
    });

    // 5. Fetch Tier Weights
    const { data: diamondWeight } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'diamondWeight',
    });
    const { data: platinumWeight } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'platinumWeight',
    });
    const { data: goldWeight } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'goldWeight',
    });
    const { data: silverWeight } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'silverWeight',
    });
    const { data: bronzeWeight } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'bronzeWeight',
    });

    const claimRewards = async () => {
        if (!isConnected) throw new Error("Wallet not connected");
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'claimSBTRewards',
        });
    };

    const distributeRevenue = async () => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'distributeRevenue',
        });
    };

    const updateTier = async (userAddress, newTier) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'updateUserTier',
            args: [userAddress, newTier],
        });
    };

    const withdrawTreasury = async (amount) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'withdrawTreasury',
            args: [amount],
        });
    };

    const setMasterParams = async (tUSDC, mGas, pPerTicket, desc) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'setParams',
            args: [tUSDC, mGas, pPerTicket, desc],
        });
    };

    const setRaffleContract = async (raffleAddr) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'setRaffleContract',
            args: [raffleAddr],
        });
    };

    const setDailyApp = async (dailyAddr, isSatellite) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'setSatelliteStatus',
            args: [dailyAddr, isSatellite],
        });
    };

    const setTierWeights = async (d, p, g, s, b) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'setTierWeights',
            args: [BigInt(d), BigInt(p), BigInt(g), BigInt(s), BigInt(b)],
        });
    };

    /**
     * Leaderboard -> Contract Tier Sync
     * Fetches calculated tiers from API and batch updates contract
     */
    const syncTiersToContract = async (signMessageAsync) => {
        const toastId = toast.loading('Calculating tiers and preparing sync...');
        try {
            const timestamp = new Date().toISOString();
            const message = `Sync Leaderboard Tiers\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/sync-tiers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message
                })
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'API Sync failed');

            toast.loading(`Syncing ${result.data.length} users to on-chain...`, { id: toastId });

            // Optimized: Use batchUpdateUserTiers
            const userAddresses = result.data.map(item => item.wallet_address);
            const userTiers = result.data.map(item => item.computed_tier);

            const tx = await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: ABIS.MASTER_X,
                functionName: 'batchUpdateUserTiers',
                args: [userAddresses, userTiers],
            });

            toast.success(`Successfully synced ${result.data.length} tiers in one batch!`, { id: toastId });
            return { success: true, count: result.data.length, tx };

        } catch (error) {
            console.error('[SyncTiers] Error:', error);
            toast.error(`Sync failed: ${error.message}`, { id: toastId });
            throw error;
        }
    };

    // 6. Fetch Seasonal & Upgrade Settings
    const { data: currentSeasonId, refetch: refetchSeason } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: ABIS.MASTER_X,
        functionName: 'currentSeasonId',
    });

    const setTierConfig = async (tier, feeWei, minXP) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'setTierConfig',
            args: [Number(tier), BigInt(feeWei), BigInt(minXP)],
        });
    };

    const resetSeason = async (newSeasonId) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'resetSeason',
            args: [BigInt(newSeasonId)],
        });
    };

    const upgradeTier = async (feeValueWei) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'upgradeTier',
            value: BigInt(feeValueWei),
        });
    };

    const getSeasonPeak = async (userAddr, seasonId) => {
        // Since we want to use useReadContract usually, but for a specific call 
        // that depends on arguments not available at hook init, we can use a helper or another hook instance.
        // For simplicity, we'll let the component handle the specific season read if needed, 
        // but here we can provide a generic way if we want to fetch current season peak.
    };

    const refetchAll = () => {
        refetchPool();
        refetchLocked();
        refetchUser();
        refetchDebt();
        refetchAcc();
        refetchGas();
        refetchPrice();
        refetchPointsPer();
        refetchDesc();
        refetchLastDist();
        refetchSeason();
    };

    return {
        totalPoolBalance: totalPoolBalance || 0n,
        totalLockedRewards: totalLockedRewards || 0n,
        userTier,
        userOnChainXP,
        claimableAmount: claimableAmount || 0n,
        maxGasPrice: maxGasPrice || 0n,
        contractOwner,
        claimRewards,
        distributeRevenue,
        updateTier,
        withdrawTreasury,
        setMasterParams,
        setRaffleContract,
        setDailyApp,
        setTierWeights,
        syncTiersToContract,
        refetchAll,
        ticketPriceUSDC: ticketPriceUSDC || 0n,
        pointsPerTicket: pointsPerTicket || 0n,
        ticketDescription: ticketDescription || '',
        lastDistributeTimestamp: lastDistributeTimestamp || 0n,
        currentSeasonId: currentSeasonId ? Number(currentSeasonId) : 0,
        setTierConfig,
        resetSeason,
        upgradeTier,
        diamondWeight: Number(diamondWeight || 0),
        platinumWeight: Number(platinumWeight || 0),
        goldWeight: Number(goldWeight || 0),
        silverWeight: Number(silverWeight || 0),
        bronzeWeight: Number(bronzeWeight || 0),
        isLoading: refetchPool && (totalPoolBalance === undefined || userRawData === undefined)
    };
}
