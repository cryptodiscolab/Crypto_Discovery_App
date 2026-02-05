import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { DISCO_MASTER_ABI } from '../shared/constants/abis';
import { useEffect, useState } from 'react';
import { formatEther } from 'ethers';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

export function useSBT() {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();

    // 1. Fetch Total Pool Balance
    const { data: totalPoolBalance, refetch: refetchPool } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'totalSBTPoolBalance',
        watch: true, // Auto-update
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

    // 4. Fetch Max Gas Price limit from contract
    const { data: maxGasPrice } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: DISCO_MASTER_ABI,
        functionName: 'maxGasPrice',
    });

    const claimRewards = async () => {
        if (!isConnected) throw new Error("Wallet not connected");
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DISCO_MASTER_ABI,
            functionName: 'claimSBTRewards',
        });
    };

    const distributePool = async () => {
        return await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: DISCO_MASTER_ABI,
            functionName: 'distributeSBTPool',
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

    const refetchAll = () => {
        refetchPool();
        refetchUser();
        refetchClaimable();
    };

    return {
        totalPoolBalance: totalPoolBalance || 0n,
        userTier,
        claimableAmount: claimableAmount || 0n,
        maxGasPrice: maxGasPrice || 0n,
        contractOwner,
        claimRewards,
        distributePool,
        updateTier,
        withdrawTreasury,
        refetchAll,
        isLoading: refetchPool && (totalPoolBalance === undefined || userRawData === undefined)
    };
}
