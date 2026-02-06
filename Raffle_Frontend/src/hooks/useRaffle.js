import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { RAFFLE_ABI } from '../shared/constants/abis';
import { addXP } from '../dailyAppLogic';
import toast from 'react-hot-toast';

// MOCK MODE FLAG
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';
const RAFFLE_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

export function useRaffle() {
    const { address } = useAccount();
    const { refetch, setUnclaimedRewards } = usePoints();
    const [isDrawing, setIsDrawing] = useState(false);

    const { writeContractAsync } = useWriteContract();

    // ==========================================
    // CORE FUNCTIONS
    // ==========================================

    const buyTickets = async (raffleId, amount, useFreeTickets = false) => {
        if (MOCK_MODE) {
            toast.loading("Buying tickets (Mock)...", { id: 'buy-ticket' });
            return new Promise((resolve) => {
                setTimeout(() => {
                    toast.success(`Bought ${amount} tickets!`, { id: 'buy-ticket' });
                    refetch();
                    resolve(true);
                }, 1500);
            });
        }

        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'buyTickets',
            args: [BigInt(raffleId), BigInt(amount), useFreeTickets],
        });

        if (hash) {
            // Background award XP
            const fid = 1477344; // Should get from context in real app, hardcoded for now or fetch
            addXP(fid, 'raffle_buy_ticket', address);
        }
        return hash;
    };

    const drawRaffle = async (raffleId) => {
        setIsDrawing(true);
        const tid = toast.loading("Drawing winner...");

        if (MOCK_MODE) {
            setTimeout(() => {
                toast.success("Winner drawn (Mock)!", { id: tid });
                setIsDrawing(false);
            }, 2000);
            return;
        }

        try {
            const hash = await writeContractAsync({
                address: RAFFLE_ADDRESS,
                abi: RAFFLE_ABI,
                functionName: 'drawWinner',
                args: [BigInt(raffleId)],
            });
            toast.success("Winner draw requested!", { id: tid });
            setIsDrawing(false);
            return hash;
        } catch (e) {
            toast.error(e.shortMessage || "Draw failed", { id: tid });
            setIsDrawing(false);
            throw e;
        }
    };

    const createRaffle = async (nftContracts, tokenIds, duration) => {
        if (MOCK_MODE) {
            toast.success("Raffle created (Mock)!");
            return;
        }

        return await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'createRaffle',
            args: [nftContracts, tokenIds, BigInt(duration)],
        });
    };

    const claimPrize = async (raffleId) => {
        if (MOCK_MODE) {
            const tid = toast.loading("Claiming prize (Mock)...");
            setTimeout(() => {
                toast.success("Prize claimed!", { id: tid });
                setUnclaimedRewards(prev => prev.map(r =>
                    r.id === raffleId ? { ...r, isClaimed: true } : r
                ));
                refetch();
            }, 2000);
            return;
        }

        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'claimPrizes',
            args: [BigInt(raffleId)],
        });

        if (hash) {
            const fid = 1477344; // Get from frame context
            addXP(fid, 'raffle_claim_prize', address);
        }
        return hash;
    };
    return {
        buyTickets,
        drawRaffle,
        createRaffle,
        claimPrize,
        isDrawing
    };
}

export function useRaffleList() {
    const { data: totalRaffles } = useReadContract({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: 'raffleIdCounter',
    });

    const count = totalRaffles ? Number(totalRaffles) : 0;
    const raffleIds = Array.from({ length: count }, (_, i) => i);

    return { raffleIds, count };
}

export function useRaffleInfo(raffleId) {
    const { data, isLoading, refetch } = useReadContract({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: 'getRaffleInfo',
        args: [BigInt(raffleId)],
    });

    if (!data || isLoading) return { raffle: null, isLoading };

    const [id, creator, startTime, endTime, ticketsSold, paidTicketsSold, isActive, isCompleted, winner, nftCount] = data;

    return {
        raffle: {
            id: Number(id),
            creator,
            startTime: Number(startTime),
            endTime: Number(endTime),
            ticketsSold: Number(ticketsSold),
            paidTicketsSold: Number(paidTicketsSold),
            isActive,
            isCompleted,
            winner,
            nftCount: Number(nftCount)
        },
        isLoading,
        refetch
    };
}
