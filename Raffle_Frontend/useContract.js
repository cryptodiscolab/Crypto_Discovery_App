import { useContractRead, useContractWrite, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

const ABI = [
  "function createRaffle(address[] calldata _nftContracts, uint256[] calldata _tokenIds, uint256 _duration) external",
  "function claimDailyFreeTicket() external",
  "function buyTickets(uint256 _raffleId, uint256 _amount, bool _useFreeTickets) external",
  "function drawWinner(uint256 _raffleId) external",
  "function claimPrizes(uint256 _raffleId) external",
  "function getRaffleInfo(uint256 _raffleId) external view returns (uint256, address, uint256, uint256, uint256, uint256, bool, bool, address, uint256)",
  "function getUserTickets(uint256 _raffleId, address _user) external view returns (uint256)",
  "function getUserInfo(address _user) external view returns (uint256, uint256, uint256, uint256)",
  "function raffleIdCounter() external view returns (uint256)",
  "function ticketPrice() external view returns (uint256)",
  "function usdcToken() external view returns (address)",
  "function withdrawFees() external",
  "function withdrawRaffleRevenue(uint256 _raffleId) external",
  "function admin() external view returns (address)",
  "function totalFees() external view returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

// Hook untuk claim free ticket
export function useClaimFreeTicket() {
  const { write, data, isLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'claimDailyFreeTicket',
  });

  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const claimFreeTicket = async () => {
    try {
      await write();
      toast.success('Claiming free ticket...');
    } catch (error) {
      toast.error(error?.message || 'Failed to claim free ticket');
    }
  };

  return {
    claimFreeTicket,
    isLoading: isLoading || isWaiting,
    isSuccess,
  };
}
// Hook untuk USDC Approval
export function useUSDCApproval() {
  const { data: usdcAddress } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'usdcToken',
  });

  const { writeAsync: approve, data, isLoading } = useContractWrite({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
  });

  const { isLoading: isWaiting } = useWaitForTransaction({
    hash: data?.hash,
  });

  const checkAndApprove = async (spender, amount) => {
    try {
      if (!usdcAddress) return false;
      await approve({
        args: [spender, amount],
      });
      return true;
    } catch (error) {
      console.error('Approval failed:', error);
      return false;
    }
  };

  return {
    checkAndApprove,
    isLoading: isLoading || isWaiting,
    usdcAddress,
  };
}

// Hook untuk buy tickets
export function useBuyTickets() {
  const { write, data, isLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'buyTickets',
  });

  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const buyTickets = async (raffleId, amount, useFreeTickets = false) => {
    try {
      // Get ticket price first (should be fetched from contract in a real app)
      // For now we use the known 0.15 USDC (6 decimals)
      const ticketPrice = parseUnits('0.15', 6);
      const totalCost = ticketPrice * BigInt(amount);

      await write({
        args: [raffleId, BigInt(amount), useFreeTickets],
      });
      toast.success('Buying tickets...');
    } catch (error) {
      toast.error(error?.message || 'Failed to buy tickets');
    }
  };

  return {
    buyTickets,
    isLoading: isLoading || isWaiting,
    isSuccess,
  };
}

// Hook untuk get raffle info
export function useRaffleInfo(raffleId) {
  const { data, isLoading, refetch } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getRaffleInfo',
    args: [raffleId],
    watch: true,
  });

  return {
    raffleInfo: data ? {
      raffleId: data[0],
      creator: data[1],
      startTime: data[2],
      endTime: data[3],
      ticketsSold: data[4],
      paidTicketsSold: data[5],
      isActive: data[6],
      isCompleted: data[7],
      winner: data[8],
      nftCount: data[9],
    } : null,
    isLoading,
    refetch,
  };
}

// Hook untuk get user info
export function useUserInfo(address) {
  const { data, isLoading, refetch } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getUserInfo',
    args: [address],
    enabled: !!address,
    watch: true,
  });

  return {
    userInfo: data ? {
      totalTicketsPurchased: data[0],
      totalWins: data[1],
      freeTicketsAvailable: data[2],
      lastFreeTicketClaim: data[3],
    } : null,
    isLoading,
    refetch,
  };
}

// Hook untuk get total raffles
export function useTotalRaffles() {
  const { data, isLoading } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'raffleIdCounter',
    watch: true,
  });

  return {
    totalRaffles: data ? Number(data) : 0,
    isLoading,
  };
}

// Hook untuk draw winner
export function useDrawWinner() {
  const { write, data, isLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'drawWinner',
  });

  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const drawWinner = async (raffleId) => {
    try {
      await write({
        args: [raffleId],
      });
      toast.success('Drawing winner...');
    } catch (error) {
      toast.error(error?.message || 'Failed to draw winner');
    }
  };

  return {
    drawWinner,
    isLoading: isLoading || isWaiting,
    isSuccess,
  };
}

// Hook untuk claim prizes
export function useClaimPrizes() {
  const { write, data, isLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'claimPrizes',
  });

  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const claimPrizes = async (raffleId, paidTicketsSold) => {
    try {
      // Note: claimFee is calculated on-chain, but we need it here if we were using 'value'
      // Since we use safeTransferFrom, the user just needs to have approved it.
      await write({
        args: [raffleId],
      });
      toast.success('Claiming prizes...');
    } catch (error) {
      toast.error(error?.message || 'Failed to claim prizes');
    }
  };

  return {
    claimPrizes,
    isLoading: isLoading || isWaiting,
    isSuccess,
  };
}

// Hook untuk withdraw revenue (Creator)
export function useWithdrawRevenue() {
  const { write, data, isLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'withdrawRaffleRevenue',
  });

  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const withdrawRevenue = async (raffleId) => {
    try {
      await write({
        args: [raffleId],
      });
      toast.success('Withdrawing revenue...');
    } catch (error) {
      toast.error(error?.message || 'Failed to withdraw revenue');
    }
  };

  return {
    withdrawRevenue,
    isLoading: isLoading || isWaiting,
    isSuccess,
  };
}

// Hook untuk withdraw fees (Admin only)
export function useWithdrawFees() {
  const { write, data, isLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'withdrawFees',
  });

  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const withdrawFees = async () => {
    try {
      await write();
      toast.success('Withdrawing fees...');
    } catch (error) {
      toast.error(error?.message || 'Failed to withdraw fees');
    }
  };

  return {
    withdrawFees,
    isLoading: isLoading || isWaiting,
    isSuccess,
  };
}

// Hook untuk create raffle
export function useCreateRaffle() {
  const { write, data, isLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'createRaffle',
  });

  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const createRaffle = async (nftContracts, tokenIds, duration) => {
    try {
      await write({
        args: [nftContracts, tokenIds, duration],
      });
      toast.success('Creating raffle...');
    } catch (error) {
      toast.error(error?.message || 'Failed to create raffle');
    }
  };

  return {
    createRaffle,
    isLoading: isLoading || isWaiting,
    isSuccess,
  };
}

// Hook untuk get admin info
export function useAdminInfo() {
  const { data: adminAddress } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'admin',
    watch: true,
  });

  const { data: totalFees } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'totalFees',
    watch: true,
  });

  return {
    adminAddress,
    totalFees: totalFees ? Number(totalFees) : 0,
  };
}
