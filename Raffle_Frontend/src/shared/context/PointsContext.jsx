import { createContext, useContext, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useUserV12Stats } from '../../hooks/useContract';
import { getSBTThresholds, getUserStatsByFid } from '../../dailyAppLogic';
import sdk from '@farcaster/frame-sdk';

const PointsContext = createContext(null);

export function PointsProvider({ children }) {
    const { address, isConnected } = useAccount();
    const { stats, isLoading, refetch } = useUserV12Stats(address);

    const [userPoints, setUserPoints] = useState(0n);
    const [userTier, setUserTier] = useState(0); // 0=NONE, 1=BRONZE, etc.
    const [totalTasksCompleted, setTotalTasksCompleted] = useState(0n);
    const [unclaimedRewards, setUnclaimedRewards] = useState([]); // Array of raffleIds or reward objects
    const [isAdmin, setIsAdmin] = useState(false); // Admin status
    const [sbtThresholds, setSbtThresholds] = useState([]); // Supabase Thresholds (Anti-Halu)

    // Anti-Halu Central State
    const [fid, setFid] = useState(null);
    const [offChainPoints, setOffChainPoints] = useState(0);
    const [offChainLevel, setOffChainLevel] = useState(0);

    useEffect(() => {
        if (isConnected && stats) {
            setUserPoints(stats.points || 0n);
            setUserTier(Number(stats.currentTier || 0));
            setTotalTasksCompleted(stats.totalTasksCompleted || 0n);

            // Mocking unclaimed rewards for now (replace with real data fetch later)
            // In real impl, this comes from checking "won but not claimed" raffles
            setUnclaimedRewards([]);
        } else {
            // Reset if disconnected
            setUserPoints(0n);
            setUserTier(0);
            setTotalTasksCompleted(0n);
            setUnclaimedRewards([]);
        }
    }, [isConnected, stats]);

    // Check admin status when wallet connects
    useEffect(() => {
        if (isConnected && address) {
            checkAdminStatus(address);
        } else if (!isConnected) {
            setIsAdmin(false);
        }
    }, [isConnected, address]);

    useEffect(() => {
        const loadThresholds = async () => {
            const data = await getSBTThresholds();
            if (data && data.length > 0) {
                setSbtThresholds(data);
            } else {
                setSbtThresholds([
                    { level: 1, min_xp: 1000, tier_name: 'Bronze' },
                    { level: 2, min_xp: 5000, tier_name: 'Silver' },
                    { level: 3, min_xp: 10000, tier_name: 'Gold' }
                ]);
            }
        };
        loadThresholds();
    }, []);

    // Load FID and Off-Chain Stats (Centralized Anti-Halu)
    useEffect(() => {
        const loadFarcaster = async () => {
            try {
                const context = await sdk.context;
                if (context?.user?.fid) {
                    const userFid = context.user.fid;
                    setFid(userFid);

                    // Fetch Real Stats from Supabase
                    const stats = await getUserStatsByFid(userFid);
                    if (stats) {
                        setOffChainPoints(stats.total_xp || 0);
                        setOffChainLevel(stats.current_level || 0);
                    }
                }
            } catch (e) {
                console.log("Not in Farcaster context");
            }
        };
        loadFarcaster();
    }, []);

    useEffect(() => {
        // Check for approaching deadlines every minute
        const interval = setInterval(() => {
            if (unclaimedRewards.length > 0) {
                const now = Date.now();
                unclaimedRewards.forEach(reward => {
                    if (!reward.isClaimed && reward.deadline) {
                        const timeLeft = reward.deadline - now;
                        // Notify if roughly 1 hour left (between 59m and 61m to avoid spam)
                        if (timeLeft > 59 * 60 * 1000 && timeLeft < 61 * 60 * 1000) {
                            import('react-hot-toast').then(({ default: toast }) => {
                                toast("⚠️ Reward expiry imminent! Claim within 1 hour.", { icon: '⏳' });
                            });
                        }
                    }
                });
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [unclaimedRewards]);

    // Helper: Format milliseconds to HH:MM:SS
    const formatTimeLeft = (ms) => {
        if (ms <= 0) return "00:00:00";
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Admin verification function
    const checkAdminStatus = async (walletAddress) => {
        if (!walletAddress) return;

        // Local Check for immediate UI response
        const envAdmin = import.meta.env.VITE_ADMIN_ADDRESS || '';
        const envWallets = import.meta.env.VITE_ADMIN_WALLETS || '';
        const envFids = import.meta.env.VITE_ADMIN_FIDS || '';

        const adminList = `${envAdmin},${envWallets}`
            .split(',')
            .map(a => a.trim().toLowerCase())
            .filter(a => a.startsWith('0x'));

        const adminFids = envFids.split(',')
            .map(f => f.trim())
            .filter(f => f !== '')
            .map(f => parseInt(f))
            .filter(f => !isNaN(f));

        if (walletAddress && adminList.includes(walletAddress.toLowerCase())) {
            setIsAdmin(true);
            // Still call API to confirm, but we've granted early access
        }

        try {
            const response = await fetch('/api/admin/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: walletAddress }),
            });

            if (response.ok) {
                const data = await response.json();
                setIsAdmin(data.isAdmin || false);
            } else if (!isAdmin) { // Only set false if local check didn't already grant access
                setIsAdmin(false);
            }
        } catch (error) {
            console.error('Admin check failed:', error);
            if (!isAdmin) setIsAdmin(false);
        }
    };

    // Manual add points (for local optimistic updates like Daily Claim)
    const manualAddPoints = (amount) => {
        setUserPoints(prev => prev + BigInt(amount));
        setOffChainPoints(prev => prev + amount); // Sync off-chain state
    };

    const value = {
        userPoints,
        userTier,
        totalTasksCompleted,
        unclaimedRewards,
        setUnclaimedRewards, // Exposed for useRaffle to update localized state if needed
        isLoading,
        refetch,
        isConnected,
        formatTimeLeft,
        isAdmin,
        checkAdminStatus,
        manualAddPoints,
        sbtThresholds,
        fid,
        offChainPoints,
        offChainLevel
    };

    return (
        <PointsContext.Provider value={value}>
            {children}
        </PointsContext.Provider>
    );
}

export function usePoints() {
    const context = useContext(PointsContext);
    if (!context) {
        throw new Error('usePoints must be used within a PointsProvider');
    }
    return context;
}
