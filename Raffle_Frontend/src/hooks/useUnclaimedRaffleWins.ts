import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ABIS, CONTRACTS } from '../lib/contracts';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

const RAFFLE_ADDRESS = CONTRACTS.RAFFLE as `0x${string}`;

interface UnclaimedWin {
    raffleId: number;
    prizePerWinner: bigint;
    title?: string;
}

/**
 * useUnclaimedRaffleWins
 *
 * Polls finalized raffles to check if the connected user has unclaimed prizes.
 * Shows a toast notification on discovery and exposes the list for UI banners.
 */
export function useUnclaimedRaffleWins() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const [unclaimedWins, setUnclaimedWins] = useState<UnclaimedWin[]>([]);
    const [isChecking, setIsChecking] = useState(false);
    const lastCheckedRef = useRef(0);
    const hasNotifiedRef = useRef<Set<number>>(new Set());

    const checkForWins = useCallback(async () => {
        if (!address || !isConnected || !RAFFLE_ADDRESS || !publicClient) return;

        // Throttle: don't check more than once per 2 minutes
        if (Date.now() - lastCheckedRef.current < 120000) return;

        setIsChecking(true);
        try {
            // 1. Get all finalized raffles from DB
            const { data: finalizedRaffles, error } = await supabase
                .from('raffles')
                .select('id, title, is_finalized')
                .eq('is_finalized', true)
                .order('id', { ascending: false })
                .limit(20);

            if (error || !finalizedRaffles || finalizedRaffles.length === 0) {
                setIsChecking(false);
                return;
            }

            // 2. Check which ones the user already claimed (from user_task_claims)
            const raffleIds = finalizedRaffles.map((r: { id: number }) => r.id);
            const claimTaskIds = raffleIds.map((id: number) => `raffle_win_${id}`);

            const { data: existingClaims } = await supabase
                .from('user_task_claims')
                .select('task_id')
                .eq('wallet_address', address.toLowerCase())
                .in('task_id', claimTaskIds);

            const claimedSet = new Set((existingClaims || []).map((c: { task_id: string }) => c.task_id));

            // 3. Filter to unclaimed finalized raffles
            const potentialWins = finalizedRaffles.filter(
                (r: { id: number }) => !claimedSet.has(`raffle_win_${r.id}`)
            );

            if (potentialWins.length === 0) {
                setUnclaimedWins([]);
                setIsChecking(false);
                lastCheckedRef.current = Date.now();
                return;
            }

            // 4. Check on-chain if user is actually in the winners array
            const wins: UnclaimedWin[] = [];

            for (const raffle of potentialWins.slice(0, 5)) {
                try {
                    const result = await publicClient.readContract({
                        address: RAFFLE_ADDRESS,
                        abi: ABIS.RAFFLE as unknown,
                        functionName: 'getRaffleInfo',
                        args: [BigInt(raffle.id)]
                    });

                    if (!result) continue;

                    const raffleData = result as unknown;
                    const winners: string[] = raffleData.winners || raffleData[6] || [];
                    const prizePerWinner = raffleData.prizePerWinner || raffleData[14] || 0n;

                    const isWinner = winners.some(
                        (w: string) => w.toLowerCase() === address.toLowerCase() &&
                        w !== '0x0000000000000000000000000000000000000000'
                    );

                    if (isWinner) {
                        // Check if already claimed on-chain
                        let alreadyClaimed = false;
                        try {
                            const claimed = await publicClient.readContract({
                                address: RAFFLE_ADDRESS,
                                abi: ABIS.RAFFLE as unknown,
                                functionName: 'hasClaimedPrize',
                                args: [BigInt(raffle.id), address]
                            });
                            alreadyClaimed = !!claimed;
                        } catch { /* hasClaimedPrize might not exist on older contracts */ }

                        if (!alreadyClaimed) {
                            wins.push({
                                raffleId: raffle.id,
                                prizePerWinner: BigInt(prizePerWinner.toString()),
                                title: raffle.title || undefined
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`[UnclaimedWins] Failed to check raffle #${raffle.id}:`, e);
                }
            }

            setUnclaimedWins(wins);
            lastCheckedRef.current = Date.now();

            // 5. Show toast for newly discovered wins (only once per raffle)
            for (const win of wins) {
                if (!hasNotifiedRef.current.has(win.raffleId)) {
                    hasNotifiedRef.current.add(win.raffleId);
                    const prizeETH = Number(win.prizePerWinner) / 1e18;
                    toast(
                        `🏆 You won ${win.title ? `"${win.title}"` : `Raffle #${win.raffleId}`}! Claim your ${prizeETH.toFixed(4)} ETH prize!`,
                        {
                            duration: 12000,
                            icon: '🎉',
                            style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(16,185,129,0.4)' }
                        }
                    );
                }
            }

            // 6. Send Farcaster notification for unclaimed wins (fire-and-forget)
            if (wins.length > 0) {
                try {
                    const { data: profile } = await supabase
                        .from('user_profiles')
                        .select('fid')
                        .eq('wallet_address', address.toLowerCase())
                        .maybeSingle();

                    if (profile?.fid) {
                        for (const win of wins) {
                            if (!hasNotifiedRef.current.has(-win.raffleId)) { // Use negative as "farcaster notified" flag
                                hasNotifiedRef.current.add(-win.raffleId);
                                const prizeETH = Number(win.prizePerWinner) / 1e18;
                                fetch('/api/notify', {
                                    method: 'POST',
                                    headers: {
                                        'content-type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        fid: profile.fid,
                                        message: `🏆 Congratulations! You won ${win.title || `Raffle #${win.raffleId}`}! Prize: ${prizeETH.toFixed(4)} ETH. Claim now at https://crypto-discovery-app.vercel.app/raffles`,
                                        type: 'mention',
                                        wallet: address
                                    })
                                }).catch(() => {}); // fire-and-forget
                            }
                        }
                    }
                } catch { /* notification is best-effort */ }
            }
        } catch (err) {
            console.error('[UnclaimedWins] Check failed:', err);
        } finally {
            setIsChecking(false);
        }
    }, [address, isConnected, publicClient]);

    // Check on mount and every 5 minutes
    useEffect(() => {
        if (!isConnected || !address) {
            setUnclaimedWins([]);
            return;
        }

        // Initial check after 3 seconds (let wallet connect settle)
        const initialTimeout = setTimeout(checkForWins, 3000);

        // Poll every 5 minutes
        const interval = setInterval(checkForWins, 5 * 60 * 1000);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
    }, [isConnected, address, checkForWins]);

    return {
        unclaimedWins,
        hasUnclaimedWins: unclaimedWins.length > 0,
        isChecking,
        recheckWins: checkForWins
    };
}
