import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { DISCO_MASTER_ABI } from '../shared/constants/abis';
import { useEffect, useState } from 'react';

const CONTRACT_ADDRESS = import.meta.env.VITE_MASTER_X_ADDRESS || "0x78a566a11AcDA14b2A4F776227f61097C7381C84";

export function useSBT() {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();

    // 1. Fetch Total Pool Balance
    const { data: totalPoolBalance, refetch: refetchPool } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'totalSBTPoolBalance',
        query: {
            staleTime: 60 * 60 * 1000, // 1 hour cache
            gcTime: 24 * 60 * 60 * 1000, // 24 hours persistence
        }
    });

    // 2. Fetch User Data
    const { data: userRawData, refetch: refetchUser } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'users',
        args: [address],
        query: {
            enabled: !!address && isConnected,
        }
    });

    // 3. Fetch Owner for access control
    const { data: contractOwner } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'owner',
    });

    const userTier = userRawData ? Number(userRawData[1]) : 0;

    // 3. Fetch Claimable Amount for current user tier
    const { data: claimableAmount, refetch: refetchClaimable } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'tierClaimablePerHolder',
        args: [userTier],
        query: {
            enabled: userTier > 0 && isConnected,
        }
    });

    // 4. Fetch System Settings
    const { data: maxGasPrice, refetch: refetchGas } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'maxGasPrice',
    });

    const { data: ticketPriceUSDC, refetch: refetchPrice } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'ticketPriceUSDC',
    });

    const { data: pointsPerTicket, refetch: refetchPointsPer } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'pointsPerTicket',
    });

    const { data: lastDistributeTimestamp, refetch: refetchLastDist } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'lastDistributeTimestamp',
    });

    const { data: ticketDescription, refetch: refetchDesc } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'ticketDescription',
    });

    const claimRewards = async () => {
        if (!isConnected) throw new Error("Wallet not connected");
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DISCO_MASTER_ABI,
            functionName: 'claimSBTRewards',
        });
    };

    const distributeRevenue = async () => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DISCO_MASTER_ABI,
            functionName: 'distributeRevenue',
        });
    };

    const updateTier = async (userAddress, newTier) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DISCO_MASTER_ABI,
            functionName: 'updateUserTier',
            args: [userAddress, newTier],
        });
    };

    const withdrawTreasury = async (amount) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DISCO_MASTER_ABI,
            functionName: 'withdrawTreasury',
            args: [amount],
        });
    };

    const setMasterParams = async (tUSDC, mGas, pPerTicket, desc) => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DISCO_MASTER_ABI,
            functionName: 'setParams',
            args: [tUSDC, mGas, pPerTicket, desc],
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
                abi: DISCO_MASTER_ABI,
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

    const refetchAll = () => {
        refetchPool();
        refetchUser();
        refetchClaimable();
        refetchGas();
        refetchPrice();
        refetchPointsPer();
        refetchDesc();
        refetchLastDist();
    };

    return {
        totalPoolBalance: totalPoolBalance || 0n,
        userTier,
        claimableAmount: claimableAmount || 0n,
        maxGasPrice: maxGasPrice || 0n,
        contractOwner,
        claimRewards,
        distributeRevenue,
        updateTier,
        withdrawTreasury,
        setMasterParams,
        syncTiersToContract,
        refetchAll,
        ticketPriceUSDC: ticketPriceUSDC || 0n,
        pointsPerTicket: pointsPerTicket || 0n,
        ticketDescription: ticketDescription || '',
        lastDistributeTimestamp: lastDistributeTimestamp || 0n,
        isLoading: refetchPool && (totalPoolBalance === undefined || userRawData === undefined)
    };
}
