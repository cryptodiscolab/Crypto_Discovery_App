import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSignMessage, usePublicClient, useSendCalls, useChainId } from 'wagmi';
import { encodeFunctionData, formatEther, decodeEventLog } from 'viem';
import { usePoints } from '../shared/context/PointsContext';
import { ABIS, CONTRACTS } from '../lib/contracts';
import { awardTaskXP } from '../dailyAppLogic';
import { usePaymaster } from './usePaymaster';
import { usePendingSyncRecovery } from './usePendingSyncRecovery';
import toast from 'react-hot-toast';
import { CallStatusResponse, RaffleExtraMetadata } from '../types';

const RAFFLE_ADDRESS = CONTRACTS.RAFFLE as `0x${string}`;
const MASTER_X_ADDRESS = CONTRACTS.MASTER_X as `0x${string}`;

export function useRaffle() {
    const { address } = useAccount();
    const chainId = useChainId();
    const { recordFailure: recordPendingSync } = usePendingSyncRecovery();
    const { refetch } = usePoints();
    const { signMessageAsync } = useSignMessage();
    const [isDrawing, setIsDrawing] = useState(false);
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // ⛽ Paymaster support (Base Paymaster / EIP-5792)
    const { isGaslessSupported, paymasterCapabilities } = usePaymaster();
    const { sendCallsAsync } = useSendCalls();

    const buyTickets = async (raffleId: number | string, amount: number | string) => {
        const price = (await publicClient!.readContract({
            address: MASTER_X_ADDRESS,
            abi: ABIS.MASTER_X,
            functionName: 'getTicketPriceInETH'
        })) as bigint;
        const surcharge = (await publicClient!.readContract({
            address: RAFFLE_ADDRESS,
            abi: ABIS.RAFFLE,
            functionName: 'surchargeBP'
        })) as bigint;
        const baseETH = price * BigInt(amount);
        const requiredETH = (baseETH * (10000n + BigInt(surcharge))) / 10000n;

        const hash = await writeContractAsync({
            address: RAFFLE_ADDRESS,
            abi: ABIS.RAFFLE,
            functionName: 'buyTickets',
            args: [BigInt(raffleId), BigInt(amount)],
            value: requiredETH
        });

        if (hash) {
            toast.success("Tickets bought! Signing for XP...");
            try {
                const timestamp = new Date().toISOString();
                const message = `Claim XP for Raffle Purchase\nRaffle ID: ${raffleId}\nAmount: ${amount}\nUser: ${address?.toLowerCase() || ''}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                // 1. Award XP (Internal Logic) - appended hash to allow multiple purchases
                await awardTaskXP(address as string, signature, message, `raffle_buy_${raffleId}_${hash}`, 0);

                // 2. Log Activity (User History)
                const response = await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'log-activity',
                        wallet_address: address,
                        signature,
                        message,
                        category: 'PURCHASE',
                        type: 'Raffle Ticket Buy',
                        description: `Purchased ${amount} ticket(s) for Raffle #${raffleId}`,
                        amount: Number(amount),
                        symbol: 'TICKET',
                        txHash: hash
                    })
                });

                if (refetch) refetch();
            } catch (e: unknown) {
                const errMsg = e instanceof Error ? e.message : String(e);
                console.warn("XP Awarding/Logging skipped:", errMsg);
                recordPendingSync({
                    actionType: 'raffle_buy',
                    txHash: hash,
                    chainId,
                    contractAddress: RAFFLE_ADDRESS,
                    payload: { raffle_id: raffleId, amount },
                    errorMessage: errMsg
                }).catch(() => {});
            }
        }
        return hash;
    };

    /**
     * buyTicketsGasless - Gasless via Base Paymaster (Coinbase Smart Wallet only)
     * Fallback otomatis ke buyTickets jika wallet tidak support EIP-5792.
     */
    const buyTicketsGasless = async (raffleId: number | string, amount: number | string) => {
        // Fallback ke tx biasa jika tidak support gasless
        if (!isGaslessSupported) {
            return buyTickets(raffleId, amount);
        }

        const callData = encodeFunctionData({
            abi: ABIS.RAFFLE as any,
            functionName: 'buyTickets',
            args: [BigInt(raffleId), BigInt(amount)],
        });

        const price = (await publicClient!.readContract({
            address: MASTER_X_ADDRESS,
            abi: ABIS.MASTER_X as any,
            functionName: 'getTicketPriceInETH'
        })) as bigint;
        const surcharge = (await publicClient!.readContract({
            address: RAFFLE_ADDRESS,
            abi: ABIS.RAFFLE as any,
            functionName: 'surchargeBP'
        })) as bigint;
        const baseETH = price * BigInt(amount);
        const requiredETH = (baseETH * (10000n + BigInt(surcharge))) / 10000n;

        const callId = await sendCallsAsync({
            calls: [{ to: RAFFLE_ADDRESS, data: callData, value: requiredETH }],
            capabilities: paymasterCapabilities,
        });

        toast.success("⛽ Gasless tickets purchased!");

        // [FIX v3.56.5] Resolve actual on-chain txHash from callId for backend verification.
        // EIP-5792 callId is NOT a valid txHash — we must resolve receipts to get the real hash.
        let resolvedTxHash: string = typeof callId === 'string' ? callId : (callId as any).id; // fallback to ID from call response
        try {
            // Poll getCallsStatus to retrieve the actual transaction hash
            let attempts = 0;
            while (attempts < 10) {
                await new Promise(r => setTimeout(r, 2000));
                const status = (await (publicClient as any)!.request({
                    method: 'wallet_getCallsStatus',
                    params: [callId],
                })) as CallStatusResponse;
                const receipt = status?.receipts?.[0];
                if (receipt?.transactionHash) {
                    resolvedTxHash = receipt.transactionHash;
                    break;
                }
                attempts++;
            }
        } catch (resolveErr: unknown) {
            console.warn('[buyTicketsGasless] Could not resolve txHash from callId, falling back:', resolveErr instanceof Error ? resolveErr.message : String(resolveErr));
        }

        // Award XP & Log Activity
        try {
            const timestamp = new Date().toISOString();
            const message = `Claim XP for Raffle Purchase\nRaffle ID: ${raffleId}\nAmount: ${amount}\nUser: ${address?.toLowerCase() || ''}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            // 1. Award XP — use resolved txHash so backend verifyRaffleOnChain succeeds
            await awardTaskXP(address as string, signature, message, `raffle_buy_${raffleId}_${resolvedTxHash}`, 0);

            // 2. Log Activity
            await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'log-activity',
                    wallet_address: address,
                    signature,
                    message,
                    category: 'PURCHASE',
                    type: 'Raffle Ticket Buy (Gasless)',
                    description: `Purchased ${amount} ticket(s) for Raffle #${raffleId}`,
                    amount: Number(amount),
                    symbol: 'TICKET',
                    txHash: resolvedTxHash
                })
            });

            if (refetch) refetch();
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.warn("XP Awarding/Logging skipped:", errMsg);
            recordPendingSync({
                actionType: 'raffle_buy',
                txHash: resolvedTxHash,
                chainId,
                contractAddress: RAFFLE_ADDRESS,
                payload: { raffle_id: raffleId, amount, gasless: true },
                errorMessage: errMsg
            }).catch(() => {});
        }

        return callId;
    };

    const drawRaffle = async (raffleId: number | string) => {
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
            // Log admin action for draw winner
            try {
                const timestamp = new Date().toISOString();
                const message = `Admin Draw Winner\nRaffle: ${raffleId}\nAdmin: ${address}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });
                await fetch('/api/admin-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'SYNC_RAFFLE',
                        wallet: address,
                        signature,
                        message,
                        payload: { raffle_id: raffleId, tx_hash: hash, action_type: 'draw_winner' }
                    })
                });
            } catch { /* admin log is best-effort */ }
            setIsDrawing(false);
            return hash;
        } catch (e: any) {
            toast.error((e as { shortMessage?: string }).shortMessage || "Draw failed", { id: tid });
            setIsDrawing(false);
            throw e;
        }
    };

    const claimPrize = async (raffleId: number | string) => {
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
                    const message = `Claim NFT Raffle Prize\nRaffle ID: ${raffleId}\nWinner: ${address?.toLowerCase() || ''}\nTime: ${timestamp}`;
                    const signature = await signMessageAsync({ message });

                    const response = await fetch('/api/raffle/claim-prize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'claim-prize',
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
                } catch (e: any) {
                    console.warn("XP Awarding skipped:", e.message);
                    recordPendingSync({
                        actionType: 'raffle_claim',
                        txHash: hash,
                        chainId,
                        contractAddress: RAFFLE_ADDRESS,
                        payload: { raffle_id: raffleId },
                        errorMessage: e.message || 'Prize claim XP sync failed'
                    }).catch(() => {});
                    toast.success("Prize claimed! XP sync pending — will retry automatically.", { id: tid });
                }
            }
            return hash;
        } catch (e: any) {
            toast.error((e as { shortMessage?: string }).shortMessage || "Claim failed", { id: tid });
            throw e;
        }
    };

    const createSponsorshipRaffle = async ({ winnerCount, maxTickets, durationDays, metadataURI, depositETH, extraMetadata }: { winnerCount: number, maxTickets: number, durationDays: number, metadataURI: string, depositETH: bigint, extraMetadata?: RaffleExtraMetadata }) => {
        // [FIX v3.56.5] Read surchargeBP dynamically from contract instead of hardcoding 5%.
        // This ensures totalValue stays in sync if the admin updates the surcharge on-chain.
        const surchargeBP = (await publicClient!.readContract({
            address: RAFFLE_ADDRESS,
            abi: ABIS.RAFFLE,
            functionName: 'surchargeBP'
        })) as bigint;
        const totalValue = (BigInt(depositETH) * (10000n + BigInt(surchargeBP))) / 10000n;

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

                // Extract raffle ID from event
                let raffleId = 0;
                try {
                    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
                    for (const log of receipt.logs) {
                        try {
                            const decoded = decodeEventLog({
                                abi: ABIS.RAFFLE,
                                data: log.data,
                                topics: log.topics,
                            });
                            if (decoded.eventName === 'RaffleCreated') {
                                raffleId = Number((decoded.args as { raffleId: bigint }).raffleId);
                                break;
                            }
                        } catch (e) { /* skip logs from other events */ }
                    }
                } catch (e) {
                    console.error("Failed to extract raffle ID:", e);
                }

                const response = await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'sync-ugc-raffle',
                        wallet: address,
                        signature,
                        message,
                        payload: {
                            raffle_id: raffleId || 0,
                            end_time: Math.floor(Date.now() / 1000) + (durationDays * 86400),
                            max_tickets: Number(maxTickets),
                            winnerCount: Number(winnerCount),
                            txHash: hash,
                            depositETH: formatEther(totalValue),
                            metadata_uri: metadataURI,
                            extra_metadata: extraMetadata
                        }
                    })
                });
                const result = await response.json();
                if (!response.ok || !result?.success) {
                    throw new Error(result?.error || 'Raffle DB sync failed');
                }
                toast.success("Raffle synced to explorer!");
            } catch (logErr: any) {
                const errMsg = logErr instanceof Error ? logErr.message : String(logErr);
                console.warn('Logging UGC Raffle failed:', errMsg);
                recordPendingSync({
                    actionType: 'raffle_create',
                    txHash: hash,
                    chainId,
                    contractAddress: RAFFLE_ADDRESS,
                    payload: {
                        winnerCount,
                        maxTickets,
                        durationDays,
                        metadataURI,
                        depositETH: formatEther(totalValue),
                        extraMetadata
                    },
                    errorMessage: errMsg
                }).catch(() => {});
                toast.success("Raffle created on-chain. Sync pending — will retry automatically.");
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
            // Log sponsor withdrawal to activity ledger
            try {
                const timestamp = new Date().toISOString();
                const message = `Withdraw Sponsor Earnings\nWallet: ${address}\nTime: ${timestamp}`;
                const signature = await signMessageAsync({ message });
                await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'log-activity',
                        wallet_address: address,
                        signature,
                        message,
                        category: 'REWARD',
                        type: 'Sponsor Earnings Withdrawal',
                        description: `Withdrew sponsor earnings from raffle contract`,
                        amount: 0,
                        symbol: 'ETH',
                        txHash: hash,
                        metadata: { contract: RAFFLE_ADDRESS, chain_id: chainId }
                    })
                });
            } catch { /* ledger log is best-effort */ }
        }
        return hash;
    };

    const adminCreateRaffle = async ({ winnerCount, maxTickets, durationDays, metadataURI, extraMetadata = {} }: { winnerCount: number, maxTickets: number, durationDays: number, metadataURI: string, extraMetadata?: any }) => {
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

        // [FIX v3.56.5] Sync admin-created raffles to DB so moderation panel & Raffle UI
        // displays correctly. Without this, the raffles table stays empty for admin raffles.
        let raffleId = 0;
        if (hash) {
            try {
                const timestamp = new Date().toISOString();
                const message = `Log activity for ${address}\nAction: Admin Raffle Creation\nTimestamp: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                // Resolve raffleId from RaffleCreated event log
                try {
                    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
                    for (const log of receipt.logs) {
                        try {
                            const decoded = decodeEventLog({ abi: ABIS.RAFFLE, data: log.data, topics: log.topics });
                            if (decoded.eventName === 'RaffleCreated') {
                                raffleId = Number((decoded.args as { raffleId: bigint }).raffleId);
                                break;
                            }
                        } catch (e) { /* skip unrelated logs */ }
                    }
                } catch (e) {
                    console.error('[adminCreateRaffle] Failed to extract raffleId from receipt:', e);
                }

                // Guard: do not sync raffle_id: 0 to DB — store pending recovery instead
                if (!raffleId || raffleId === 0) {
                    recordPendingSync({
                        actionType: 'raffle_create',
                        txHash: hash,
                        chainId,
                        contractAddress: RAFFLE_ADDRESS,
                        payload: { max_tickets: maxTickets, winner_count: winnerCount, admin: true },
                        errorMessage: 'Failed to extract raffle_id from receipt'
                    }).catch(() => {});
                    toast('Raffle created on-chain. ID extraction failed — sync pending.', { icon: '⏳', duration: 6000 });
                } else {
                    await fetch('/api/user-bundle', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'sync-ugc-raffle',
                            wallet: address,
                            signature,
                            message,
                            payload: {
                                raffle_id: raffleId,
                                end_time: Math.floor(Date.now() / 1000) + (durationDays * 86400),
                                max_tickets: Number(maxTickets),
                                winnerCount: Number(winnerCount),
                                txHash: hash,
                                depositETH: '0', // Admin raffles are free (no deposit)
                                metadata_uri: metadataURI,
                                extra_metadata: extraMetadata
                            }
                        })
                    });
                }
            } catch (syncErr: unknown) {
                const errMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
                console.warn('[adminCreateRaffle] DB sync skipped:', errMsg);
                recordPendingSync({
                    actionType: 'raffle_create',
                    txHash: hash,
                    chainId,
                    contractAddress: RAFFLE_ADDRESS,
                    payload: { raffle_id: raffleId, max_tickets: maxTickets, admin: true },
                    errorMessage: errMsg
                }).catch(() => {});
            }
        }

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
