import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSignMessage, usePublicClient, useSendCalls } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { usePoints } from '../shared/context/PointsContext';
import { ABIS, CONTRACTS } from '../lib/contracts';
import { awardTaskXP } from '../dailyAppLogic';
import { usePaymaster } from './usePaymaster';
import toast from 'react-hot-toast';

const RAFFLE_ADDRESS = CONTRACTS.RAFFLE;

export function useRaffle() {
    const { address } = useAccount();
    const { refetch } = usePoints();
    const { signMessageAsync } = useSignMessage();
    const [isDrawing, setIsDrawing] = useState(false);
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // ⛽ Paymaster support (Base Paymaster / EIP-5792)
    const { isGaslessSupported, paymasterCapabilities } = usePaymaster();
    const { sendCallsAsync } = useSendCalls();

    const buyTickets = async (raffleId, amount) => {
        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: ABIS.RAFFLE,
            functionName: 'buyTickets',
            args: [BigInt(raffleId), BigInt(amount)],
        });

        if (hash) {
            toast.success("Tickets bought! Signing for XP...");
            try {
                const timestamp = new Date().toISOString();
                const message = `Claim XP for Raffle Purchase\nRaffle ID: ${raffleId}\nAmount: ${amount}\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                // 1. Award XP (Internal Logic)
                await awardTaskXP(address, signature, message, `raffle_buy_${raffleId}`, 0);

                // 2. Log Activity (User History)
                await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'log-activity',
                        wallet: address,
                        signature,
                        message,
                        log: {
                            category: 'PURCHASE',
                            type: 'Raffle Ticket Buy',
                            description: `Purchased ${amount} ticket(s) for Raffle #${raffleId}`,
                            amount: Number(amount),
                            symbol: 'TICKET',
                            txHash: hash
                        }
                    })
                });

                if (refetch) refetch();
            } catch (e) {
                console.warn("XP Awarding/Logging skipped:", e.message);
            }
        }
        return hash;
    };

    /**
     * buyTicketsGasless - Gasless via Base Paymaster (Coinbase Smart Wallet only)
     * Fallback otomatis ke buyTickets jika wallet tidak support EIP-5792.
     */
    const buyTicketsGasless = async (raffleId, amount) => {
        // Fallback ke tx biasa jika tidak support gasless
        if (!isGaslessSupported) {
            return buyTickets(raffleId, amount);
        }

        const callData = encodeFunctionData({
            abi: ABIS.RAFFLE,
            functionName: 'buyTickets',
            args: [BigInt(raffleId), BigInt(amount)],
        });

        const callId = await sendCallsAsync({
            calls: [{ to: RAFFLE_ADDRESS, data: callData }],
            capabilities: paymasterCapabilities,
        });

        toast.success("⛽ Gasless tickets purchased!");

        // Award XP & Log Activity
        try {
            const timestamp = new Date().toISOString();
            const message = `Claim XP for Raffle Purchase\nRaffle ID: ${raffleId}\nAmount: ${amount}\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            // 1. Award XP
            await awardTaskXP(address, signature, message, `raffle_buy_${raffleId}`, 0);

            // 2. Log Activity
            await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'log-activity',
                    wallet: address,
                    signature,
                    message,
                    log: {
                        category: 'PURCHASE',
                        type: 'Raffle Ticket Buy (Gasless)',
                        description: `Purchased ${amount} ticket(s) for Raffle #${raffleId}`,
                        amount: Number(amount),
                        symbol: 'TICKET',
                        txHash: callId // Call ID acts as identity for gasless
                    }
                })
            });

            if (refetch) refetch();
        } catch (e) {
            console.warn("XP Awarding/Logging skipped:", e.message);
        }

        return callId;
    };

    const drawRaffle = async (raffleId) => {
        setIsDrawing(true);
        const tid = toast.loading("Drawing winner...");
        try {
            const hash = await writeContractAsync({
                address: RAFFLE_ADDRESS,
                abi: ABIS.RAFFLE,
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
        const tid = toast.loading("Submitting prize claim...");
        try {
            const hash = await writeContractAsync({
                address: RAFFLE_ADDRESS,
                abi: ABIS.RAFFLE,
                functionName: 'claimRafflePrize',
                args: [BigInt(raffleId)],
            });

            if (hash) {
                toast.success("🎉 Prize claimed on-chain! Signing for XP bonus...", { id: tid });
                try {
                    const timestamp = new Date().toISOString();
                    const message = `Claim NFT Raffle Prize\nRaffle ID: ${raffleId}\nWinner: ${address.toLowerCase()}\nTime: ${timestamp}`;
                    const signature = await signMessageAsync({ message });

                    const response = await fetch('/api/raffle/claim-prize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wallet_address: address,
                            signature,
                            message,
                            raffle_id: raffleId,
                            tx_hash: hash
                        })
                    });

                    const result = await response.json();
                    if (result.success && result.xpAwarded) {
                        toast.success(`You won! +${result.xpAwarded} XP added! 🏆`);
                    }
                    if (refetch) refetch();
                } catch (e) {
                    console.warn("XP Awarding skipped:", e.message);
                    toast.success("Prize claimed! XP sync pending.", { id: tid });
                }
            }
            return hash;
        } catch (e) {
            toast.error(e.shortMessage || "Claim failed", { id: tid });
            throw e;
        }
    };

    const createSponsorshipRaffle = async ({ winnerCount, maxTickets, durationDays, metadataURI, depositETH }) => {
        const totalValue = (BigInt(depositETH) * 105n) / 100n;

        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: ABIS.RAFFLE,
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
            toast.success("Raffle created successfully! Syncing... 🎲");
            try {
                const timestamp = new Date().toISOString();
                const message = `Log activity for ${address}\nAction: UGC Raffle Creation\nTimestamp: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                // Extract raffle ID from event if possible, or use a placeholder/hash
                // For now, mirroring as Sync UGC Raffle
                await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'sync-ugc-raffle',
                        wallet: address,
                        signature,
                        message,
                        payload: {
                            raffle_id: 0, // In V1 we might need to fetch the next ID or rely on hash-based lookup
                            end_time: Math.floor(Date.now() / 1000) + (durationDays * 86400),
                            max_tickets: parseInt(maxTickets),
                            winnerCount: parseInt(winnerCount),
                            txHash: hash,
                            depositETH: formatEther(totalValue)
                        }
                    })
                });
                toast.success("Raffle synced to explorer!");
            } catch (logErr) {
                console.warn('Logging UGC Raffle failed:', logErr.message);
            }
        }
        return hash;
    };

    const withdrawEarnings = async () => {
        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: ABIS.RAFFLE,
            functionName: 'withdrawSponsorBalance'
        });

        if (hash) {
            toast.success("Earnings withdrawn!");
        }
        return hash;
    };

    const adminCreateRaffle = async ({ winnerCount, maxTickets, durationDays, metadataURI }) => {
        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: ABIS.RAFFLE,
            functionName: 'adminCreateRaffle',
            args: [
                BigInt(winnerCount),
                BigInt(maxTickets),
                BigInt(durationDays),
                metadataURI
            ],
        });
        return hash;
    };

    return {
        buyTickets,
        buyTicketsGasless,
        drawRaffle,
        createSponsorshipRaffle,
        adminCreateRaffle,
        withdrawEarnings,
        claimPrize,
        isDrawing,
        isGaslessSupported,
    };
}

export function useRaffleList() {
    const { data: totalRaffles } = useReadContract({
        address: RAFFLE_ADDRESS,
        abi: ABIS.RAFFLE,
        functionName: 'currentRaffleId',
    });

    const count = totalRaffles ? Number(totalRaffles) : 0;
    // Indexing is 1-based in the contract, so we generate IDs from 1 to count
    const raffleIds = count > 0 ? Array.from({ length: count }, (_, i) => i + 1) : [];

    return { raffleIds, count };
}

export function useRaffleInfo(raffleId) {
    const { data, isLoading, refetch } = useReadContract({
        address: RAFFLE_ADDRESS,
        abi: ABIS.RAFFLE,
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
