import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWatchContractEvent } from 'wagmi';
import { usePoints } from '../shared/context/PointsContext';
import toast from 'react-hot-toast';

// MOCK MODE FLAG
// Set to false in production to use real contract events
const MOCK_MODE = true;

export function useRaffle() {
    const { address } = useAccount();
    const { refetch, setUnclaimedRewards } = usePoints();
    const [isDrawing, setIsDrawing] = useState(false);

    // ==========================================
    // REAL CONTRACT INTERACTION (Wagmi)
    // ==========================================
    // Note: Add ABI and address to constants/contracts.js when ready
    /*
    const { writeContractAsync } = useWriteContract();
    
    useWatchContractEvent({
        address: '0x...', // Raffle Contract Address
        abi: [], // Raffle ABI
        eventName: 'WinnerSelected',
        onLogs(logs) {
            // Check if winner is current user
            const winner = logs[0].args.winner;
            if (winner === address) {
                toast.success("Congrats! You won the raffle!  Claim your prize.");
                refetch(); // Update points/stats
                
                // Add to unclaimed rewards (simplified logic)
                setUnclaimedRewards(prev => [...prev, { id: logs[0].args.raffleId, type: 'NFT' }]);
            }
            setIsDrawing(false);
        },
    });
    */

    // ==========================================
    // CORE FUNCTIONS
    // ==========================================

    const buyTickets = async (raffleId, amount) => {
        if (MOCK_MODE) {
            return new Promise((resolve) => {
                toast.loading("Buying tickets...", { id: 'buy-ticket' });
                setTimeout(() => {
                    toast.success(`Bought ${amount} tickets!`, { id: 'buy-ticket' });
                    refetch(); // Update points (maybe buying gives points?)
                    resolve(true);
                }, 1500);
            });
        }

        // Real logic: call buyTickets on contract
    };

    const drawRaffle = async (raffleId) => {
        setIsDrawing(true);
        const tid = toast.loading("Requesting API3 QRNG...");

        if (MOCK_MODE) {
            // Simulate API3 Delay (e.g., 20 seconds)
            setTimeout(() => {
                const isWin = Math.random() > 0.5; // Random win/loss for mock

                toast.success("Randomness received!", { id: tid });
                setIsDrawing(false);

                if (isWin) {
                    toast("🎉 You WON! Claim your prize in the dashboard.", { duration: 5000, icon: '🏆' });
                    // Manual Claim Logic: Update state so user sees "Claim" button
                    setUnclaimedRewards(prev => [...prev, {
                        id: raffleId,
                        title: "Exclusive NFT",
                        type: 'NFT',
                        isClaimed: false,
                        deadline: Date.now() + (8 * 60 * 60 * 1000) // 8 hours from now
                    }]);
                    refetch();
                } else {
                    toast("Better luck next time!", { id: tid });
                }
            }, 3000); // Fast mock delay
        } else {
            // Real logic: call drawWinner on contract (Admin only)
        }
    };

    const claimPrize = async (raffleId) => {
        const tid = toast.loading("Claiming prize...");

        // Validation handled by UI state (button only visible if winner), 
        // but contract will double check msg.sender == winner

        if (MOCK_MODE) {
            setTimeout(() => {
                toast.success("Prize successfully claimed to wallet!", { id: tid });

                // Remove from unclaimed
                setUnclaimedRewards(prev => prev.map(r =>
                    r.id === raffleId ? { ...r, isClaimed: true } : r
                ));

                refetch();
            }, 2000);
        } else {
            // Real logic: call claimPrizes(raffleId)
        }
    };

    const rerollWinner = async (raffleId) => {
        const tid = toast.loading("Rerolling winner...");

        if (MOCK_MODE) {
            setTimeout(() => {
                const isWin = Math.random() > 0.5; // Simulate if *we* win the reroll (unlikely in real life for previous winner, but this is the drawer)
                // Actually rerollWinner is usually called by ADMIN or ANYONE to trigger new draw.
                // The winner will be someone else.

                toast.success("Reroll requested! New winner selected.", { id: tid });

                // For mock purposes, let's remove the item from *our* unclaimed list if we were the previous winner (simulating loss of claim)
                // OR if we are just testing UI, maybe we win again?
                // Let's assume we lose it.
                setUnclaimedRewards(prev => prev.filter(r => r.id !== raffleId));

                refetch();
            }, 2000);
        } else {
            // Real logic: call rerollWinner(raffleId)
        }
    };

    return {
        buyTickets,
        drawRaffle,
        claimPrize,
        rerollWinner,
        isDrawing
    };
}
