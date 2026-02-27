import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSignMessage } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import { RAFFLE_ABI } from '../shared/constants/abis';
import { awardTaskXP } from '../dailyAppLogic';
import toast from 'react-hot-toast';

const RAFFLE_ADDRESS = import.meta.env.VITE_RAFFLE_ADDRESS || "0x18C64ed185C15F46d17C1888e12168DBA409e2EE";

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
            functionName: 'claimRafflePrize',
            args: [BigInt(raffleId)],
        });

        if (hash) {
            toast.success("Prize claim submitted!");
            if (refetch) refetch();
        }
        return hash;
    };

    const createSponsorshipRaffle = async ({ winnerCount, maxTickets, durationDays, metadataURI, depositETH }) => {
        // Total value includes 5% platform fee (105%)
        const totalValue = (BigInt(depositETH) * 105n) / 100n;

        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'createSponsorshipRaffle',
            args: [
                BigInt(winnerCount),
                BigInt(maxTickets),
                BigInt(durationDays),
                metadataURI
            ],
            value: totalValue
        });

        if (hash) {
            toast.success("Raffle created successfully!");
        }
        return hash;
    };

    const withdrawEarnings = async () => {
        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'withdrawSponsorBalance'
        });

        if (hash) {
            toast.success("Earnings withdrawn!");
        }
        return hash;
    };

    const createRaffle = async (nftContracts, tokenIds, duration) => {
        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: RAFFLE_ABI,
            functionName: 'createRaffle',
            args: [nftContracts, tokenIds, BigInt(duration)],
        });

        if (hash) {
            // No direct ID returned from writeContractAsync, usually we wait for receipt
            // But for now, we can prompt the user or handle it.
            // A better way is to wait for the receipt and parse events.
            toast.success("Raffle created on blockchain!");
            try {
                // We'll needing the latest raffle ID.
                const timestamp = new Date().toISOString();
                const message = `Sync New Raffle\nCreator: ${address.toLowerCase()}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                // We get the next ID from the refetch or just sync a generic "newest"
                // For simplicity, let's just notify that sync is pending or call a batch sync
                await fetch('/api/admin/system/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: address,
                        signature,
                        message,
                        action_type: 'SYNC_RAFFLE',
                        payload: {
                            raffle_id: 999, // Placeholder or fetch latest
                            creator: address,
                            nft_address: nftContracts[0],
                            token_id: Number(tokenIds[0]),
                            end_time: new Date(Date.now() + duration * 1000).toISOString()
                        }
                    })
                });
            } catch (e) {
                console.warn("Database sync failed:", e.message);
            }
        }
        return hash;
    };

    return {
        buyTickets,
        drawRaffle,
        createSponsorshipRaffle,
        withdrawEarnings,
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

    const r = data;

    return {
        raffle: {
            id: Number(r.raffleId),
            totalTickets: Number(r.totalTickets),
            maxTickets: Number(r.maxTickets),
            targetPrizePool: r.targetPrizePool,
            prizePool: r.prizePool,
            participants: r.participants,
            winners: r.winners,
            winnerCount: Number(r.winnerCount),
            randomNumber: r.randomNumber,
            isActive: r.isActive,
            isFinalized: r.isFinalized,
            sponsor: r.sponsor,
            metadataURI: r.metadataURI,
            endTime: Number(r.endTime),
            prizePerWinner: r.prizePerWinner
        },
        isLoading,
        refetch
    };
}
