/* eslint-disable no-unused-vars */
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// 1. Configuration
const RAFFLE_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const V12_ADDRESS = import.meta.env.VITE_V12_CONTRACT_ADDRESS || RAFFLE_ADDRESS; // Fallback if not set
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dcf7e"; // Base Sepolia Standard USDC

// 2. Comprehensive ABI
const MAIN_ABI = [
  // NFTRaffle Functions
  "function createRaffle(address[] calldata _nftContracts, uint256[] calldata _tokenIds, uint256 _duration) external",
  "function claimDailyFreeTicket() external",
  "function buyTickets(uint256 _raffleId, uint256 _amount, bool _useFreeTickets) external",
  "function drawWinner(uint256 _raffleId) external",
  "function claimPrizes(uint256 _raffleId) external",
  "function getRaffleInfo(uint256 _raffleId) external view returns (uint256 raffleId, address creator, uint256 startTime, uint256 endTime, uint256 ticketsSold, uint256 paidTicketsSold, bool isActive, bool isCompleted, address winner, uint256 nftCount)",
  "function getUserTickets(uint256 _raffleId, address _user) external view returns (uint256)",
  "function getUserInfo(address _user) external view returns (uint256 totalTicketsPurchased, uint256 totalWins, uint256 freeTicketsAvailable, uint256 lastFreeTicketClaim)",
  "function raffleIdCounter() external view returns (uint256)",
  "function ticketPrice() external view returns (uint256)",
  "function usdcToken() external view returns (address)",
  "function withdrawRaffleRevenue(uint256 _raffleId) external",
  "function withdrawFees() external",
  "function totalFees() external view returns (uint256)",
  "function owner() external view returns (address)",

  // DailyApp V12 Functions
  "function doTask(uint256 _taskId, address _referrer) external",
  "function addTask(uint256 _baseReward, uint256 _cooldown, uint8 _minTier, string calldata _title, string calldata _link, bool _requiresVerification) external",
  "function markTaskAsVerified(address _user, uint256 _taskId) external",
  "function isTaskVerified(address _user, uint256 _taskId) external view returns (bool)",
  "function getUserStats(address _user) external view returns (uint256 points, uint256 totalTasksCompleted, uint256 referralCount, uint8 currentTier, uint256 tasksForReferralProgress, uint256 lastDailyBonusClaim, bool isBlacklisted)",
  "function getTask(uint256 _taskId) external view returns (uint256 baseReward, bool isActive, uint256 cooldown, uint8 minTier, string title, string link, uint256 createdAt, bool requiresVerification, uint256 sponsorshipId)",
  "function getContractStats() external view returns (uint256 totalUsers, uint256 totalTransactions, uint256 totalSponsors, uint256 contractTokenBalance, uint256 contractETHBalance)",
  "function nextTaskId() external view returns (uint256)",
  "function userCount() external view returns (uint256)",
  "function globalTxCount() external view returns (uint256)",

  // Standard Token Functions (USDC)
  {
    "constant": false,
    "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_spender", "type": "address" }],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

// --- 3. COMMON HOOKS ---

export function useUSDCApproval() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

  const checkAndApprove = async (spenderAddress, amount) => {
    if (!address) return false;
    try {
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: MAIN_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
      });
      return true;
    } catch (error) {
      console.error('Approval failed:', error);
      return false;
    }
  };

  return {
    checkAndApprove,
    isLoading: isConfirming || isWaiting
  };
}

// --- 4. RAFFLE HOOKS ---

export function useTotalRaffles() {
  const { data } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'raffleIdCounter',
    query: { refetchInterval: 10000 }
  });
  return { totalRaffles: data ? Number(data) : 0 };
}

export function useRaffleInfo(raffleId) {
  const { data, isLoading, refetch } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'getRaffleInfo',
    args: [BigInt(raffleId)],
  });

  if (!data || isLoading) return { raffleInfo: null, isLoading };

  const [id, creator, startTime, endTime, ticketsSold, paidTicketsSold, isActive, isCompleted, winner, nftCount] = data;

  return {
    raffleInfo: {
      id, creator, startTime, endTime, ticketsSold, paidTicketsSold, isActive, isCompleted, winner, nftCount
    },
    isLoading,
    refetch
  };
}

export function useBuyTickets() {
  const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

  const buyTickets = async (raffleId, amount, useFreeTickets = false) => {
    return await writeContractAsync({
      address: RAFFLE_ADDRESS,
      abi: MAIN_ABI,
      functionName: 'buyTickets',
      args: [BigInt(raffleId), BigInt(amount), useFreeTickets],
    });
  };

  return { buyTickets, isLoading: isConfirming || isWaiting };
}

export function useClaimDailyFreeTicket() {
  const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

  const claimTicket = async () => {
    return await writeContractAsync({
      address: RAFFLE_ADDRESS,
      abi: MAIN_ABI,
      functionName: 'claimDailyFreeTicket',
    });
  };

  return { claimTicket, isLoading: isConfirming || isWaiting };
}

export function useUserInfo(userAddress) {
  const { data, isLoading } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'getUserInfo',
    args: [userAddress],
    query: { enabled: !!userAddress, refetchInterval: 15000 }
  });

  if (!data || isLoading) return { userInfo: null, isLoading };

  const [totalTicketsPurchased, totalWins, freeTicketsAvailable, lastFreeTicketClaim] = data;

  return {
    userInfo: {
      totalTicketsPurchased, totalWins, freeTicketsAvailable, lastFreeTicketClaim
    },
    isLoading
  };
}

export function useDrawWinner() {
  const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

  const drawWinner = async (raffleId) => {
    return await writeContractAsync({
      address: RAFFLE_ADDRESS,
      abi: MAIN_ABI,
      functionName: 'drawWinner',
      args: [BigInt(raffleId)],
    });
  };

  return { drawWinner, isLoading: isConfirming || isWaiting };
}

export function useClaimPrizes() {
  const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

  const claimPrizes = async (raffleId) => {
    return await writeContractAsync({
      address: RAFFLE_ADDRESS,
      abi: MAIN_ABI,
      functionName: 'claimPrizes',
      args: [BigInt(raffleId)],
    });
  };

  return { claimPrizes, isLoading: isConfirming || isWaiting };
}

export function useCreateRaffle() {
  const { writeContractAsync, data: hash, isPending: isConfirming } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash });

  const createRaffle = async (nftContracts, tokenIds, duration) => {
    return await writeContractAsync({
      address: RAFFLE_ADDRESS,
      abi: MAIN_ABI,
      functionName: 'createRaffle',
      args: [nftContracts, tokenIds, duration],
    });
  };

  return { createRaffle, isLoading: isConfirming || isWaiting };
}

// --- 5. ADMIN HOOKS ---

export function useAdminInfo() {
  const { data: ownerAddress } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'owner',
  });

  const { data: totalFees } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'totalFees',
  });

  return { adminAddress: ownerAddress, totalFees: totalFees || 0n };
}

export function useWithdrawRevenue() {
  const { writeContractAsync, isPending } = useWriteContract();
  const withdrawRevenue = (raffleId) => writeContractAsync({
    address: RAFFLE_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'withdrawRaffleRevenue',
    args: [BigInt(raffleId)]
  });
  return { withdrawRevenue, isLoading: isPending };
}

export function useWithdrawFees() {
  const { writeContractAsync, isPending } = useWriteContract();
  const withdrawFees = () => writeContractAsync({
    address: RAFFLE_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'withdrawFees'
  });
  return { withdrawFees, isLoading: isPending };
}

// --- 6. DAILYAPP V12 HOOKS (Tasks & Stats) ---

export function useV12Stats() {
  const { data } = useReadContract({
    address: V12_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'getContractStats',
  });

  if (!data) return { totalUsers: 0, totalTransactions: 0, totalSponsors: 0 };

  const [totalUsers, totalTransactions, totalSponsors] = data;
  return {
    totalUsers: Number(totalUsers),
    totalTransactions: Number(totalTransactions),
    totalSponsors: Number(totalSponsors)
  };
}

export function useUserV12Stats(userAddress) {
  const { data, isLoading } = useReadContract({
    address: V12_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'getUserStats',
    args: [userAddress],
    query: { enabled: !!userAddress }
  });

  if (!data) return { stats: null, isLoading };

  const [points, totalTasksCompleted, referralCount, currentTier, tasksForReferralProgress, lastDailyBonusClaim, isBlacklisted] = data;

  return {
    stats: {
      points, totalTasksCompleted, referralCount, currentTier, tasksForReferralProgress, lastDailyBonusClaim, isBlacklisted
    },
    isLoading
  };
}

export function useDoTask() {
  const { writeContractAsync, isPending } = useWriteContract();
  const doTask = (taskId, referrer = "0x0000000000000000000000000000000000000000") => writeContractAsync({
    address: V12_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'doTask',
    args: [BigInt(taskId), referrer]
  });
  return { doTask, isLoading: isPending };
}

export function useAllTasks() {
  const { data: totalTasks } = useReadContract({
    address: V12_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'nextTaskId',
  });

  return { totalTasks: totalTasks ? Number(totalTasks) : 0 };
}

export function useTaskInfo(taskId) {
  const { data, isLoading } = useReadContract({
    address: V12_ADDRESS,
    abi: MAIN_ABI,
    functionName: 'getTask',
    args: [BigInt(taskId)],
  });

  if (!data) return { task: null, isLoading };

  const [baseReward, isActive, cooldown, minTier, title, link, createdAt, requiresVerification, sponsorshipId] = data;

  return {
    task: {
      baseReward, isActive, cooldown, minTier, title, link, createdAt, requiresVerification, sponsorshipId
    },
    isLoading
  };
}
