import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSignMessage } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { RAFFLE_ABI } from '../shared/constants/abis';
import { awardTaskXP } from '../dailyAppLogic';
import toast from 'react-hot-toast';

const RAFFLE_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

export function useRaffle() {
    const { address } = useAccount();
    const { refetch } = usePoints();
    const { signMessageAsync } = useSignMessage();
    const [isDrawing, setIsDrawing] = useState(false);
    const { writeContractAsync } = useWriteContract();

    const buyTickets = async (raffleId, amount, useFreeTickets = false) => {
        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'buyTickets',
            args: [BigInt(raffleId), BigInt(amount), useFreeTickets],
        });

        if (hash) {
            toast.success("Tickets bought! Requesting signature for XP rewards...");
            try {
                const timestamp = new Date().toISOString();
                const message = `Claim XP for Raffle Purchase\nRaffle ID: ${raffleId}\nAmount: ${amount}\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                await awardTaskXP(address, signature, message, `raffle_buy_${raffleId}`, 0); // Reward value handled by backend Activity Key
                if (refetch) refetch();
            } catch (e) {
                console.warn("XP Awarding skipped or failed:", e.message);
            }
        }
        return hash;
    };

    const drawRaffle = async (raffleId) => {
        setIsDrawing(true);
        const tid = toast.loading("Drawing winner...");
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

    const claimPrize = async (raffleId) => {
        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'claimPrizes',
            args: [BigInt(raffleId)],
        });

        if (hash) {
            toast.success("Prize claimed! Requesting signature for XP rewards...");
            try {
                const timestamp = new Date().toISOString();
                const message = `Claim XP for Raffle Prize\nRaffle ID: ${raffleId}\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                await awardTaskXP(address, signature, message, `raffle_claim_${raffleId}`, 0);
                if (refetch) refetch();
            } catch (e) {
                console.warn("XP Awarding skipped or failed:", e.message);
            }
        }
        return hash;
    };

    const createRaffle = async (nftContracts, tokenIds, duration) => {
        return await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'createRaffle',
            args: [nftContracts, tokenIds, BigInt(duration)],
        });
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
